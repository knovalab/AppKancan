# Errores y respuestas de la API — Camino A aplicado

> **Fecha:** 2026-10-16, sobre `setup` @ `6854863`. Cambios **sin commitear**: 32 archivos modificados y 5 nuevos.
> **Plan:** camino A de [`ERRORES_ESTADO_Y_PROPUESTA.md`](ERRORES_ESTADO_Y_PROPUESTA.md), con la prioridad que pediste: **quitar los `any`, centrándose en las respuestas de la API y su flujo**.
> **Qué NO cambia:** qué funciones de la API "tragan" el error y cuáles lo propagan (eso es el camino B). Las pantallas se comportan igual; solo cambia **el texto** de los errores.

---

## 1. Resultado

| Métrica | Antes | Ahora |
|---|---|---|
| `any` en `api/directus/` | 57 | **0** |
| `any` en `hooks/` | 13 | **0** |
| `any` en toda la app (sin legacy ni tests) | 258 | **173** (−85) |
| `catch (x: any)` | 33 | **0** |
| Extracciones manuales `error?.errors?.[0]?.message` | 13 | **0** |
| Funciones de la API que devolvían `Promise<any[]>` | 13 | **0** (todas con su DTO) |
| Filtros `const filter: any` | 14 | **0** (`FiltroDirectus`) |

**Verificación:**
- `tsc`: sin errores nuevos.
- `npm run test:horarios`: **35 archivos, 264 tests en verde** (8 nuevos de `utils/errores`).
- `vite build`: OK.
- Biome en los archivos nuevos: sin errores.

---

## 2. Traductor de errores (`utils/errores.ts`)

```ts
mensajeDeError(err: unknown, porDefecto: string): string
errorDeApi(err: unknown, contexto: string, porDefecto: string): Error   // para los catch de la API
codigoDeError(err) / statusDeError(err) / comoErrorDirectus(err)
```

**Orden de resolución del mensaje:**
1. Código de Directus (`extensions.code`) conocido → mensaje en español.
2. Status HTTP conocido (401, 403, 404, 429, 503) → mensaje en español.
3. El `message` del primer error de Directus.
4. `TypeError: Failed to fetch` → *"Sin conexión con el servidor…"*.
5. `Error.message`. Así se conservan los mensajes de sesión de `withAutoRefresh`, que ya están en español.
6. El mensaje por defecto de quien llama.

| Código | Mensaje |
|---|---|
| `INVALID_CREDENTIALS`, `TOKEN_EXPIRED`, `INVALID_TOKEN`, 401 | Tu sesión expiró. Vuelve a iniciar sesión. |
| `FORBIDDEN`, `COLLECTION_FORBIDDEN`, 403 | No tienes permiso para esta acción. |
| `RECORD_NOT_UNIQUE` | Este registro ya existe. |
| `FAILED_VALIDATION`, `INVALID_PAYLOAD` | Hay datos no válidos en la solicitud. |
| `INVALID_QUERY` | La consulta enviada no es válida. |
| `FIELD_NOT_FOUND_IN_COLLECTION` | La solicitud usa un campo que no existe. |
| `ROUTE_NOT_FOUND`, 404 | No se encontró el recurso solicitado. |
| `REQUESTS_EXCEEDED`, 429 | Demasiadas solicitudes. Espera un momento… |
| `SERVICE_UNAVAILABLE`, 503 | El servidor no está disponible… |

**Dónde se usa:**
- **API** (`errorDeApi`): las 11 escrituras de `create.ts`, más `upload.ts` y `rules.ts`.
- **Hooks:** `useAccionesRegistro`, `useAccionesTarjeta`, `useHorarios` (mutation y `agregarNovedad`) y `useAdminEmpleados`.
- **Componentes:** `ModalCierreMasivo`, `ModalDetalleTienda` (×2), `CreateHourModal`, `TimeRecordVerificationModal`, los 5 diálogos de exportación y `DialogPerfilEmpleado`.

**Cambio visible (el objetivo del camino A):**
- **Errores de Directus:** se ven en español según su código, en lugar del texto en inglés del servidor.
- **Errores que antes caían en el genérico:** dos casos que hoy muestran un texto por defecto ahora dan el mensaje concreto.
  - Un error de Directus (objeto plano, no `Error`) en las acciones del registro o en las exportaciones. Antes caía en `err?.message`, que no existe en ese objeto, y se veía el genérico.
  - Un error de sesión en las escrituras. Antes se mostraba *"Error al crear registro de tiempo"*; ahora se ve *"Sesión expirada…"*.

---

## 3. Respuestas de la API tipadas

### 3.1 Tipos base (`interfaces/api/directus.ts`)

| Tipo | Para qué |
|---|---|
| `FiltroDirectus` | El `filter` de `readItems` (objeto abierto con `unknown`, aceptado por el SDK sin esquema) |
| `OperadoresDirectus` | Operadores de un campo: `{ _gte, _lte, _in, _neq… }` |
| `DirectusErrorDto` | La forma del error que lanza el SDK |
| `ItemGuardado` | Lo que devuelven `createItem` / `updateItem` |

### 3.2 DTO nuevos por respuesta

| Consulta | Antes | Ahora |
|---|---|---|
| `getStoreIdUsuarioActual` (`readMe`) | `me: any`, `fields as any` | `UsuarioActualDto` |
| `getTiposNovedad` | `(t: any)` | `NewnessTypeDto` |
| `getReasons` | `(r: any)` | `ReasonDto` |
| `getReasonNamesForRecords`, `getRecordReasonId` | `(it: any)` | `RecordReasonDto` + `idRelacion` |
| `getNovedades`, `getStoreNovedades` | `Promise<any[]>`, mapeo copiado dos veces | `NewnessReportFullDto` → **`NovedadTienda`**, con un único `mapearNovedadTienda()` |
| `getCargos` | `(c: any)` | `PositionDto` |
| `listarEmpleadosTienda`, `listarTodosEmpleados`, `buscarEmpleados` | `mapEmpleadoAdmin(emp: any)` | `EmployeeDto` |
| `getEditedTimeRecords` | `Promise<any[]>` | **`RegistroEditado`**, que sustituye a la copia local `EditedRecord` de `ModalRankingTiendas` |
| `getEmpleadosBulk` | `(e: any)` | `EmployeeDto` |
| `getTimeRecordsBulkRange` / `getTimeRecordsBulk` | `Promise<any[]>` | `TimeRecordBulkDto` |
| `getNovedadesBulkRange` | `Promise<any[]>` | `NewnessBulkDto` |
| `getStoreClosedDays` | `(item: any)` | `StoreClosedDayRawDto` → `StoreClosedDayDto` |
| `getEmployeeTimeRecords` | `Promise<any[]>` | `EmployeeTimeRecordDto` |
| `getEmployeeNovedades` | `Promise<any[]>` | `EmployeeNewnessDto` |
| `getEmployeeEventReports` | `Promise<any[]>` | `EmployeeEventReportDto` |
| `getStoreEventReports` | `Promise<any[]>` | `StoreEventReportDto` |
| `uploadAttendancePhoto` | `result: any` | `ArchivoSubido` (local) |
| `create.ts` (payloads) | `payload: any` (×4) | `Record<string, unknown>` |
| `setStoreClosedDayStatus`, `createStoreClosedDay` | `Promise<any>` | `Promise<ItemGuardado \| null>` |

### 3.3 Filtros

Los que se construían con mutaciones sobre `any` (`filter.record_date = { ...filter.record_date, _gte }`) pasan a `FiltroDirectus` y a dos ayudantes en `reports.ts`:
- `operadoresTienda(storeIds, incluirPruebas)`, que devuelve `{ _in, _neq: 90 }`;
- `rango(desde, hasta)`, que devuelve `{ _gte, _lte }`.

**La lógica es la misma:** las mismas condiciones se aplican en el mismo orden.

### 3.4 `idRelacion` en su propio módulo

Pasa a `api/directus/relacion.ts`, para que `read.ts` y `readBulk.ts` lo usen sin importarse entre sí (`read.ts` lo reexporta). Se aplica en `getEmpleadosBulk` (`storeId`), en los motivos y en `readMe`.

---

## 4. El flujo hasta los consumidores

| Consumidor | Cambio |
|---|---|
| `useHorarios` | `useQuery<NovedadEntrada[]>`, sin `any`. El mapeo de novedades usa `relacion()` para leer las relaciones expandidas. Sigue aceptando filas sin expandir (relaciones como id): es el caso que cubren los tests |
| `useAdminEmpleados` | `catch (err)` / `onError(err: unknown)` + `mensajeDeError` |
| `useInAppCamera` | `catch (err)`; el `name` del `DOMException` se lee con `err instanceof Error` |
| `useParseNombreIA` | `modelosIA: unknown`, nombres de modelo validados como `string`, JSON de la IA como `Partial<Record<keyof NombreSeparado, string>>` y `catch (err)` normalizado a `Error` |
| `ModalDetalleTienda` | Ahora recibe `NovedadTienda` tipada |
| `ModalRankingTiendas` | Usa `RegistroEditado` en lugar de su copia `EditedRecord` |

### 4.1 Desajustes que el `any` ocultaba (corregidos en los tipos)

| Dónde | Qué pasaba | Corrección |
|---|---|---|
| `FilaEmpleadoDetalle.novedadId` | Declarado como `string`, pero Directus devuelve un **número** | `string \| number` |
| `RegistroEditado.empleadoId` | `MonitoreoPage` lo usa como clave numérica; el valor podía no ser número | `Number(emp.id)` y tipo `number` |
| `EditedRecord` en `ModalRankingTiendas` | Copia de la forma de `getEditedTimeRecords`, con `tiendaId: number` cuando puede faltar | Sustituida por `RegistroEditado` |

### 4.2 Tests

- **Nuevo `__test__/utils/errores.test.ts`** (8 casos): códigos, status, mensaje de Directus, red, `Error` propio, valores desconocidos y `errorDeApi`.
- **`useHorarios.test.ts`:** los dos mocks que simulan filas sin expandir se marcan explícitamente (`as unknown as NovedadTienda[]`, con un comentario), porque la API real ya no devuelve esa forma.

---

## 5. Lo que queda (173 `any`)

| Capa | `any` | Principales archivos |
|---|---|---|
| `pages/` | 64 | `monitoreo/useTiendasResumen.ts` (16), `DetallePlanillaPage` (10), `reporte/ReporteSemanalTabla` (9), `reporte/ReporteSemanalTab` (8), `planilla/DetallePlanillaTabla` (7) |
| `components/reportes/` | 47 | `AreaManagerStoreTable` (14), `ReporteSemanalAreaManager` (10) |
| `components/` (raíz) | 43 | `CalendarioMensualTienda` (9), `ModalCierreMasivo` (8), `ModalDetalleTienda` (7), `HistorialHorasModal` (7), `NovedadesTab` (6) |
| `utils/` | 23 | `horasTrabajadas` (8, movido sin cambios), `exportarSemanal` (8), `faceDetector` (5) |
| `components/admin`, otros | 12 | — |

**Casi todos son el mismo patrón:** `records: any[]` / `(r: any) => …` sobre datos que **ya llegan tipados** desde la API (`TimeRecordBulkDto`, `NewnessBulkDto`, `StoreEventReportDto`…). Ahora quitarlos es sobre todo **borrar la anotación** y corregir lo que el compilador señale, igual que en el §4.1.

**Siguiente paso sugerido:** el mismo tratamiento, archivo por archivo, en este orden:
1. `useTiendasResumen` → `CalendarioMensualTienda` → `ModalDetalleTienda` (Monitoreo);
2. `DetallePlanillaPage` y `DetallePlanillaTabla` (Planilla);
3. `ReporteSemanal*` y `AreaManagerStoreTable` (Reportes);
4. `horasTrabajadas` y `exportarSemanal` (utils).

---

## 6. Pruebas en el navegador recomendadas

| Caso | Qué comprobar |
|---|---|
| Cualquier guardado con la red cortada (`*com_time_records*` bloqueado) | Snackbar *"Sin conexión con el servidor…"* o el mensaje correspondiente, en español |
| Usuario sin permiso sobre una colección (403) | *"No tienes permiso para esta acción."* en lugar del texto en inglés |
| Novedades (sección y Registros) | La lista, los nombres, los tipos y la tienda se ven igual (`mapearNovedadTienda` unificado) |
| Monitoreo → Auditoría y ranking | Los registros editados y el ranking por empleado se ven igual (`RegistroEditado`) |
| Exportaciones (Reportes) | Generan el Excel como antes; si fallan, el mensaje es concreto |
| Admin → buscar y editar un empleado | Igual; los errores salen en español |
| Separar un nombre con IA (Admin → nuevo empleado) | Funciona y los errores de la IA se muestran igual |
