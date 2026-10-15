# Tipos e interfaces — Cambios aplicados

> **Fecha:** 2026-10-15, sobre `setup` @ `667faf6`. Cambios **sin commitear**.
> **Plan:** [`TIPOS_INTERFACES.md`](TIPOS_INTERFACES.md) §6, fases T1–T7.
> **Indicación aplicada:** los `any` **no se tocaron**. Siguen siendo **258**, igual que antes; la fase T8 no se ejecutó.

---

## 1. Resultado

| | Antes | Ahora |
|---|---|---|
| `interfaces/horarios.interface.ts` | 15 tipos, 46 importadores | **Eliminado** |
| Archivos de `interfaces/` | 5 | 11 por tema + `api/` (6) + `ui/` (1) + `README.md` |
| `domain/` importa de fuera de `domain/` | 4 imports (ciclo) | **0** |
| Componentes o páginas que importan **tipos** desde `api/` | Varios (`Normas`, `StoreClosedDay`, `TimeRecord`…) | **0** |
| Capas internas que importan UI (`utils/exportarSemanal`) | 2 imports | **0** |
| Conversiones `[lon, lat]` repartidas | 7 sitios en 5 archivos | **1** (`domain/ubicacion.ts`) |
| `interface` con el mismo nombre y forma distinta | `Tienda`, `EmpleadoFila`, `GeoJsonPoint` | **0** |
| `any` | 258 | 258 (sin cambios) |

**Verificación:**
- `tsc`: sin errores nuevos (solo los 3 TS6133 previos de `MonitoreoPage`).
- `npm run test:horarios`: **34 archivos, 256 tests en verde**, incluidos 5 nuevos de `domain/ubicacion`.
- `vite build`: OK.
- Las cinco comprobaciones del §7.2 del plan salen vacías.

**Comportamiento:** no cambia nada visible. La única diferencia de código está en `ModalCierreMasivo` y se explica en T6.

---

## 2. Fase por fase

### T1 — Reglas escritas

`interfaces/README.md` recoge en una página el árbol de decisión, qué tipo hay en cada archivo y las convenciones.

### T2 — Modelo del dominio (rompe el ciclo D5)

- **Nuevo `domain/registro/modelo.ts`:** contiene `RegistrosAsistencia`, `EmpleadoAsistencia` y `MarcacionCruda` (esta última salió de `mapeo.ts`).
- **`domain/registro/{estado,mapeo,registros,disponibilidad}.ts`** importan de `./modelo`.
- **`domain/registro/index.ts`** reexporta `modelo`.

### T3 — Ubicación única (D4)

- **Nuevo `domain/ubicacion.ts`:**
  - `PuntoGeo`: el GeoJSON de Directus, con `coordinates: [longitud, latitud]`.
  - `Coordenadas`.
  - `aPunto({ latitud, longitud })`, para guardar.
  - `coordenadasDe(registro)`, para leer: primero `latitude`/`longitude` sueltos y, si faltan, `location`. Cada valor se resuelve por separado, igual que antes.
- **Sitios que ahora usan esas funciones:** `api/directus/create.ts` (guardado), `hooks/useHistorial.ts`, `SingleRecordDetailModal`, `DailyAttendanceModal` y `HistorialTimelineView`.
- **`GeoJsonPoint`**, que estaba definido dos veces, se sustituye por `PuntoGeo`.
- **Tests:** `__test__/domain/ubicacion.test.ts` (5 casos), incluido el orden GeoJSON y el viaje de ida y vuelta.

**Desviaciones del plan:**

| Plan | Aplicado | Motivo |
|---|---|---|
| `interfaces/ubicacion.ts` con `PuntoGeo` y `Ubicacion` | `PuntoGeo` y `Coordenadas` en `domain/ubicacion.ts` | `domain` no puede importar de `interfaces/`, y la conversión necesita el tipo |
| `HistorialEventoDetalle.ubicacion` | Se mantienen `location`, `latitude` y `longitude` | Cambiar la forma tocaba la UI de evidencia recién hecha; `coordenadasDe` ya unifica la lectura |
| `VerificationData` con `Ubicacion` | Sin cambios | Es el contrato del modal de foto; cambiarlo no aportaba nada en esta tanda |

### T4 — DTO de Directus (D2, D3, D8)

Nuevos archivos en `interfaces/api/`, con el sufijo **`Dto`**:

| Archivo | Tipos | Sustituye a |
|---|---|---|
| `relacion.ts` | `Relacion<T>` | La unión `{id} \| number \| string \| null` |
| `timeRecords.ts` | `TimeRecordDto`, `CreateTimeRecordDto`, `UpdateTimeRecordDto` | `TimeRecord` (`read.ts`) y los parámetros en línea de `createTimeRecord`/`updateTimeRecord` |
| `eventReports.ts` | `EventReportHoyDto`, `EventReportExportDto`, `CreateEventReportDto` | `EventReportHoy` (`interfaces/`), `EventReportExport` (`reports.ts`) y el parámetro de `createEventReport` |
| `newness.ts` | `NewnessReportDto`, `CreateNewnessReportDto` | `NewnessReport` (`reports.ts`) y los parámetros de `createNovedad`/`createNovedades` |
| `stores.ts` | `StoreClosedDayDto` | `StoreClosedDay` (`readBulk.ts`) |
| `employees.ts` | `CreateEmployeeDto`, `UpdateEmployeeDto` | Los parámetros de `crearEmpleado`/`actualizarEmpleado` |

Además, `Normas` pasa de `api/directus/rules.ts` a `interfaces/normas.ts`.

- **Sin alias temporales:** los usos se renombraron directamente (T4 y T7 juntas), así que no quedan nombres antiguos que limpiar después.
- **Ajuste del recuento:** el plan hablaba de "17 tipos en línea", pero eran **7 parámetros de función**. El resto eran objetos `filter` de Directus, que no son tipos. Los 7 están nombrados.
- `Relacion<T>` se aplica a `EventReportHoyDto.employee_id`. En `TimeRecordDto`, `employee_id` sigue siendo el objeto expandido, porque es lo que piden sus `fields`.

### T5 — Repartir `horarios.interface.ts` (D1)

| Archivo | Tipos |
|---|---|
| `interfaces/novedades.ts` | `Novedad`, `TipoNovedad`, `NovedadMapeada` (junto a `NuevaNovedadInput`) |
| `interfaces/registro.ts` | `Motivo` (motivo de edición de hora), junto a `AccionesTarjeta` |
| `interfaces/tiendas.ts` | `Tienda` + `TiendaSeleccion`, `TiendaSeleccionada` (salen de `useTiendaSeleccionada`) |
| `interfaces/empleados.ts` | `Cargo`, `EmpleadoAdmin`, `NuevoEmpleadoPayload` |
| `interfaces/historial.ts` | `HistorialRow`, `HistorialEventoDetalle`, `ObservacionEvento` |
| `interfaces/acceso.ts` | `HorariosAcceso` (sale de `useHorariosAcceso`) |

`Motivo` va en `registro.ts` y no en `novedades.ts` (como decía el plan) porque es el motivo de **editar una hora** (`com_reasons`), no de una novedad.

### T6 — Duplicados, modelos de UI y D9

- **`Tienda` del cierre masivo** → `TiendaOpcion {id, nombre}` en `interfaces/tiendas.ts`. Ya no comparte nombre con `Tienda {id, name…}`.
- **Las dos `EmpleadoFila`:**
  - la del detalle de tienda (4 consumidores) → `FilaEmpleadoDetalle` en `interfaces/ui/monitoreo.ts`, junto con `EstadoDia`;
  - la de Planilla (1 consumidor) → `FilaEmpleadoPlanilla`, que **se queda en su archivo** por la regla de "un solo archivo".
- **Festivos:**
  - `MapaFestivos` en `interfaces/comunes.ts`; lo usan `FestivoDay` y `ModalCierreMasivo`.
  - `ModalCierreMasivo` usaba su propia copia de `fetchHolidaysCO` + `useQuery`, con la misma URL y la misma query key `['holidays', 'CO', año]`. Ahora usa `useHolidays` de reservas, así que la caché ya era la misma. ⚠️ **Única diferencia:** la copia local atrapaba los errores de red y devolvía `{}`; la de reservas deja que la query falle (y reintente). En los dos casos el calendario se ve sin festivos.
- **D9:** `calcularMinutosDia` (de `ModalDetalleTiendaUtils`) y `calcularMinutosSemanales` (de `ReporteUtils`) pasan **sin cambios** a `utils/horasTrabajadas.ts`. Los archivos originales las reexportan, así que sus otros consumidores no cambian. `utils/exportarSemanal` ya no importa de componentes ni de páginas.

**Se quedan donde estaban, por la regla de un solo módulo:**
- `TiendaResumen` y `SortField`: solo los usa `pages/monitoreo/`.
- `TramoSemana`: solo lo usa `exportarSemanal`.
- `NombreSeparado`, `EventoMeta` y `LocationCoordinates`.

### T7 — Migración de imports

- **Imports migrados:** 45 archivos que importaban de `horarios.interface.ts`, más los de los DTO, incluidos tests, mocks y `legacy/`. Se hizo con un script que reescribe solo los imports y renombra los identificadores afectados.
- **`interfaces/horarios.interface.ts` eliminado** (`git rm`). No se movió a `legacy/` porque al final solo contenía reexportaciones.
- En 3 o 4 imports de varias líneas reescritos cambia la indentación (tabulador en lugar de espacios). Es solo cosmético.

---

## 3. Lo que NO se tocó

- **`any`:** siguen los 258, en los mismos sitios. El código movido (`utils/horasTrabajadas.ts`) conserva sus `any` y su `(byDay[x] ||= []).push(r)`, que Biome marca como `noAssignInExpressions`; ya estaba así en `ReporteUtils`.
- **Fase T8** (bajar `any`): no se ejecutó.
- **Las 72 `Props`, los tipos privados, los contexts** y los tipos de infraestructura (`FaceBox`, `AssetTransformOptions`…).
- **Biome:** solo se formatearon los archivos **nuevos**. Los modificados se dejaron con su formato, para no ensuciar el diff.

---

## 4. Archivos

| Tipo | Archivos |
|---|---|
| Nuevos | `domain/registro/modelo.ts`, `domain/ubicacion.ts`, `interfaces/{acceso,empleados,historial,normas,tiendas}.ts`, `interfaces/api/{relacion,timeRecords,eventReports,newness,stores,employees}.ts`, `interfaces/ui/monitoreo.ts`, `interfaces/README.md`, `utils/horasTrabajadas.ts`, `__test__/domain/ubicacion.test.ts` |
| Eliminado | `interfaces/horarios.interface.ts` |
| Ampliados | `interfaces/comunes.ts` (`MapaFestivos`), `interfaces/novedades.ts`, `interfaces/registro.ts` (`Motivo`) |
| Modificados (lógica) | `api/directus/create.ts` (`aPunto`), `hooks/useHistorial.ts`, `SingleRecordDetailModal`, `DailyAttendanceModal`, `HistorialTimelineView` (`coordenadasDe`), `ModalCierreMasivo` (`useHolidays`), `ModalDetalleTiendaUtils` y `ReporteUtils` (reexportan las funciones movidas), `exportarSemanal` |
| Solo imports o nombres | El resto (~55 archivos, incluidos tests, mocks y `legacy/`) |

## 5. Pruebas en el navegador recomendadas

Del plan [`PRUEBAS_NAVEGADOR.md`](PRUEBAS_NAVEGADOR.md), las que tocan lo cambiado:

| Caso | Por qué |
|---|---|
| **R1** (marcar con foto) | Verificar en el payload que `location.coordinates` sigue siendo `[longitud, latitud]` (ahora lo arma `aPunto`) |
| **E1, E2, E4** (detalle, jornada, historial de Monitoreo) | El mapa y "Abrir en Google Maps" apuntan al mismo sitio que antes (`coordenadasDe`) |
| **O1, O2** (detalle y calendario de tienda) | `FilaEmpleadoDetalle`, `EstadoDia` y `calcularMinutosDia` movidos |
| **O3** (Planilla) | `FilaEmpleadoPlanilla` |
| **Cierre masivo** (Monitoreo) | Los festivos se ven en el calendario (`useHolidays`) |
| **O7** (Reporte semanal y su exportación) | `calcularMinutosSemanales` movida |
