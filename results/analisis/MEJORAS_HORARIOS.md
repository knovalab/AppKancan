# App Horarios — Revisión de `useHorarios` y puntos a mejorar

> Alcance: `src/apps/horarios/hooks/useHorarios.ts`, sus APIs (`api/directus/*`), sus consumidores
> (`RegistrosPage`, `ModalDetalleTienda`, `DetallePlanillaPage`, `EmployeeCard`) y el resto de la app
> según `repomix-output.xml`.
>
> Nota: el diff actual de `useHorarios.ts` en la rama `setup` es solo formateo de Biome (tabs + orden de imports); la lógica no cambió.

---

## 1. ¿Qué hace `useHorarios`?

Es el hook "todo en uno" de la pantalla de registro de asistencia de una tienda para **el día de hoy** (hora de Colombia sincronizada con el servidor vía `getRealColombiaTime`).

### Lecturas (6 queries de React Query)

| Query key | Fuente | Para qué |
|---|---|---|
| `['horariosStoreId']` | `readMe` → `store_id` | Tienda del usuario logueado (si no llega `storeOverride`) |
| `['empleados', storeId]` | `adm_employees` (activos) | Empleados de la tienda |
| `['tiposNovedad']` | `com_newness` | Catálogo de tipos de novedad |
| `['reasons']` | `com_reasons` | Catálogo de motivos de edición de hora |
| `['novedades', storeId]` | `com_newness_reports` | **Todo el histórico** de novedades de la tienda |
| `['timeRecords', storeId, hoy]` | `com_time_records` | Marcaciones de hoy |
| `['eventReportsToday', storeId, hoy]` | `com_event_reports` | Eventos de hoy (pausas activas) |

### Derivaciones (en cada render)

1. **`idsConNovedadHoy`**: empleados con novedad registrada hoy.
2. **`empleadosMapeados`**: por cada empleado, busca sus marcaciones y arma `registros` (`inicioJornada`, `inicioAlmuerzo`, `finAlmuerzo`, `finJornada` + observaciones, ids, horas originales/editadas), calcula `estadoActual` (máquina de estados implícita) y cuenta `pausasActivasCount`.
3. **`empleados`**: los mapeados menos los que tienen novedad hoy.
4. **`novedadesMapped`**: normaliza las novedades para la pestaña de Novedades.

### Acciones expuestas

| Acción | Qué hace |
|---|---|
| `registrarEvento` | Crea la marcación o, si ya existe para ese tipo/día, la actualiza guardando `original_record_time`. Opcionalmente guarda motivo (`upsertRecordReason`). |
| `guardarObservacion` | Actualiza la observación de una marcación existente. |
| `agregarNovedad` | Valida rango de fechas y crea una fila de novedad **por día** en lote. |
| `reportarEvento` | Crea un `com_event_reports` (pausas activas, etc.). |
| `resetHorarios` | Invalida y refetchea **toda** la caché de React Query. |
| `eliminarEmpleado` | No hace nada (`() => {}`). |

### Consumidores

- `RegistrosPage` → usa todo.
- `ModalDetalleTienda` → solo `empleados`, `loading`, `reasons`.
- `DetallePlanillaPage` → **solo `reasons`**, pero dispara las 7 queries.

---

## 2. Bugs y riesgos funcionales (prioridad alta)

### 2.1 Registros que caen en la tienda de pruebas (90) silenciosamente
`create.ts` hace `store_id: Number(data.store_id || 90)` en `createTimeRecord`, `createNovedad(es)` y `createEventReport`. El hook pasa `STORE_ID as number`, que puede ser `null` si `readMe` falla o aún no resolvió. Resultado: la marcación se guarda en la tienda "Oficina" sin error visible.

**Propuesta:** quitar el fallback a 90 en `create.ts` (que el `store_id` sea obligatorio) y en el hook lanzar/abortar si `STORE_ID == null`. Si se necesita la constante, usar `STORE_PRUEBAS` de `read.ts`, no el literal.

### 2.2 `registrarEvento` y `guardarObservacion` se tragan los errores
Ambos hacen `catch { console.error }` y resuelven `void`. Quien llama (`EditHourModal.onConfirm`, `handleConfirmarSinAlmuerzo`) no puede saber si falló: el modal se cierra y en "sin almuerzo" se ejecuta el segundo evento aunque el primero haya fallado.

**Propuesta:** devolver `Promise<boolean>` (como ya hacen `agregarNovedad` y `reportarEvento`) o relanzar el error. Unificar el contrato de todas las acciones.

### 2.3 Errores de queries que nunca llegan
Las funciones de `read.ts` / `reports.ts` / `readBulk.ts` hacen `catch → return []`. React Query nunca ve un error, así que `errorE/errorT/errorN/errorTime` casi siempre son `null`, y si falla la red el usuario ve "0 empleados" en vez de un error. Además, cuando sí hay error se muestra el texto engañoso `'Sincronizando...'`.

**Propuesta:** en las funciones usadas como `queryFn`, **relanzar** el error (dejar que React Query maneje reintentos y estado `isError`). Exponer `isError` y un mensaje real.

### 2.4 Dependencia implícita de `customParseFormat`
`dayjs(horaOverride, 'hh:mm A')` necesita el plugin `customParseFormat`. Ningún archivo de la app lo extiende; funciona solo porque `@mui/x-date-pickers/AdapterDayjs` lo registra globalmente al importarse. Si cambia el orden de carga o se quita el date picker, se parsea como `Invalid Date`.

Además, ese `dayjs(...)` usa la **fecha del dispositivo**, no `getRealColombiaTime()`, para `record_date`.

**Propuesta:** `dayjs.extend(customParseFormat)` explícito (p. ej. en `utils/timeSync.ts`) y construir la fecha a partir de `hoy`: `dayjs(`${hoy} ${hora}`, 'YYYY-MM-DD hh:mm A')`.

### 2.5 Duplicados por doble clic / carrera
La lógica "si existe actualizo, si no creo" se basa en la caché local `timeRecords`. Un doble clic antes de que se invalide la query crea dos marcaciones del mismo tipo.

**Propuesta:** deshabilitar el botón mientras `mutation.isPending`, y a nivel BD un índice único `(employee_id, record_date, log_type)` en `com_time_records`.

### 2.6 `resetHorarios` invalida la caché de **todas** las apps
`queryClient.invalidateQueries()` sin key afecta a vacantes, promociones, etc. Limitar a las keys de horarios (ver §4.3).

### 2.7 `agregarNovedad` sin límite de rango
Un rango de un año crea 365 filas en una sola petición. Validar un máximo (p. ej. 31/60 días) y avisar si ya existe novedad ese día para el empleado.

---

## 3. Tipos

Hay **~267 usos de `any`** en la app (15 en `useHorarios.ts`, 21 en `read.ts`, 17 en `create.ts`). Puntos concretos:

### 3.1 Tipos de dominio como uniones, no `string`
```ts
// interfaces/horarios.interface.ts
export const LOG_TYPES = {
  inicioJornada: 'Comenzar Jornada',
  inicioAlmuerzo: 'Iniciar Almuerzo',
  finAlmuerzo: 'Finalizar Almuerzo',
  finJornada: 'Terminar Jornada',
} as const;

export type EventKey = keyof typeof LOG_TYPES;              // 'inicioJornada' | ...
export type LogType = (typeof LOG_TYPES)[EventKey];        // 'Comenzar Jornada' | ...

export const EVENT_KEY_BY_LOG_TYPE = Object.fromEntries(
  Object.entries(LOG_TYPES).map(([k, v]) => [v, k]),
) as Record<LogType, EventKey>;

export type EstadoAsistencia =
  | 'entrada_pendiente'
  | 'jornada_iniciada'
  | 'en_almuerzo'
  | 'regreso_almuerzo'
  | 'jornada_finalizada';
```
Los strings `'Comenzar Jornada'` etc. están repetidos en **más de 20 archivos** (`EmployeeCard`, `EmployeeCardUtils`, `RegistrosPage` (demo), `ModalDetalleTienda`, `DetallePlanillaPage`, `ReporteUtils`, `useTiendasResumen`, exportadores…). Un typo hoy no lo detecta el compilador.

### 3.2 `RegistrosAsistencia`
```ts
export interface RegistrosAsistencia {
  horas: Record<EventKey, string | null>;
  observaciones: Partial<Record<EventKey, string>>;
  ids: Partial<Record<EventKey, number>>;            // hoy es opcional → obliga a usar `!`
  horasOriginales: Partial<Record<EventKey, string | null>>;
  horasEditadas: Partial<Record<EventKey, string | null>>;
}
```
- Hacer `ids`, `horasOriginales`, `horasEditadas` **no opcionales** elimina los `registros.ids!` del hook.
- Usar `Record<EventKey, …>` en lugar de `Record<string, …>`.
- (Opcional) agrupar las 4 horas en `horas` para poder iterar en vez de repetir if/else.

### 3.3 `EmpleadoAsistencia`
- `estadoActual: string` → `EstadoAsistencia`.
- `id: string` mientras en BD es `number` → provoca `Number(...)`/`String(...)` por todas partes (`Number(r.employee_id?.id || r.employee_id) === Number(emp.id)`). Elegir uno (recomendado `number`) y convertir solo en la frontera (API).
- `getEmpleadosBulk` hace `documento: … : String(e.id)` (usa el id como documento si no hay) — mejor `null` y que la UI decida.

### 3.4 Respuestas de Directus tipadas
- `TimeRecord` ya existe en `read.ts`, pero `getTimeRecords` devuelve `Promise<any[]>` → usar `Promise<TimeRecord[]>`. Mover `TimeRecord` a `interfaces/`.
- Crear `NovedadReportDB` y `EventReportDB` para `getNovedades` / `getStoreEventReportsToday` (hoy `any[]`).
- Ideal: definir el **schema de Directus** (`createDirectus<Schema>()`) para que `readItems('com_time_records', …)` infiera tipos y elimine los `fields: [...] as any`.

### 3.5 Relaciones `id | objeto`
El patrón `r.employee_id?.id || r.employee_id` se repite y es frágil (`0` es falsy). Ya existe `idRelacion()` en `read.ts` (no exportado). Exportarlo a `utils/` y usarlo siempre:
```ts
export const relId = (v: unknown): number | null => { … };
```

### 3.6 `TipoNovedad` con `name` **y** `nombre`
`getTiposNovedad` duplica el mismo valor en dos campos, y el hook compara contra ambos. Dejar solo uno (`name`, que es el de BD) y borrar los fallbacks `t.nombre || t.name`.

### 3.7 Mutaciones y errores
- `onError: (err: any)` → `(err: Error)`; tipar `useMutation<TData, Error, TVariables>`.
- Tipar el parámetro de `agregarNovedad` con una interfaz (`NuevaNovedadInput`) y eliminar campos que no se usan (`empleadoNombre`, `fechaRegistro`).
- En `create.ts`, `catch (error: any)` → `unknown` + helper `getDirectusErrorMessage(error, fallback)` (el patrón `error?.errors?.[0]?.message || '...'` se repite ~12 veces).

---

## 4. Reestructuración

### 4.1 Partir el hook por responsabilidad
El hook mezcla catálogos, datos del día, novedades históricas, mutaciones y estado de UI. Esto obliga a `DetallePlanillaPage` (que solo quiere `reasons`) y a `ModalDetalleTienda` a hacer 6–7 peticiones.

Propuesta de estructura:

```
hooks/
  queries/
    keys.ts                 // query key factory (§4.3)
    useStoreIdActual.ts     // ['horarios','storeId'] — hoy duplicado también en RegistrosPage
    useCatalogos.ts         // useTiposNovedad(), useReasons()
    useAsistenciaHoy.ts     // empleados + timeRecords + eventReports → EmpleadoAsistencia[]
    useNovedades.ts         // novedades mapeadas
  mutations/
    useRegistrarEvento.ts
    useGuardarObservacion.ts
    useAgregarNovedad.ts
    useReportarEvento.ts
  useHorarios.ts            // fachada que compone los anteriores (compatibilidad con RegistrosPage)
utils/
  asistencia.ts             // funciones puras (§4.2)
```

- `DetallePlanillaPage` → `useReasons()`.
- `ModalDetalleTienda` → `useAsistenciaHoy(tiendaId)` + `useReasons()`.
- `RegistrosPage` puede seguir usando `useHorarios` sin cambios.

### 4.2 Extraer la lógica a funciones puras (testeables)
```ts
// utils/asistencia.ts
export function construirRegistros(records: TimeRecord[]): RegistrosAsistencia
export function calcularEstado(r: RegistrosAsistencia): EstadoAsistencia
export function mapNovedad(nov: NovedadReportDB, empleados: EmpleadoAsistencia[], tipos: TipoNovedad[]): NovedadMapeada
```
- El bloque `if/else` de 4 ramas (líneas 124–145) y el `switch` de `guardarObservacion` (306–320) se reemplazan por `EVENT_KEY_BY_LOG_TYPE[r.log_type]`.
- La misma lógica está **copiada** en `RegistrosPage` (`registrarEventoDemo`, `guardarObservacionDemo`) y en `EmployeeCardUtils` (`getObservacion`, `getHoraEvento`, `getEditadoStatus`). Con las funciones puras + mapas, todo eso se reduce a lookups.
- Mover la transformación de datos a `select` de React Query o al `queryFn`, no al cuerpo del hook.

### 4.3 Query key factory
Las keys actuales (`['empleados']`, `['reasons']`, `['novedades']`) son genéricas y pueden chocar con otras apps del monorepo. Además las invalidaciones son amplias (`['timeRecords']` invalida todas las tiendas y fechas).
```ts
export const horariosKeys = {
  all: ['horarios'] as const,
  storeId: () => [...horariosKeys.all, 'storeId'] as const,
  empleados: (storeId: number) => [...horariosKeys.all, 'empleados', storeId] as const,
  timeRecords: (storeId: number, fecha: string) => [...horariosKeys.all, 'timeRecords', storeId, fecha] as const,
  // ...
};
```
`resetHorarios` → `queryClient.invalidateQueries({ queryKey: horariosKeys.all })`.

### 4.4 Rendimiento
- Todas las derivaciones se recalculan en **cada render** y son O(empleados × registros). Usar `useMemo` y agrupar una sola vez:
  ```ts
  const recordsPorEmpleado = useMemo(() => groupBy(timeRecords, r => relId(r.employee_id)), [timeRecords]);
  ```
- `idsConNovedadHoy` es un array con `.includes` dentro de un `.filter` → usar `Set`.
- `['novedades', storeId]` trae **todo el histórico** (`limit: -1`) solo para saber quién tiene novedad hoy y para la pestaña. Separar: una query con filtro `report_date = hoy` para el filtrado de empleados, y la lista histórica paginada o por rango solo cuando se abre la pestaña.
- Las acciones se recrean en cada render; si se pasan a `EmployeeCard` (lista), envolver en `useCallback` o exponer directamente las mutaciones.

### 4.5 Manejo de errores unificado
Hoy conviven tres mecanismos: `useState error`, `showSnackbar` y `console.error`, con mensajes duplicados (`setError(msg)` + `showSnackbar(msg)`). Elegir uno:
- Mutaciones → snackbar (en `onError` de la mutación) y devolver el resultado.
- Queries → `isError` de React Query.
- Eliminar el `useState<string | null>` del hook o reservarlo solo para errores de validación del formulario de novedad.

### 4.6 Código muerto / limpieza
- `eliminarEmpleado` es un no-op: eliminar del hook y la prop `onEliminarEmpleado` de `EmployeeCard` (el empleado ya desaparece al invalidar `novedades`).
- En `novedadesMapped`, la segunda rama (líneas 447–492) casi nunca se ejecuta porque `getNovedades` ya devuelve `empleadoNombre` como `Empleado #<id>` (nunca igual a `'Empleado #'`). Además el significado de `empleadoActivo` cambia entre ramas (`status === 'Activo'` vs. "está en la lista local"). Unificar en `mapNovedad`.
- `getNovedades` y `getStoreNovedades` en `read.ts` son prácticamente iguales (el comentario dice que reutiliza, pero no lo hace). Dejar una sola.
- `STORE_ID` en mayúsculas sugiere constante; renombrar a `storeId`.
- `horaOverride`, `observacionOverride`, `reasonId` como posicionales → pasar un objeto `{ empleadoId, tipo, hora?, observacion?, reasonId? }`.

---

## 5. Otros puntos de la app (contexto repomix)

- **Archivos muy grandes**: `MonitoreoPage` (760), `ModalCierreMasivo` (723), `ReportePage`/`ExportUnificadoDialog`/`RegistrosPage` (~670). Candidatos a dividir igual que se hizo con `employee-card/`.
- **Código de demo/tour mezclado con producción**: `RegistrosPage` mantiene `demoEmpleado`, `registrarEventoDemo`, etc., y `EmployeeCard` chequea `String(id) !== '99999'`. Mover a un `useDemoEmpleado()` dentro de `components/tour/`.
- **IDs mágicos**: tienda `90` (pruebas) en `create.ts`, tienda `5` excluida en `RegistrosPage`, empleado `99999` demo, `EMAIL_DEFECTO`/`TELEFONO_DEFECTO`. Centralizar en un `constants.ts`.
- **`horariosStoreId`** se consulta tanto en `useHorarios` como en `RegistrosPage` con opciones distintas (`enabled` diferente) → centralizar en `useStoreIdActual()`.
- **Mapeo de nombre completo** (`[first, middle, last, second_last].filter(Boolean).join(' ')`) repetido en ~10 sitios → `utils/format.ts: nombreCompleto(emp)`.
- **Biome**: con `preset: recommended`, `noExplicitAny` y `noNonNullAssertion` deberían marcar gran parte de lo anterior; correr `npx biome check src/apps/horarios` para tener la lista completa.
- **Tests**: no hay tests de la app. Las funciones puras de §4.2 (`construirRegistros`, `calcularEstado`, `mapNovedad`, expansión de rango de `agregarNovedad`) son el mejor punto de entrada.

---

## 6. Orden sugerido de trabajo

1. **Quick wins sin riesgo**: constantes `LOG_TYPES`/`EstadoAsistencia`, `relId`, `customParseFormat` explícito, borrar `eliminarEmpleado`, `useMemo` + `Set`.
2. **Correctitud**: quitar fallback a tienda 90, que las acciones devuelvan éxito/fallo, que los `queryFn` relancen errores.
3. **Tipos**: `RegistrosAsistencia`/`EmpleadoAsistencia` estrictos, `TimeRecord` y DTOs de Directus, eliminar `any` del hook y de `create.ts`/`read.ts`.
4. **Reestructuración**: query key factory → hooks separados → `useHorarios` como fachada → migrar `DetallePlanillaPage` y `ModalDetalleTienda`.
5. **Extras**: novedades por rango/paginadas, índice único en BD, extraer demo del tour, tests de utils.
