# Análisis: consultas N+1 de aceptación de normas en Registros

> Vista afectada: `/horarios/registros` (`pages/RegistrosPage.tsx`)
> Función implicada: `yaAceptoNormasEmpleado()` — `api/directus/rules.ts:65`

## 1. Resumen

Cada `EmployeeCard` pregunta por su cuenta a Directus si su empleado ya aceptó las normas vigentes. Con 100 empleados en la tienda salen **100 requests** a `com_rules_acceptance` al cargar la vista, y se vuelven a lanzar en varios momentos más (ver §3). El resultado solo se usa para mostrar el botón “Aceptar normas”, que además solo ven los usuarios con la política `temporal`. Para el resto de usuarios, las 100 requests no sirven para nada.

La solución es hacer **una sola consulta por tienda** con `employee_id: { _in: [...] }`, ejecutarla en la página y pasar a cada tarjeta un booleano.

## 2. Dónde se llama

| Lugar | Qué hace | Requests |
|---|---|---|
| `components/EmployeeCard.tsx:107-115` | `useQuery(['yaAceptoNormasEmpleado', id, normasActivas.id])`, una por tarjeta | **N** al montar |
| `components/EmployeeCard.tsx:223-230` | En `handleRegistrarEvento`, al “Comenzar Jornada” llama **directamente** a `yaAceptoNormasEmpleado` y se salta la caché que ya tiene la tarjeta | 1 por cada jornada iniciada |
| `components/EmployeeCard.tsx:243` | `refetchAceptacion()` tras aceptar | 1 por cada aceptación |

`RegistrosPage.tsx:261` renderiza un `EmployeeCard` por cada elemento de `empleados`, sin paginación ni virtualización. La tarjeta demo (`id 99999`) devuelve `true` sin request.

`getNormasActivas` **no** es un problema: comparte la clave `['normasActivas']` con `useNormas` y TanStack la deduplica en 1 request.

## 3. Cuándo se repiten las N requests

El `QueryClient` global (`src/services/tankstack/QueryClient.tsx`) usa los valores por defecto: `refetchOnWindowFocus: true` y `refetchOnMount: true`. Como la query tiene `staleTime` de 5 min:

1. **Carga de la vista**: N requests.
2. **Volver a la pestaña o ventana** después de 5 min: N requests.
3. **Botón “Actualizar” del header** (`HorariosHeader.tsx:47`, `refetchQueries({ type: 'active' })`): N requests, aunque los datos sigan frescos.
4. **Cambiar de tienda** (admin): N requests de la tienda nueva. Las claves no incluyen la tienda, pero cada `id` es distinto.
5. **Volver a Registros** desde otra sección pasados 5 min: N requests, porque las tarjetas se montan de nuevo.

## 4. Problemas encontrados

### 4.1 N+1 de red (principal)
Una request por empleado. Con 100 empleados, el navegador las encola (máximo ~6 conexiones por host en HTTP/1.1), Directus recibe 100 consultas y cada una pasa por `withAutoRefresh`. Si el token caduca justo en ese momento, puede haber varios refrescos en paralelo.

### 4.2 Se consulta aunque el resultado no se use
`showAceptarNormasButton` exige `tieneTemporal()`, pero la query **no** lleva esa condición en `enabled`. Un usuario sin la política `temporal` hace las N requests y nunca ve el botón.

### 4.3 Segunda consulta en “Comenzar Jornada”
`handleRegistrarEvento` repite la pregunta con una request directa, en vez de leer `yaAceptoVigente` de la query. Ese dato ya está en caché como mucho 5 min antes. Además, abre el modal sin comprobar `tieneTemporal()`, al contrario que el botón: un usuario sin `temporal` puede ver el modal de normas del empleado al iniciar jornada. Hay que confirmar si eso es intencional.

### 4.4 Filtro con `_or` demasiado permisivo
```ts
_and: [ { employee_id: { _eq } }, { _or: [ { rule_id: { _eq: ruleId } }, { version: { _eq: version } } ] } ]
```
Da por aceptada la norma si coincide `rule_id` **o** `version`. Una aceptación de otra norma con el mismo número de versión, o una fila antigua sin `rule_id`, cuenta como aceptación válida. Parece una compatibilidad con filas antiguas sin `rule_id`. Hay que confirmarlo con los datos y, si es así, dejar el `_or` documentado o limitarlo a `rule_id: { _null: true }`.

### 4.5 Error tratado como “ya aceptó”
Ante cualquier error (403, red, campo inexistente) devuelve `true` y lo guarda en caché 5 min, sin distinguir “no pude consultar” de “aceptó”. Con N requests, un fallo transitorio deja una mezcla de tarjetas con y sin botón. Con una sola consulta, el fallo afecta a todas igual y se puede reintentar una vez.

### 4.6 Hooks después de un `return` temprano
`EmployeeCard.tsx:54-61` hace `if (!empleado) return …` **antes** de `useHorariosPolicies`, `useState`, `useQuery`, etc. Rompe las Rules of Hooks: si `empleado` pasa de `undefined` a definido, React lanza *“Rendered more hooks than during the previous render”*. No causa el N+1, pero conviene corregirlo en el mismo cambio, porque vamos a tocar esos hooks.

### 4.7 Tipos
`const filter: any` y `id` es `string` en `EmpleadoAsistencia`, pero se convierte con `Number(id)` en tres sitios.

## 5. Plan de acción

### Paso 1 — API en lote (`api/directus/rules.ts`)
Nueva función que devuelve el conjunto de empleados que ya aceptaron:

```ts
export async function getEmpleadosQueAceptaronNormas(
	employeeIds: number[],
	ruleId: number,
	version?: number,
): Promise<Set<number>> {
	if (employeeIds.length === 0) return new Set();
	const items = await withAutoRefresh(() =>
		directus.request(
			readItems('com_rules_acceptance', {
				fields: ['employee_id'],
				filter: {
					_and: [
						{ employee_id: { _in: employeeIds } },
						{ _or: [{ rule_id: { _eq: ruleId } }, ...(version != null ? [{ version: { _eq: version } }] : [])] },
					],
				},
				limit: -1,
			}),
		),
	);
	return new Set((items ?? []).map((i) => Number(i.employee_id)));
}
```

- Si hay riesgo de URL demasiado larga (el SDK manda el filtro por query string), dividir `employeeIds` en bloques de ~200 y unir los resultados. Con 100 ids el filtro mide menos de 1 KB.
- **No** capturar el error dentro: que lo gestione la query (`retry`, `isError`).
- `yaAceptoNormasEmpleado` queda sin uso. Se moverá a `legacy/`, o se eliminará, cuando termine el paso 3.
- El `_or` se mantiene tal cual hasta resolver §4.4.

### Paso 2 — Hook `hooks/useAceptacionNormasEmpleados.ts`
```ts
export function useAceptacionNormasEmpleados(empleadoIds: string[]) {
	const { tieneTemporal } = useHorariosPolicies();
	const { data: normas } = useQuery({ queryKey: ['normasActivas'], queryFn: getNormasActivas, staleTime: 10 * 60_000 });
	const ids = useMemo(() => empleadoIds.filter((id) => id !== '99999').map(Number).sort((a, b) => a - b), [empleadoIds]);

	const query = useQuery({
		queryKey: ['aceptacionNormasEmpleados', normas?.id, normas?.version, ids],
		queryFn: () => getEmpleadosQueAceptaronNormas(ids, normas!.id, normas!.version),
		enabled: !!normas && ids.length > 0 && tieneTemporal(),   // §4.2
		staleTime: 5 * 60_000,
		refetchOnWindowFocus: false,                              // §3.2
	});

	const yaAcepto = useCallback((id: string) => !query.data || query.data.has(Number(id)), [query.data]);
	const marcarAceptado = (id: string) => queryClient.setQueryData(/* misma key */, (prev) => new Set(prev).add(Number(id)));
	return { normas, yaAcepto, marcarAceptado, cargando: query.isLoading };
}
```
- Los ids van **ordenados** en la clave, para que la caché no cambie si cambia el orden de la lista.
- `!query.data`: mientras carga, o si la query está deshabilitada, se asume “aceptó”. Así no parpadea el botón, igual que ahora con `= true`.
- `marcarAceptado` actualiza la caché de forma optimista y evita el `refetch` del §2.

### Paso 3 — Conectar `RegistrosPage` y `EmployeeCard`
- `RegistrosPage` llama al hook una vez con `empleados.map((e) => e.id)` y pasa a cada tarjeta `yaAceptoNormas={yaAcepto(empleado.id)}`, `normas` y `onNormasAceptadas={marcarAceptado}`.
- `EmployeeCard` pierde las dos `useQuery` de normas y las llamadas directas a `yaAceptoNormasEmpleado`:
  - `showAceptarNormasButton = tieneTemporal() && id !== '99999' && !!normas && !yaAceptoNormas`.
  - En `handleRegistrarEvento`, al “Comenzar Jornada” usar `!yaAceptoNormas` en lugar de la request (§4.3), y aplicar la misma condición de `tieneTemporal()` cuando se confirme.
  - Tras `registrarAceptacionNormasEmpleado`, llamar a `onNormasAceptadas(id)` en lugar de `refetchAceptacion()`.
- Mover el `if (!empleado) return` **debajo** de los hooks, o sacarlo al padre (§4.6).

### Paso 4 — Limpieza
- `yaAceptoNormasEmpleado` a `legacy/` (o eliminarla), igual que con el resto de piezas sin uso.
- Quitar el `filter: any` y tipar el filtro.
- Decidir §4.4 con datos reales de `com_rules_acceptance`: ¿hay filas sin `rule_id`?

## 6. Resultado esperado

| Escenario (100 empleados) | Antes | Después |
|---|---|---|
| Cargar Registros | 100 | **1** |
| Volver a la pestaña tras 5 min | 100 | 0 |
| Botón “Actualizar” | 100 | 1 |
| “Comenzar Jornada” | 1 extra | 0 |
| Aceptar normas | 1 POST + 1 GET | 1 POST |
| Usuario sin política `temporal` | 100 | **0** |

## 7. Verificación

1. DevTools → Network, filtrar por `com_rules_acceptance`, en una tienda con muchos empleados: debe salir **una** request con `_in`.
2. Usuario sin `temporal`: ninguna request a `com_rules_acceptance`.
3. Usuario `temporal`: el botón “Aceptar normas” sale solo en los empleados pendientes. Al aceptar, desaparece sin hacer un GET nuevo.
4. “Comenzar Jornada” en un empleado pendiente: el modal se abre a los 2 s, sin request de lectura.
5. Cambiar de tienda: una request nueva con los ids de esa tienda.
6. `npx tsc --noEmit` solo con los 3 errores que ya había en `MonitoreoPage.tsx`.

## 8. Estado de implementación (2026-10-13)

| Paso | Estado | Archivos |
|---|---|---|
| 1. API en lote | ✅ `getEmpleadosQueAceptaronNormas`, en bloques de 200 ids, filtro tipado sin `any`, errores propagados | `api/directus/rules.ts` |
| 2. Hook | ✅ `useAceptacionNormasEmpleados`: devuelve `normas`, `puedeAceptar`, `yaAcepto(id)` y `marcarAceptado(id)`, con `retry: 1` y `refetchOnWindowFocus: false` | `hooks/useAceptacionNormasEmpleados.ts` |
| 3. Conexión | ✅ `RegistrosPage` hace una sola consulta. `EmployeeCard` recibe `normas`, `yaAceptoNormas` y `onNormasAceptadas`, y ya no lanza queries ni requests de lectura | `pages/RegistrosPage.tsx`, `components/EmployeeCard.tsx` |
| §4.6 Rules of Hooks | ✅ `EmployeeCard` hace el return temprano y delega en `EmployeeCardContent` | `components/EmployeeCard.tsx` |
| 4. Limpieza | ✅ `yaAceptoNormasEmpleado` movida a legacy | `legacy/rules.yaAceptoNormasEmpleado.ts` |
| §4.4 filtro `_or` | ⏳ Se mantiene; pendiente de revisar con datos reales | — |

**Cambio de comportamiento (§4.3):** la consulta solo se hace con la política `temporal`. Para otros usuarios `yaAcepto` devuelve `true`, así que el modal de "Comenzar Jornada" ya no se abre para quien no tiene `temporal`. Antes sí se abría si el empleado tenía normas pendientes. Si hay que mantenerlo, basta con quitar `temporal` del `enabled` del hook. La consulta seguiría siendo 1 por tienda.

Pendiente: la verificación en el navegador de §7.
