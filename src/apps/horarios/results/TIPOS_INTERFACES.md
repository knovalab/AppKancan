# Tipos e interfaces de Horarios — Estado actual y propuesta

> **Fecha:** 2026-10-15, sobre `setup` @ `667faf6`.
> **Aplicado (2026-10-15):** fases T1–T7 → [`TIPOS_INTERFACES_CAMBIOS_APLICADOS.md`](TIPOS_INTERFACES_CAMBIOS_APLICADOS.md). T8 (bajar `any`) no se ejecutó: los `any` se mantienen como están.
> **Alcance:** `src/apps/horarios/`, sin `legacy/` ni `__test__/`.
> **Decisiones ya tomadas que respeta este documento:**
> - se usa la carpeta `interfaces/` (no `types/`);
> - las filas y payloads de Directus llevan el sufijo **`Dto`** en el nombre del tipo;
> - los archivos **no** usan la convención `.interface.ts` (como `interfaces/comunes.ts` o `interfaces/registro.ts`);
> - **no** se activan reglas de Biome: se controla en la revisión de cada PR.

---

## 0. Resumen

| Métrica | Hoy |
|---|---|
| Declaraciones `interface` / `type` | **174** en 109 archivos |
| De ellas, `…Props` de componentes | 72 (se quedan donde están) |
| Tipos de datos o contratos **fuera** de `interfaces/` y `domain/` | ~40 |
| Tipos en `interfaces/horarios.interface.ts` | 15, importado por **46** archivos |
| Archivos de `interfaces/` | 5: `horarios.interface.ts`, `comunes.ts`, `registro.ts`, `verificacion.ts`, `novedades.ts` |
| Parámetros con tipo anónimo en línea en `api/directus/` | 17 |
| `any` | **258**. `domain/`, `interfaces/` y `components/employee-card/`: **0** |

**En una frase:** el núcleo nuevo ya está bien ordenado:
- `domain/registro/` (catálogos, vista, pasos);
- `interfaces/registro.ts`, `comunes.ts`, `verificacion.ts` y `novedades.ts`;
- la tarjeta de empleado, sin `any`.

El resto de la app sigue con un archivo cajón (`horarios.interface.ts`), contratos de Directus definidos dentro de los archivos de API, **cuatro formas distintas de representar una ubicación** y varios nombres duplicados.

---

## 1. Estado actual

### 1.1 Dónde vive cada tipo hoy

```
src/apps/horarios/
├── domain/registro/          ✅ catálogos + tipos derivados (LogType, EstadoAsistencia, EventoTipo…)
│                             ✅ vista y pasos (VistaTarjeta, EstadoMarcacion, PasoPrevio…)
├── interfaces/
│   ├── horarios.interface.ts ⚠️ 15 tipos mezclados: modelo, DTO, historial, admin, formularios
│   ├── comunes.ts            ✅ Resultado
│   ├── registro.ts           ✅ RegistrarInput, EditarHoraInput, …, AccionesTarjeta
│   ├── verificacion.ts       ✅ VerificationData
│   └── novedades.ts          ✅ NuevaNovedadInput
├── api/directus/             ⚠️ define DTO compartidos: TimeRecord, GeoJsonPoint, Normas,
│                                StoreClosedDay, NewnessReport, EventReportExport + 17 tipos en línea
├── hooks/                    ⚠️ contratos de hooks usados fuera: HorariosAcceso, TiendaSeleccionada,
│                                SeccionActiva, LocationCoordinates, CapturedPhoto, NombreSeparado
├── components/               ⚠️ view models compartidos: EmpleadoFila, EstadoDia, EventoMeta;
│                                duplicados: Tienda, HolidayMap
├── pages/                    ⚠️ EmpleadoFila (otro distinto), TiendaResumen, SortField
├── navigation/secciones.ts   ✅ Rol, ModoTienda, Seccion, SubSeccion (junto a la constante SECCIONES)
└── utils/                    ✅ privados (FilaExport, ExportarParams…) · ⚠️ TramoSemana, AssetTransformOptions
```

### 1.2 Inventario por categoría

| Categoría | Cuántos | Ejemplos | ¿Bien ubicado? |
|---|---|---|---|
| Props de componente | 72 | `EmployeeCardProps`, `NovedadModalProps` | ✅ En su archivo |
| Privados de un archivo | ~20 | `FilaExport`, `ExportarParams` (×3, cada uno en su exportador), `PasoEnCurso`, `AlmacenPausa`, `ModalAbierto`, `Nodos` | ✅ En su archivo |
| Valor de un Context | 3 | `TourContextType`, `AdminTourCtx`, `MonitoreoTourContextType` | ✅ En el archivo del context |
| Derivados de catálogos `as const` | 6 | `LogType`, `MarcacionKey`, `Marcacion`, `EstadoAsistencia`, `EventoTipo`, `PasoPrevio` | ✅ `domain/registro/` |
| Modelo y vista del dominio | 6 | `RegistrosAsistencia`, `EmpleadoAsistencia`, `MarcacionCruda`, `VistaTarjeta`, `EstadoMarcacion`, `ContextoTarjeta` | ⚠️ Los dos primeros están en `interfaces/` y `domain/` los importa (ciclo, D5) |
| Contratos entre capas | 8 | `Resultado`, `AccionesTarjeta`, `RegistrarInput`…, `VerificationData`, `NuevaNovedadInput` | ✅ `interfaces/` |
| DTO de Directus | ~10 + 17 en línea | `TimeRecord`, `EventReportHoy`, `Normas`, `StoreClosedDay`, `NewnessReport`, `EventReportExport`, `GeoJsonPoint` | ⚠️ Repartidos entre `api/` e `interfaces/`, sin sufijo `Dto` |
| Modelos de UI compartidos | ~10 | `HistorialRow`, `HistorialEventoDetalle`, `ObservacionEvento`, `EmpleadoFila` (×2), `EstadoDia`, `TiendaResumen`, `SortField`, `EventoMeta`, `TramoSemana` | ⚠️ Mezclados en `interfaces/`, `components/`, `pages/` y `utils/` |
| Contratos de hooks | ~10 | `HorariosAcceso`, `TiendaSeleccionada`, `SeccionActiva`, `HorariosLayoutValue`, `LocationCoordinates`, `CapturedPhoto`, `UseInAppCameraReturn`… | 🟡 Aceptable en su hook; los que usan varias capas, a `interfaces/` |
| Navegación | 4 | `Rol`, `ModoTienda`, `Seccion`, `SubSeccion` | ✅ Junto a `SECCIONES` |
| Infraestructura | 5 | `FaceBox`, `FaceDetectionStatus`, `ImageValidationResult`, `AssetTransformOptions`, `DirectusTransformOperation` | ✅ En su util (un solo consumidor) |

### 1.3 Avances desde el plan anterior

| Hecho | Dónde |
|---|---|
| Los hooks ya no importan tipos de componentes | `VerificationData` → `interfaces/verificacion.ts` |
| `Resultado` y los inputs de las acciones salen de los hooks | `interfaces/comunes.ts`, `interfaces/registro.ts` |
| Contrato de la tarjeta | `interfaces/registro.ts` → `AccionesTarjeta` |
| Archivos nuevos sin `.interface.ts` | `comunes.ts`, `registro.ts`, `verificacion.ts`, `novedades.ts` |
| Cero `any` en el dominio, `interfaces/` y la tarjeta | `domain/`, `interfaces/`, `components/employee-card/` |

---

## 2. Problemas

| # | Problema | Evidencia | Por qué importa |
|---|---|---|---|
| **D1** | **Archivo cajón con la convención antigua** | `horarios.interface.ts`: 15 tipos (modelo del registro, DTO de eventos, historial, novedades, tiendas, admin, formulario de empleado), importado por 46 archivos | No se sabe qué es contrato y qué es detalle; cada funcionalidad nueva acaba ahí |
| **D2** | **DTO definidos en archivos de API** | `TimeRecord` en `api/directus/read.ts` (6 consumidores), `Normas` en `rules.ts` (12, incluidos componentes), `StoreClosedDay` en `readBulk.ts` (4), `NewnessReport` y `EventReportExport` en `reports.ts` | Para usar el tipo hay que importar el módulo de API; la UI depende de la infraestructura |
| **D3** | **Tipos en línea en la API** | 17 parámetros `data: { … }` en `create.ts` (8), `read.ts` (3), `reports.ts` (3), `readBulk.ts` (2) y `rules.ts` (1) | El mismo payload se escribe varias veces (`createTimeRecord` y quienes lo llaman) |
| **D4** | **La ubicación, de 4 formas** | `VerificationData {latitude, longitude, accuracy}` · `LocationCoordinates {…, timestamp}` (hook GPS) · `TimeRecord` y `HistorialEventoDetalle {location: GeoJsonPoint, latitude?, longitude?, accuracy?}` · `createTimeRecord(data: {latitude, longitude, location})` | Cada pantalla convierte `[lon, lat]` ↔ `{latitude, longitude}` a su manera; es fácil invertir el orden de las coordenadas |
| **D5** | **Ciclo `domain` ↔ `interfaces`** | `domain/registro/{estado,mapeo,registros,disponibilidad}.ts` importan `RegistrosAsistencia`/`EmpleadoAsistencia` de `interfaces/`, y `interfaces/horarios.interface.ts` importa de `domain/` | `domain` debería ser la capa más interna, sin dependencias |
| **D6** | **Mismo nombre, formas distintas** | `GeoJsonPoint` está **definido dos veces**: en `interfaces/` y en `api/directus/read.ts`. `Tienda {id, name…}` (`interfaces/`) frente a `Tienda {id, nombre}` (`ModalCierreMasivo`). `EmpleadoFila` de Planilla ≠ `EmpleadoFila` del detalle de tienda | Autocompletado engañoso; un import equivocado compila hasta que falla en otro sitio |
| **D7** | **Duplicado entre apps** | `HolidayMap` está en `reservas/hooks/useHolidays.ts` (lo usa `FestivoDay`) y otra vez en `ModalCierreMasivo`, junto con su propio `fetchHolidaysCO` + `useQuery` | Dos cachés de festivos y dos formas del mismo dato; Horarios depende de un hook de otra app |
| **D8** | **Relaciones sin resolver** | `employee_id: { id } \| number \| string \| null` en `TimeRecord` y `EventReportHoy`; `idRelacion()` se usa en 15 sitios | Cada consumidor resuelve la relación; el DTO llega hasta la UI |
| **D9** | **Utils que importan UI** | `utils/exportarSemanal.ts` importa de `pages/reporte/ReporteUtils` y de `components/ModalDetalleTiendaUtils` | Dependencia invertida: un util no debería conocer pantallas |
| **D10** | **`any` concentrado** | 258: `pages/` 71, `api/directus/` 56, `components/reportes/` 47, `components/` (raíz) 44, `utils/` 15, `hooks/` 13 | Los tipos existen pero no protegen en los bordes (respuestas de Directus) |

---

## 3. Reglas: dónde va cada tipo

```
¿Lo usa un solo archivo?
 ├─ sí → en ese archivo, sin export (o exportado solo si es la firma pública del módulo)
 │        Props · privados de un util · valor de un Context · retorno de un hook
 └─ no → ¿Se deriva de una constante (as const)?
          ├─ sí → junto a la constante (domain/…, navigation/secciones.ts)
          └─ no → ¿Qué es?
                   ├─ modelo de negocio, sin React ni Directus → domain/<contexto>/modelo.ts
                   ├─ fila o payload de Directus              → interfaces/api/<coleccion>.ts   (sufijo Dto)
                   ├─ contrato entre capas                    → interfaces/<tema>.ts
                   └─ modelo de UI usado por varias pantallas → interfaces/ui/<pantalla>.ts
```

**Convenciones:**

| Tema | Regla | Ejemplo |
|---|---|---|
| Nombre de archivo | camelCase, **sin** `.interface.ts` ni `.dto.ts` | `interfaces/api/timeRecords.ts`, `interfaces/tiendas.ts` |
| Nombre de tipo | PascalCase, sin prefijo `I`. Sufijos: `Dto` (Directus), `Input` (entrada de una acción), `Props` (componente) | `TimeRecordDto`, `CreateTimeRecordDto`, `RegistrarInput` |
| `interface` o `type` | `interface` para formas de objeto; `type` para uniones, derivados y utilitarios | `interface Tienda` · `type Resultado = …` |
| Imports | Siempre `import type { … }` | `import type { Tienda } from '../interfaces/tiendas'` |
| Barrels | Solo `domain/registro/index.ts`. En `interfaces/` se importa del archivo concreto | `../interfaces/registro`, no `../interfaces` |
| Idioma | Dominio y UI en español; DTO con los nombres de Directus | `EmpleadoAsistencia` · `TimeRecordDto.log_type` |
| Relaciones en DTO | Un solo tipo genérico `Relacion<T>` | `employee_id: Relacion<EmployeeDto>` |
| `any` | Prohibido en `domain/` e `interfaces/`; en `api/`, `unknown` + DTO | `catch (err)` + `err instanceof Error` |

**Qué no hacer:**
- ❌ mover las `Props` a `interfaces/`;
- ❌ un barrel que reexporte todo `interfaces/`;
- ❌ otro archivo cajón (un `interfaces/index.ts` gigante sería el mismo problema que `horarios.interface.ts`).

---

## 4. Estructura propuesta

```
src/apps/horarios/
├── domain/
│   ├── registro/
│   │   ├── modelo.ts            ← NUEVO: RegistrosAsistencia, EmpleadoAsistencia, MarcacionCruda   (rompe D5)
│   │   └── …                    (catálogos, disponibilidad, pasos: sin cambios)
│   └── ubicacion.ts             ← NUEVO: aPunto(lat, lon) / desdePunto(p) — única conversión [lon, lat]  (D4)
│
├── interfaces/
│   ├── api/                     DTO: forma EXACTA de Directus (snake_case), sufijo Dto
│   │   ├── relacion.ts          Relacion<T> = number | string | { id: number | string } | null
│   │   ├── timeRecords.ts       TimeRecordDto, CreateTimeRecordDto, UpdateTimeRecordDto
│   │   ├── eventReports.ts      EventReportDto, EventReportHoyDto, EventReportExportDto, CreateEventReportDto
│   │   ├── newness.ts           NewnessReportDto, NewnessTypeDto, CreateNewnessReportDto
│   │   ├── rules.ts             RuleDto, RuleAcceptanceDto
│   │   ├── stores.ts            StoreDto, StoreClosedDayDto
│   │   └── employees.ts         EmployeeDto, CreateEmployeeDto
│   ├── comunes.ts               Resultado (+ MapaFestivos, RangoFechas)
│   ├── ubicacion.ts             PuntoGeo (GeoJSON), Ubicacion {latitud, longitud, precision}
│   ├── registro.ts              inputs de las acciones + AccionesTarjeta              (ya existe)
│   ├── verificacion.ts          VerificationData (pasa a usar Ubicacion)              (ya existe)
│   ├── novedades.ts             NuevaNovedadInput + Novedad, NovedadMapeada, TipoNovedad, Motivo
│   ├── normas.ts                Normas (modelo que consume la UI)
│   ├── empleados.ts             EmpleadoAdmin, Cargo, NuevoEmpleadoPayload, NombreSeparado
│   ├── tiendas.ts               Tienda, TiendaOpcion {id, nombre}, TiendaSeleccion, TiendaSeleccionada
│   ├── historial.ts             HistorialRow, HistorialEventoDetalle, ObservacionEvento
│   ├── acceso.ts                HorariosAcceso (lo consumen layout, guard y hooks)
│   ├── ui/
│   │   ├── monitoreo.ts         TiendaResumen, SortField, EstadoDia, FilaEmpleadoDetalle
│   │   ├── planilla.ts          FilaEmpleadoPlanilla
│   │   └── reportes.ts          TramoSemana
│   └── horarios.interface.ts    ⚠️ queda como reexport @deprecated y se borra al final (T6)
│
├── api/directus/                usa interfaces/api/* y mapea DTO → modelo cuando hace falta
├── hooks/  components/  pages/  Props y tipos privados en su archivo
└── navigation/secciones.ts      Rol, ModoTienda, Seccion, SubSeccion (sin cambios)
```

### 4.1 Dirección de las dependencias

```
domain  ◄──  interfaces  ◄──  api  ◄──  hooks  ◄──  components / pages
                                       utils ◄──┘ (utils no importa components/pages: D9)
```

| Capa | Puede importar de |
|---|---|
| `domain` | nadie |
| `interfaces` | `domain` (solo tipos) |
| `api` | `domain`, `interfaces` |
| `hooks`, `utils` | `domain`, `interfaces`, `api` |
| `components`, `pages` | todo lo anterior |

### 4.2 Ubicación: una sola representación (D4)

```ts
// interfaces/ubicacion.ts
export interface PuntoGeo { type: 'Point'; coordinates: [longitud: number, latitud: number] } // GeoJSON (Directus)
export interface Ubicacion { latitud: number; longitud: number; precision: number | null }      // lo que usa la UI

// domain/ubicacion.ts — la ÚNICA conversión
export const aPunto = (u: Pick<Ubicacion, 'latitud' | 'longitud'>): PuntoGeo => ({ type: 'Point', coordinates: [u.longitud, u.latitud] });
export const desdePunto = (p: PuntoGeo | null | undefined): Pick<Ubicacion, 'latitud' | 'longitud'> | null =>
	p ? { latitud: p.coordinates[1], longitud: p.coordinates[0] } : null;
```

- `TimeRecordDto.location: PuntoGeo | null`. Se mantienen `latitude`/`longitude` opcionales para los registros antiguos, marcados `@deprecated`.
- `HistorialEventoDetalle` expone `ubicacion: Ubicacion | null`. Mapa, Google Maps y el acordeón GPS reciben ese objeto.
- `createTimeRecord` recibe `CreateTimeRecordDto` (con `location`) y la conversión ocurre **una vez**, en `useAccionesRegistro`.

---

## 5. Mapa de migración

| Tipo | Hoy | Destino | Consumidores | Nota |
|---|---|---|---|---|
| `RegistrosAsistencia`, `EmpleadoAsistencia` | `interfaces/horarios.interface.ts` | `domain/registro/modelo.ts` | ~20 | D5 |
| `MarcacionCruda` | `domain/registro/mapeo.ts` | `domain/registro/modelo.ts` | 1 | |
| `GeoJsonPoint` (×2) | `interfaces/` + `api/directus/read.ts` | `interfaces/ubicacion.ts` → `PuntoGeo` | 2 + 2 | D4, D6 |
| `LocationCoordinates` | `hooks/useHighPrecisionLocation.ts` | se queda (retorno del hook) y se mapea a `Ubicacion` en el modal | 2 | |
| `TimeRecord` | `api/directus/read.ts` | `interfaces/api/timeRecords.ts` → `TimeRecordDto` | 6 | Alias temporal `TimeRecord` |
| `EventReportHoy` | `interfaces/` | `interfaces/api/eventReports.ts` → `EventReportHoyDto` | 3 | |
| `NewnessReport`, `EventReportExport` | `api/directus/reports.ts` | `interfaces/api/newness.ts`, `eventReports.ts` | 2 / 2 | |
| `StoreClosedDay` | `api/directus/readBulk.ts` | `interfaces/api/stores.ts` → `StoreClosedDayDto` | 4 | |
| `Normas` | `api/directus/rules.ts` | `interfaces/normas.ts` (+ `RuleDto`) | 12 | D2: hoy la tarjeta la importa de `api/` |
| 17 parámetros en línea | `api/directus/*` | `Create…Dto` / `Update…Dto` en `interfaces/api/` | — | D3 |
| `employee_id`, `store_id` en unión | DTO | `Relacion<T>` en `interfaces/api/relacion.ts` | — | D8 |
| `Tienda` (×2) | `interfaces/` + `ModalCierreMasivo` | `interfaces/tiendas.ts`: `Tienda` y `TiendaOpcion` | ~37 | D6 |
| `TiendaSeleccion`, `TiendaSeleccionada` | `hooks/useTiendaSeleccionada.ts` | `interfaces/tiendas.ts` | 2–3 | |
| `HorariosAcceso` | `hooks/useHorariosAcceso.ts` | `interfaces/acceso.ts` | 3 | `SeccionActiva` y `HorariosLayoutValue` se quedan en sus hooks |
| `EmpleadoFila` (×2) | `DetallePlanillaPage`, `ModalDetalleTiendaUtils` | `interfaces/ui/planilla.ts` → `FilaEmpleadoPlanilla`; `interfaces/ui/monitoreo.ts` → `FilaEmpleadoDetalle` | 1 / 4 | D6 |
| `EstadoDia`, `TiendaResumen`, `SortField` | `ModalDetalleTiendaUtils`, `MonitoreoUtils` | `interfaces/ui/monitoreo.ts` | 2 c/u | |
| `TipoNovedad`, `Novedad`, `NovedadMapeada`, `Motivo` | `interfaces/` | `interfaces/novedades.ts` | ~10 | Unificar `name`/`nombre` en otro paso |
| `EmpleadoAdmin`, `Cargo`, `NuevoEmpleadoPayload` | `interfaces/` | `interfaces/empleados.ts` | ~8 | |
| `NombreSeparado` | `hooks/useParseNombreIA.ts` | se queda (un consumidor) | 1 | |
| `HistorialRow`, `HistorialEventoDetalle`, `ObservacionEvento` | `interfaces/` | `interfaces/historial.ts` | 3 / 4 / 2 | `HistorialEventoDetalle` pasa a `ubicacion: Ubicacion` |
| `TramoSemana` | `utils/exportarSemanal.ts` | `interfaces/ui/reportes.ts` | 1+ | Junto con D9 |
| `HolidayMap` (×2) + `fetchHolidaysCO` | `reservas/hooks/useHolidays.ts` + `ModalCierreMasivo` | `interfaces/comunes.ts` → `MapaFestivos`; `ModalCierreMasivo` usa `useHolidays` | 3 | D7. Si otra app lo necesita: `src/shared/` |
| `EventoMeta` | `components/attendance/attendanceMeta.ts` | se queda (UI de la evidencia) | 1 | Sus colores e iconos por `LogType` podrían vivir junto a `ICONO_MARCACION` |
| 72 `…Props`, privados, contexts, `FaceBox`… | Su archivo | **se quedan** | — | |

---

## 6. Plan por fases

Cada fase es **un commit**, compila sola y **no cambia el comportamiento**.

**Comprobación de cada fase:**

```bash
npx tsc --noEmit -p tsconfig.json 2>&1 | grep "apps/horarios" | grep -v TS6133   # vacío
npm run test:horarios                                                            # verde
npx vite build --logLevel error                                                  # OK
```

| Fase | Qué | Resuelve | Esfuerzo | Criterio de aceptación |
|---|---|---|---|---|
| **T0** ✅ (parcial) | Convenciones + `interfaces/comunes.ts`, `registro.ts`, `verificacion.ts`, `novedades.ts` | — | Hecho | — |
| **T1** ✅ | `interfaces/README.md` con las reglas del §3 (una página) | Gobierno | 15 min | Existe y se enlaza en el checklist de PR |
| **T2** ✅ | `domain/registro/modelo.ts` (`RegistrosAsistencia`, `EmpleadoAsistencia`, `MarcacionCruda`); `horarios.interface.ts` los reexporta | D5 | 30 min | `grep -rn "interfaces/" src/apps/horarios/domain` → vacío |
| **T3** ✅ | **Ubicación:** `interfaces/ubicacion.ts` + `domain/ubicacion.ts` (+ tests); quitar el `GeoJsonPoint` duplicado; `HistorialEventoDetalle.ubicacion` | D4, D6 parcial | 1–2 h | Un solo `[lon, lat]` en el código (`grep "coordinates\[" src/apps/horarios`: solo en `domain/ubicacion.ts`) |
| **T4** ✅ | **DTO:** `interfaces/api/*` + `Relacion<T>`; `TimeRecord` → `TimeRecordDto` con alias temporal; nombrar los 17 tipos en línea; `Normas` → `interfaces/normas.ts` | D2, D3, D8 | 2 h | `grep -cE "\(data: \{\|items: \{" api/directus/*.ts` → 0; ningún componente importa tipos de `api/` |
| **T5** ✅ | **Repartir `horarios.interface.ts`** en `novedades.ts`, `empleados.ts`, `tiendas.ts`, `historial.ts`, `acceso.ts`; el archivo antiguo queda como reexport `@deprecated` | D1 | 1 h | Los 46 imports siguen compilando |
| **T6** ✅ | **Duplicados y modelos de UI:** `Tienda`/`TiendaOpcion`, `FilaEmpleadoPlanilla`/`FilaEmpleadoDetalle`, `EstadoDia`, `TiendaResumen`, `MapaFestivos` (+ `ModalCierreMasivo` usa `useHolidays`), `TramoSemana`; sacar de `exportarSemanal` lo que importa de UI | D6, D7, D9 | 1–2 h | No hay dos `interface` con el mismo nombre en la app; `utils/` no importa de `components/` ni de `pages/` |
| **T7** ✅ | **Migrar los imports** de `horarios.interface.ts` (46) y de los alias; borrar `horarios.interface.ts` (o moverlo a `legacy/`) | D1 | 1 h (mecánico) | `grep -rn "horarios.interface" src` → vacío |
| **T8** *(continua)* | Bajar `any` por capas: primero `api/directus/` (56, con los DTO de T4), después `hooks/` (13), `utils/` (15), `components/reportes/` (47) y `pages/` (71) | D10 | Por archivo | Primera tanda: `api/` y `hooks/` en 0; total < 180 |

**Orden recomendado:**
1. **T2 → T3 → T4:** corrigen problemas reales (ciclo, coordenadas, UI que depende de la API).
2. **T5 → T7:** son reorganización mecánica.
3. **T8:** continua, archivo por archivo cuando se toque.

**Encaje con otros trabajos:**
- **T3** va bien junto a los hallazgos H1 y H4 de [`PRUEBAS_NAVEGADOR.md`](PRUEBAS_NAVEGADOR.md) (campo `location` y registros antiguos con `latitude`/`longitude`).
- **T4 + T8** sobre `api/directus/` encajan con el paso 7 pendiente de `useHorarios` (novedades: doble mapeo y `any`).

---

## 7. Cómo mantenerlo (sin reglas de Biome)

### 7.1 Checklist de PR

- [ ] ¿El tipo nuevo lo usa más de un archivo? Entonces va a `interfaces/` (o a `domain/` si es modelo de negocio), según el §3.
- [ ] ¿Es una fila o un payload de Directus? Entonces va a `interfaces/api/<coleccion>.ts`, con sufijo `Dto`.
- [ ] ¿Se repite una forma que ya existe (ubicación, tienda, relación)? Hay que reutilizar la existente.
- [ ] Imports con `import type`.
- [ ] No hay `any` nuevo en `domain/`, `interfaces/`, `api/` ni `hooks/`.

### 7.2 Comprobaciones rápidas (copiar y pegar en la revisión)

```bash
cd src/apps/horarios
# 1. Capas internas que importan UI (debe salir vacío; hoy sale utils/exportarSemanal.ts → D9)
grep -rnE "from '(\.\./)+(components|pages)/" hooks api domain interfaces utils
# 2. domain sin dependencias externas (debe salir vacío; hoy salen 4 imports de horarios.interface → D5)
grep -rnE "from '(\.\./)+(interfaces|api|hooks)/" domain
# 3. Tipos exportados fuera de su sitio (revisar cada resultado: ¿es Props o un contrato compartido?)
grep -rnE "^export (interface|type) [A-Z]\w*" hooks components pages utils | grep -vE "Props\b"
# 4. Nombres duplicados (debe salir vacío; se ignoran los privados `Props`, `FilaExport` y `ExportarParams`)
grep -rhoE "^\s*(export )?interface [A-Z]\w*" --include=*.ts* --exclude-dir=legacy . | awk '{print $NF}' \
  | grep -vE "^(Props|FilaExport|ExportarParams)$" | sort | uniq -d
#    Hoy sale: EmpleadoFila, GeoJsonPoint, Tienda (D6)
# 5. Convención antigua en archivos nuevos (solo debe salir horarios.interface.ts hasta T7)
ls interfaces | grep "\.interface\.ts"
```

---

## 8. Riesgos y decisiones

| Tema | Decisión propuesta |
|---|---|
| Renombrar `TimeRecord` → `TimeRecordDto` toca 6 archivos | Alias `export type TimeRecord = TimeRecordDto` (`@deprecated`) hasta T7 |
| Partir `horarios.interface.ts` toca 46 imports | Reexport `@deprecated` en T5 y migración mecánica en T7, en un PR de "solo imports" |
| ¿Mapear todos los DTO a modelos? | **No por ahora.** Solo donde hay doble mapeo o relaciones repetidas (`time_records`, `newness`, ubicación). El resto usa el DTO tipado |
| `MapaFestivos` compartido con Reservas | Primero en `interfaces/comunes.ts` de Horarios; a `src/shared/` solo si otra app lo necesita |
| Registros antiguos con `latitude`/`longitude` | `TimeRecordDto` mantiene los dos campos opcionales `@deprecated`; `desdePunto` + respaldo los cubren hasta migrar los datos |

**¿Por dónde empiezo?** Recomiendo **T2 + T3** (ciclo del dominio y ubicación única): son pequeñas, no tocan pantallas y quitan el riesgo más concreto, invertir latitud y longitud.
