# Cambios aplicados: aceptación de normas en Registros (N+1 → 1)

> El análisis y el plan están en [`analisis/NORMAS_N_MAS_1.md`](analisis/NORMAS_N_MAS_1.md).
> Este documento explica **qué se cambió, por qué y cómo funciona ahora**.

## 1. El problema, en una línea

Cada `EmployeeCard` preguntaba a Directus si **su** empleado había aceptado las normas. Con 100 empleados eran 100 requests a `com_rules_acceptance` al abrir `/horarios/registros`. Se repetían al volver a la pestaña, al pulsar "Actualizar", al cambiar de tienda y al volver a la sección.

## 2. Cómo funciona ahora

```
Antes                                   Ahora
─────                                   ─────
RegistrosPage                           RegistrosPage
 ├─ EmployeeCard #1 ─► GET (emp 1)       │  useAceptacionNormasEmpleados(ids)
 ├─ EmployeeCard #2 ─► GET (emp 2)       │     └─► GET  employee_id _in [1..100]   (1 request)
 ├─ …                                    │           → Set de ids que aceptaron
 └─ EmployeeCard #100 ─► GET (emp 100)   ├─ EmployeeCard #1   yaAceptoNormas={true}
                                         ├─ EmployeeCard #2   yaAceptoNormas={false}
                                         └─ …
```

La página pide la información de **todos** los empleados de la tienda en una sola consulta. Cada tarjeta recibe un booleano y ya no habla con Directus para leer.

## 3. Archivos modificados

### 3.1 `api/directus/rules.ts` — nueva función en lote

**Añadida:** `getEmpleadosQueAceptaronNormas(employeeIds, ruleId, version?)`, que devuelve un `Set<number>` con los ids que ya aceptaron.

- Filtra con `employee_id: { _in: ids }` y `limit: -1`, y pide solo el campo `employee_id`.
- **Bloques de 200 ids** (`MAX_IDS_POR_REQUEST`): el SDK manda el filtro en la URL, y así una tienda muy grande no genera una URL demasiado larga. Los bloques salen en paralelo (`Promise.all`) y se unen. Con menos de 200 empleados sale **1** request.
- **Mantiene el `_or` por `rule_id` o `version`**, para ser compatible con aceptaciones antiguas sin `rule_id`. Sigue pendiente de revisar con datos reales (§4.4 del análisis).
- **Errores:** la función anterior capturaba el error y devolvía `true` ("ya aceptó"), y ese resultado quedaba guardado 5 min. La nueva **deja pasar el error** para que lo gestione TanStack Query, que reintenta una vez.
- El filtro se escribe directamente en el objeto de la query, sin el `const filter: any`.

**Retirada:** `yaAceptoNormasEmpleado` → `legacy/rules.yaAceptoNormasEmpleado.ts` (ver 3.4).

`getNormasActivas`, `yaAceptoNormas`, `registrarAceptacionNormas` y `registrarAceptacionNormasEmpleado` no cambian.

### 3.2 `hooks/useAceptacionNormasEmpleados.ts` — nuevo hook

Junta en un solo sitio todo lo relativo a la aceptación de normas de los empleados de la tienda.

```ts
const { normas, puedeAceptar, yaAcepto, marcarAceptado } =
	useAceptacionNormasEmpleados(empleadoIds);
```

| Devuelve | Qué es |
|---|---|
| `normas` | Normas vigentes (`['normasActivas']`, la misma clave que `useNormas`, así que no hay request extra) |
| `puedeAceptar` | Si el usuario tiene la política `temporal` |
| `yaAcepto(id)` | `true` si el empleado aceptó, si es la demo (`99999`) o si todavía no hay datos |
| `marcarAceptado(id)` | Añade el id a la caché tras aceptar, **sin volver a consultar** |

Decisiones del hook:

- **Clave de caché:** `['aceptacionNormasEmpleados', normas.id, normas.version, ids]`. Los ids se **ordenan y se quitan duplicados**, para que reordenar la lista no cuente como datos nuevos. También se excluyen la demo y los ids no numéricos.
- **`enabled`:** solo consulta si hay normas, hay empleados y el usuario tiene **`temporal`**, que es el único que ve el botón "Aceptar normas". Para el resto, 0 requests.
- **`refetchOnWindowFocus: false`:** volver a la pestaña ya no repite la consulta. Pasados los 5 min de `staleTime` se refresca al volver a montar la página o con "Actualizar".
- **`retry: 1`:** un fallo puntual se reintenta una vez.
- **Valor por defecto:** mientras carga, o si la query está deshabilitada, `yaAcepto` devuelve `true`. Así no aparece el botón un momento y luego desaparece, igual que con el `= true` de antes.

### 3.3 `pages/RegistrosPage.tsx` — una consulta por tienda

```tsx
const empleadoIds = useMemo(() => empleados.map((e) => e.id), [empleados]);
const { normas, yaAcepto: yaAceptoNormas, marcarAceptado: marcarNormasAceptadas } =
	useAceptacionNormasEmpleados(empleadoIds);
```

Y en cada tarjeta:

```tsx
<EmployeeCard
	…
	normas={normas}
	yaAceptoNormas={yaAceptoNormas(empleado.id)}
	onNormasAceptadas={marcarNormasAceptadas}
/>
```

La tarjeta demo recibe `yaAceptoNormas` fijo a `true`.

Al cambiar de tienda, `tienda.storeId` cambia, `useHorarios` trae otros empleados y la clave del hook cambia: sale **1** request para la tienda nueva.

### 3.4 `components/EmployeeCard.tsx` — sin consultas propias

**Props nuevas** (obligatorias):

| Prop | Tipo | Sustituye a |
|---|---|---|
| `normas` | `Normas \| null` | `useQuery(['normasActivas'])` interno |
| `yaAceptoNormas` | `boolean` | `useQuery(['yaAceptoNormasEmpleado', id, …])` interno |
| `onNormasAceptadas` | `(id) => void` | `refetchAceptacion()` |

**Lógica que cambia:**

1. **Botón "Aceptar normas"**: la condición es la misma (`tieneTemporal() && id !== '99999' && normas && !yaAceptoNormas`), pero lee la prop.
2. **"Comenzar Jornada"**: antes hacía `await yaAceptoNormasEmpleado(...)`, una request extra que se saltaba la caché. Ahora comprueba `!yaAceptoNormas` y abre el modal a los 2 s, como antes.
3. **Al aceptar**: después del `registrarAceptacionNormasEmpleado` (POST) se llama a `onNormasAceptadas(id)` y el botón desaparece **sin un GET nuevo**.
4. Se quitan los imports de `useQuery`, `getNormasActivas` y `yaAceptoNormasEmpleado`.

**Corrección de Rules of Hooks:** el componente hacía `if (!empleado) return <Cargando…/>` **antes** de sus hooks (`useState`, `useQuery`…). Si `empleado` pasaba de vacío a cargado, React lanzaba *"Rendered more hooks than during the previous render"*. Ahora está dividido así:

```tsx
export default function EmployeeCard(props) {      // solo el return temprano
	if (!props.empleado) return <Card>Cargando empleado...</Card>;
	return <EmployeeCardContent {...props} />;
}
function EmployeeCardContent({ … }) { /* todos los hooks */ }
```

Hacia fuera no cambia nada: el export por defecto y las props son los mismos, más las 3 nuevas.

### 3.5 `legacy/rules.yaAceptoNormasEmpleado.ts` — función retirada

Contiene `yaAceptoNormasEmpleado` sin cambios y un comentario que explica por qué se retiró y qué la sustituye. Nada la importa. Se deja ahí como referencia, igual que el resto de `legacy/`.

## 4. Requests antes y después (tienda con 100 empleados)

| Escenario | Antes | Ahora |
|---|---|---|
| Abrir Registros | 100 | **1** |
| Volver a la pestaña (después de 5 min) | 100 | **0** |
| Botón "Actualizar" del header | 100 | **1** |
| Cambiar de tienda | 100 | **1** |
| "Comenzar Jornada" | +1 GET | **0** |
| Aceptar normas | 1 POST + 1 GET | **1 POST** |
| Usuario sin política `temporal` | 100 | **0** |

## 5. Cambio de comportamiento a tener en cuenta

Antes, el modal de normas al "Comenzar Jornada" podía abrirse **aunque el usuario no tuviera `temporal`**, porque esa comprobación no exigía la política, al contrario que el botón. Ahora la consulta solo se hace con `temporal`. Sin esa política `yaAcepto` devuelve `true` y **el modal ya no se abre**.

Si hay que mantener el comportamiento anterior, basta con quitar `temporal` de `enabled` en `hooks/useAceptacionNormasEmpleados.ts`. Seguiría siendo **1** request por tienda.

## 6. Pendiente

- [ ] **Probar en el navegador** (Network, filtrar por `com_rules_acceptance`):
  1. Una sola request con `_in` al abrir Registros.
  2. Ninguna con un usuario sin `temporal`.
  3. Al aceptar normas, el botón desaparece sin un GET nuevo.
  4. "Comenzar Jornada" con un empleado pendiente: el modal sale a los 2 s, sin request de lectura.
  5. Al cambiar de tienda, una request nueva.
- [ ] Confirmar el cambio de comportamiento de la §5.
- [ ] Revisar el filtro `_or` (`rule_id` o `version`) con los datos reales de `com_rules_acceptance`.

## 7. Comprobaciones hechas

- `npx tsc --noEmit`: en `src/apps/horarios` solo quedan los 3 errores que ya había en `MonitoreoPage.tsx` (`calendarioData`, `handleCambiarMesRankingTiendas`, `handleCambiarMesTiendas`).
- `biome check` en el hook nuevo y en `RegistrosPage`: solo 1 aviso de un `as any` que ya existía en la lógica de la demo.
- No queda ningún import de `yaAceptoNormasEmpleado` fuera de `legacy/`.
