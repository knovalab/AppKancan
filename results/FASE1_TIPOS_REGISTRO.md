# Fase 1 — Tipos y valores fijos del registro de horarios

> Plan: [`analisis/MEJORAS_HORARIOS.md` §6, fase 1](analisis/MEJORAS_HORARIOS.md).
> Rama `setup`, sobre `ce3316d`. Alcance: **solo el registro** (`/horarios/registros`) y lo que comparte con él.
> **No cambia el comportamiento**, salvo el texto de 2 mensajes de validación (§5).

---

## 1. Qué se buscaba

1. **Quitar los valores escritos a mano** del registro: nombres de marcaciones, estados, eventos, id de la demo y números de reglas (pausas, duración, caracteres).
2. **Que los tipos digan qué datos hay**: en lugar de `string`, `any` o `Record<string, …>`, uniones cerradas y estructuras sin campos opcionales "por si acaso".
3. **Estandarizar**: una sola definición de cada cosa, que el resto importa.

---

## 2. La pieza nueva: `domain/registro/`

Carpeta **sin React ni Directus**: solo datos, tipos y funciones pequeñas. Se importa desde `../domain/registro`.

| Archivo | Qué contiene | Sustituye a |
|---|---|---|
| `marcaciones.ts` | **Catálogo `MARCACIONES`**: por cada marcación, su `key`, `logType` (lo que se guarda en BD), `etiqueta`, `habilitadaEn` y `estadoResultante`. Tipos `Marcacion`, `MarcacionKey` y `LogType`. Constante `LOG_TYPE`. Funciones `keyPorLogType`, `marcacionPorLogType` y `esLogType` | 22 literales y 8 `switch`/`if` de mapeo |
| `estados.ts` | `ESTADO` (los 5 estados), tipo `EstadoAsistencia` y `ETIQUETA_ESTADO` (texto del chip) | `'entrada_pendiente'`… sueltos; `estadoActual: string` |
| `eventos.ts` | `EVENTO` (iniciar y terminar pausa activa), tipo `EventoTipo` y `EVENTOS_REPORTABLES` | `EVENTOS_PAUSA` y `EVENTOS_PAUSA_LIST` (duplicados) y los literales `'… Pausa Activa'` |
| `reglas.ts` | `MAX_PAUSAS_ACTIVAS` (2), `DURACION_PAUSA_ACTIVA_MS` (5 min), `MAX_CARACTERES_OBSERVACION` (300), `MIN_CARACTERES_NOTA_MOTIVO_OTRO` (15) | Números sueltos en `EmployeeCard`, `EmployeeCardUtils`, `EmployeeCardModals`, `EditHourModal` y el tour |
| `demo.ts` | `ID_EMPLEADO_DEMO` (`'99999'`) y `esEmpleadoDemo(id)` | `'99999'` en 5 archivos |
| `registros.ts` | `crearRegistrosVacios()` | Objetos `registros` vacíos escritos a mano en `useHorarios`, `readBulk` y la demo |
| `index.ts` | Reexporta todo | — |

### 2.1 Cómo se usa el catálogo

```ts
import { LOG_TYPE, MARCACIONES, keyPorLogType } from '../domain/registro';

LOG_TYPE.inicioJornada                 // 'Comenzar Jornada' (tipo literal, no string)
keyPorLogType(r.log_type)              // 'inicioJornada' | … | undefined
MARCACIONES.map((m) => registros[m.key])  // recorrer las 4 en orden de jornada
```

`logType` es el texto que guarda Directus en `com_time_records.log_type`. **No se cambió ningún valor**: los registros existentes y los reportes siguen leyendo lo mismo.

---

## 3. Tipos que cambiaron (`interfaces/horarios.interface.ts`)

| Tipo | Antes | Ahora |
|---|---|---|
| `RegistrosAsistencia` | 4 horas a mano; `observaciones: Record<string, string>`; `ids`, `horasOriginales` y `horasEditadas` **opcionales** y con clave `string` | `Record<MarcacionKey, string \| null>` + 4 contenedores **siempre presentes** con clave `MarcacionKey`. Desaparecen los `registros.ids!` |
| `EmpleadoAsistencia.estadoActual` | `string` | `EstadoAsistencia` |
| `EventReportHoy` | — (`any[]`) | **Nuevo**: fila de `com_event_reports` que lee el registro del día |
| Reexportados | — | `EstadoAsistencia`, `EventoTipo`, `LogType` y `MarcacionKey`, para quien ya importa de `interfaces/` |

`EmpleadoAsistencia.id` **sigue siendo `string`** (ver §6).

### Firmas que ahora aceptan solo valores válidos

| Función o prop | Antes | Ahora |
|---|---|---|
| `useHorarios().registrarEvento(id, tipoEvento, …)` | `tipoEvento: string` | `LogType` |
| `useHorarios().guardarObservacion(id, tipoEvento, …)` | `string` | `LogType` |
| `useHorarios().reportarEvento(id, eventType, …)` | `string` | `EventoTipo` |
| Props `onRegistrarEvento`, `onGuardarObservacion` y `onReportarEvento` de `EmployeeCard` | `string`; devolvían `… \| any` | `LogType`/`EventoTipo`; devuelven `Promise<boolean> \| boolean` |
| `getObservacion`, `getHoraEvento`, `getEditadoStatus`, `getRecordIdEvento`, `getIcon` | `(registros: any, evento: string)` | `(registros: RegistrosAsistencia, logType: LogType)` |
| `getTimeRecords()` | `Promise<any[]>` | `Promise<TimeRecord[]>` |
| `getStoreEventReportsToday()` | `Promise<any[]>` | `Promise<EventReportHoy[]>` |

**Efecto práctico:** escribir `registrarEvento(id, 'Comenzar jornada')` (con minúscula) era válido y fallaba en silencio. Ahora es un **error de compilación**.

---

## 4. Cambios por archivo

### Lógica del registro
- **`hooks/useHorarios.ts`**
  - El `if/else` de 4 ramas que convertía `log_type` en campo pasa a ser **un bucle** con `keyPorLogType`.
  - El cálculo del estado usa el catálogo: el estado es el `estadoResultante` de la **última marcación registrada en orden de jornada**. Es el mismo resultado que la cadena de `if` anterior; se comprobaron las 16 combinaciones posibles.
  - El `switch` de `guardarObservacion` se sustituye por `keyPorLogType`.
  - `r.employee_id?.id || r.employee_id` se sustituye por `idRelacion(r.employee_id)`.
  - `timeRecords` y `eventReportsToday` quedan tipados.
- **`components/employee-card/EmployeeCardUtils.tsx`**
  - 4 `switch` (`getObservacion`, `getHoraEvento`, `getEditadoStatus`, `getRecordIdEvento`) pasan a ser búsquedas en el catálogo.
  - `getIcon` usa un mapa `ICONO_MARCACION` por clave.
  - Se elimina `EVENTOS_PAUSA`.
  - La duración de la pausa y el máximo de caracteres salen de `reglas.ts`.
  - `(window as any).__demoActiveBreakExpires` se sustituye por un `demoWindow` tipado.
- **`components/EmployeeCard.tsx`**
  - El array `botones` de 4 entradas escritas a mano se genera **desde `MARCACIONES`**: `activo = estadoActual === marcacion.habilitadaEn`.
  - Estados, eventos, `MAX_PAUSAS`, `maxLength = 300` y `'99999'` pasan a usar el dominio.
  - Los estados `eventoActualHora` y `eventoActualObs` quedan tipados como `LogType`; `guardandoRegistro`, como `LogType | null`; `eventoSeleccionado`, como `EventoTipo | ''`.
- **`components/employee-card/EmployeeCardTimeSlots.tsx`**
  - Cada botón recibe la **marcación completa** (`BotonSlot = { marcacion, activo, hora }`, exportado).
  - La comprobación del almuerzo y el botón "sin almuerzo" usan `LOG_TYPE`.
  - La `key` del `map` pasa del índice a `marcacion.key`.
- **`components/employee-card/EmployeeCardHeader.tsx`**: `estadoActual: EstadoAsistencia`. El chip usa `ETIQUETA_ESTADO` (mismo texto que antes) y el tooltip usa `EVENTO`.
- **`components/employee-card/EmployeeCardModals.tsx`**: se elimina `EVENTOS_PAUSA_LIST` (duplicado) en favor de `EVENTOS_REPORTABLES`. El límite de 300 sale de `reglas.ts`.
- **`components/EditHourModal.tsx`**
  - Las validaciones de orden comparan con `LOG_TYPE`.
  - `NOTA_MIN_OTRO` pasa a `reglas.ts`.
  - La copia local de `formatTo12Hour` se elimina: ahora se usa la de `utils/format.ts`.
  - **La interfaz pública no cambia** (`eventName: string`), porque también lo usan Monitoreo y Planilla.

### Demo y tour
- **`pages/RegistrosPage.tsx`**: los handlers de la demo usan el catálogo. Se quitan 2 `switch`/`if` de mapeo, la asignación manual de estados y el `as any`. El empleado demo arranca con `crearRegistrosVacios()` e `ID_EMPLEADO_DEMO`.
- **`components/tour/fakeTourModals.tsx`**: el texto del evento y el `0/300` salen de `EVENTO` y de `reglas.ts`.
- **`hooks/useAceptacionNormasEmpleados.ts`**: su `ID_DEMO` local se sustituye por `esEmpleadoDemo`.

### API y utilidades
- **`api/directus/read.ts`**: `idRelacion` se **exporta** y recibe `unknown`. `getTimeRecords` queda tipado.
- **`api/directus/reports.ts`**: `getStoreEventReportsToday` queda tipado.
- **`api/directus/readBulk.ts`**: usa `crearRegistrosVacios()` y `ESTADO`. Antes creaba `registros` sin `ids` ni `horas*`.
- **`utils/format.ts`**: recibe `formatTo12Hour`, que estaba copiada en `EmployeeCardUtils` y `EditHourModal`. `EmployeeCardUtils` la reexporta para no romper imports.

---

## 5. Cambios visibles

Solo uno, de texto. En `EditHourModal`, dos mensajes usaban etiquetas distintas a las demás:

| Antes | Ahora |
|---|---|
| "…mayor a la de **Inicio Almuerzo** (…)" | "…mayor a la de **Iniciar Almuerzo** (…)" |
| "…mayor a la de **Fin Jornada** (…)" | "…mayor a la de **Terminar Jornada** (…)" |

El resto de mensajes ya usaba el nombre de la marcación. Ahora todos salen de `LOG_TYPE`.

---

## 6. Qué no se tocó en esta fase, y por qué

| Pendiente | Motivo | Fase |
|---|---|---|
| ~~Los **17 archivos fuera del registro** con literales `'Comenzar Jornada'`…~~ | ✅ Hecho en la extensión de la §9 | — |
| `EmpleadoAsistencia.id: string` frente a `number` en BD | Cambiarlo afecta a archivos fuera del registro (Monitoreo, Planilla, exportadores, normas) y a las claves de caché | Fase 3, junto con el contrato de acciones |
| Validación de orden de `EditHourModal` y cálculo del estado como **funciones** (`estado.ts`) | Son lógica, no tipos. Ahora usan el catálogo, pero siguen en su sitio | Fase 2 |
| `err: any` en `onError`/`catch` de `useHorarios` y `create.ts` | Es parte del contrato de errores | Fase 3 |
| `createTimeRecord({ log_type: string })` y el fallback a la tienda 90 | También lo usan Monitoreo y Planilla; el fallback es un bug | Fase 3 |
| Novedades (`novedadesDB: any[]`, `TipoNovedad` con `name`/`nombre`) | Fuera del registro | — |
| `console.log` en `useAceptacionNormasEmpleados.ts:20-21` | Los añadiste tú para depurar; no los toqué | Fase 0 |

---

## 7. Comprobaciones

| Comprobación | Resultado |
|---|---|
| `npx tsc --noEmit` | Solo los 3 errores que ya había en `MonitoreoPage.tsx` |
| Literales de marcaciones, estados, eventos, `'99999'` y `300` en los archivos del registro | **0** (antes, 9 archivos) |
| `switch` en los archivos del registro | **0** (antes, 13 `switch`/`if` de mapeo) |
| Archivos de la app con literales de marcaciones | 22 → **17** (todos fuera del registro) |
| `any` en la app (grep, sin `legacy/`) | 281 → **261** |
| Estado calculado: catálogo frente a la cadena de `if` anterior | **16/16** combinaciones iguales |
| Texto del chip: `ETIQUETA_ESTADO` frente a `replace(/_/g,' ').toUpperCase()` | 5/5 iguales |
| `biome check --write` en `domain/` y en los archivos ya formateados con Biome | Formateados; quedan avisos de `any` en código de fases posteriores |

**Pendiente de comprobar en el navegador:**
1. Registrar las 4 marcaciones de un empleado: los botones se activan en el mismo orden y el chip muestra el mismo texto.
2. Editar una hora fuera de orden: aparece el mensaje con el nombre unificado (§5).
3. "Sin almuerzo", pausa activa (temporizador y contador "x de 2") y observaciones.
4. Modo demo y tour completo.

---

## 8. Qué desbloquea para la fase 2

- **Añadir una marcación** al catálogo ya la muestra como botón en la tarjeta, la mapea desde Directus, la incluye en el cálculo del estado y la tiene en cuenta en la demo. Falta su icono en `ICONO_MARCACION`, que el compilador **exige** porque es un `Record<MarcacionKey, …>`, y su regla de orden en `EditHourModal`, que es la fase 2.
- La fase 2 puede llevar `calcularEstado`, `accionesDisponibles` y `validarHoraEditada` a `domain/registro/estado.ts` partiendo de `habilitadaEn` y `estadoResultante`, sin volver a tocar los componentes.

---

## 9. Extensión: los tipos en toda la app

> Pedido: usar los tipos del dominio en el resto de `src/apps/horarios/` (novedades, monitoreo, historial, reportes, planilla, admin) **solo para quitar los valores escritos a mano**, sin tocar acciones, lógica ni bugs.

### 9.1 Qué se hizo

Cada literal se sustituye por **la constante con el mismo valor**: `'Comenzar Jornada'` → `LOG_TYPE.inicioJornada`, `'jornada_finalizada'` → `ESTADO.jornadaFinalizada`. Las constantes valen exactamente el mismo texto, así que **comparaciones, consultas, claves de mapas y exportaciones dan el mismo resultado**. La única diferencia es que ahora un error de escritura no compila.

En los mapas indexados por `log_type`, la clave literal pasa a ser una clave calculada: `'Comenzar Jornada': {…}` → `[LOG_TYPE.inicioJornada]: {…}`.

| Archivo | Sección | Sustituciones |
|---|---|---|
| `components/ModalDetalleTienda.tsx` | Monitoreo (detalle de tienda) | 8 `LOG_TYPE` + 4 `ESTADO` |
| `components/ModalDetalleTiendaUtils.tsx` | Monitoreo | 8 |
| `components/detalle-tienda/EmpleadosTable.tsx` | Monitoreo | 4 `LOG_TYPE` + 1 `ESTADO` |
| `components/CalendarioMensualTienda.tsx` | Monitoreo (calendario) | 2 |
| `pages/monitoreo/useTiendasResumen.ts` | Monitoreo (resumen) | 4 |
| `components/HistorialHorasModal.tsx` | Monitoreo (timeline de horas) | 4 claves de `REGISTRO_META` |
| `pages/DetallePlanillaPage.tsx` | Planilla | 8 |
| `pages/planilla/DetallePlanillaTabla.tsx` | Planilla | 4 |
| `pages/planilla/DetallePlanillaUtils.ts` | Planilla | 2 |
| `pages/HistorialPage.tsx` | Historial | 8 |
| `hooks/useHistorial.ts` | Historial | 4 |
| `components/ObservationModal.tsx` | Historial y reportes | 4 claves de `EVENTO_META` |
| `utils/exportarHistorial.ts` | Exportación de historial | 8 |
| `pages/reporte/ReporteUtils.ts` | Reportes | 4 |
| `components/reportes/FestivosDetalleModal.tsx` | Reportes (festivos) | 4 |
| `components/reportes/ReporteSemanalAreaManager.tsx` | Reportes (semanal) | 4 |
| `components/admin/DialogPerfilEmpleado.tsx` | Admin (perfil del empleado) | 6 |

**Total: 17 archivos y 91 sustituciones.** En cada uno solo se añadió `import { LOG_TYPE[, ESTADO] } from '…/domain/registro'` junto a sus imports, respetando las comillas del archivo.

### 9.2 Qué se dejó igual a propósito

| Caso | Dónde | Por qué |
|---|---|---|
| `let estado = 'Pendiente'` | `ModalDetalleTienda.tsx:302` | **No es** un estado del dominio (`entrada_pendiente`): es el texto que esa tabla muestra cuando no hay marcaciones. Cambiarlo alteraría lo que se ve. Queda anotado como inconsistencia para cuando se unifique el cálculo del estado (fase 2) |
| Etiquetas de exportación ("Inicio turno", "Fin almuerzo"…) | `exportarHistorial.ts` | Son los encabezados del Excel, no el `log_type`. Solo cambió el `tipo` de cada fila |
| `'Pausa Activa'` como texto por defecto | `ReportePausasTab.tsx:62` | Es lo que se muestra si el evento no trae tipo, no un `event_type` válido |
| `const limit = 2` | `ExportSemanalDialog`, `ExportUnificadoDialog` | Es cuántos chips de tienda se muestran en el selector, no el máximo de pausas |
| Lógica duplicada (los 4 `find` por `log_type` en cada archivo, el cálculo del estado de `ModalDetalleTienda`) | Varios | Es lógica, no un valor fijo. Se unificará con las funciones del dominio en la fase 2 |
| Formato (comillas, indentación) | Los 17 archivos | No se pasó Biome para no reformatear archivos completos: el diff solo muestra las líneas sustituidas |

### 9.3 Comprobaciones

| Comprobación | Resultado |
|---|---|
| Literales de marcaciones, eventos, estados y `'99999'` fuera de `domain/` | **0** (antes, 17 archivos) |
| `npx tsc --noEmit` | Solo los 3 errores que ya había en `MonitoreoPage.tsx` |
| `import` añadido dentro del bloque de imports de cada archivo | Revisado en los 17 |

**Pendiente de comprobar en el navegador** (debe verse igual que antes): detalle de tienda y calendario en Monitoreo, Planilla, Historial (tabla, observaciones y exportación a Excel), reportes semanal y de festivos, y el perfil del empleado en Admin.
