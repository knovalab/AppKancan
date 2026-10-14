# Registro de Horarios — Análisis para añadir funcionalidades

> **Reconstruido el 2026-10-13** sobre `setup` @ `ce3316d`. **Actualizado el 2026-10-14** sobre `62a1271`: estado actual (§0.1), foto + GPS (§9) y aceptación de la política (§10).
> **Objetivo:** dejar el **registro de horarios** (`/horarios/registros`) listo para crecer con nuevas funcionalidades.
> **Fuera de alcance por ahora:** rendimiento, bugs de otras secciones (Monitoreo, Reportes, Historial, Admin), la duplicación de la lógica de acceso, las normas del header y los avisos generales de Biome. Están en la §8 para no perderlos.

---

## 0. Resumen

La navegación y el layout ya están resueltos (`23d35de`), igual que la aceptación de normas por empleado (`ce3316d`). Lo que **frena las funcionalidades nuevas** es cómo está modelado el registro:

1. **Las 4 marcaciones están escritas a mano** como strings (`'Comenzar Jornada'`…) en **22 archivos** y en **13 `switch`/`if`** solo dentro del flujo de registro. Añadir o cambiar una marcación significa tocarlos todos.
2. **Las reglas del flujo están repartidas en 3 sitios** que tienen que coincidir: qué estado tiene el empleado (`useHorarios`), qué botón está activo (`EmployeeCard`) y en qué orden se pueden editar las horas (`EditHourModal`).
3. **El modelo de datos es "1 marcación por tipo y día"**: si ya existe, se sobrescribe. Eso impide turnos partidos, varias entradas o varias pausas registradas como marcación.
4. **`EmployeeCard` concentra todo** (465 líneas, 23 `useState`, 6 modales). Cada acción nueva va ahí.
5. **La demo reimplementa la lógica** en `RegistrosPage`: cada funcionalidad nueva hay que programarla dos veces.

La propuesta (§5) es **centralizar el dominio del registro** en un catálogo de marcaciones y unas pocas funciones puras. Con eso, añadir algo pasa a ser "declarar y renderizar".

### 0.1 Estado al 2026-10-14 (`62a1271`)

| Commit | Qué entró | Estado |
|---|---|---|
| `ce3316d` | Aceptación de normas por empleado en 1 consulta | ✅ Hecho. Quedan pendientes funcionales: ver §10 |
| `8a19fc5` | **Foto + GPS en cada marcación** (`TimeRecordVerificationModal`, `useInAppCamera`, `useHighPrecisionLocation`, `upload.ts`) | 🟡 Funciona en el camino feliz. Tiene huecos: ver §9 |
| `62a1271` | **Fase 1** (catálogo y tipos) + extensión a toda la app + integración de foto/GPS con los tipos | ✅ Hecho |
| — | **Actualización de la aceptación de la política** (`com_rules_acceptance`) | ⏳ **Siguiente.** Análisis en §10 |

Comprobaciones a esta fecha:
- `tsc`: 0 errores en `apps/horarios` fuera de los 3 previos de `MonitoreoPage`.
- Sin commitear (cambios locales, **no son de horarios**): `vite.config.ts` activa `basicSsl()` (la cámara y el GPS exigen HTTPS al probar desde otro dispositivo de la red), y `package.json` baja `@vitejs/plugin-basic-ssl` de `^2.3.0` a `^1.2.0` y queda reformateado con tabs. Conviene decidir si se commitean o se descartan antes del próximo commit, para no mezclarlos.

---

## 1. Cómo funciona hoy el registro

### 1.1 Flujo

```
RegistrosPage (/horarios/registros?tienda=…)
   │
   ├─ useHorarios(storeId)                       ← el único hook de datos
   │     ├─ lee: empleados, marcaciones de hoy, eventos de hoy, novedades, catálogos
   │     ├─ deriva por empleado: registros{4 horas}, estadoActual, pausasActivasCount
   │     ├─ oculta los empleados con novedad hoy
   │     └─ acciones: registrarEvento, guardarObservacion, agregarNovedad, reportarEvento
   │
   ├─ useAceptacionNormasEmpleados(ids)          ← normas (ya resuelto)
   │
   └─ EmployeeCard × N   (+ 1 tarjeta demo, id 99999, con handlers propios)
         ├─ Header: nombre, novedad, evento (pausa activa), aceptar normas
         ├─ TimeSlots: 4 botones en línea + editar hora + observación + "sin almuerzo"
         └─ Modales: novedad, evento, observación, editar hora, sin almuerzo, normas,
                     verificación foto + GPS (antes de cada marcación, salvo demo)  ← 8a19fc5
```

### 1.2 Datos en Directus

| Colección | Qué guarda | Clave lógica |
|---|---|---|
| `com_time_records` | Una marcación: `log_type`, `record_date`, `record_time`, `observations`, `original_record_time` y, desde `8a19fc5`, `latitude`, `longitude`, `accuracy`, `photo` (UUID de `directus_files`) | **(empleado, día, `log_type`)**: si ya existe se actualiza |
| `directus_files` | Fotos de las marcaciones (`marcacion_<log_type>_<timestamp>.jpg`, 720×900, JPEG 0.82), sin carpeta | — |
| `com_rules` / `com_rules_acceptance` | Normas vigentes y quién las aceptó | Ver §10 |
| `com_records_reasons` | Motivo de una edición de hora | 1 por marcación (upsert) |
| `com_event_reports` | Eventos sueltos: `Iniciar Pausa Activa` y `Terminar Pausa Activa` | Sin unicidad |
| `com_newness_reports` | Novedades (una fila por día del rango) | Sin unicidad |
| `com_reasons` / `com_newness` | Catálogos de motivos y tipos de novedad | — |

### 1.3 La máquina de estados (implícita)

```
entrada_pendiente ──Comenzar Jornada──► jornada_iniciada ──Iniciar Almuerzo──► en_almuerzo
                                              │                                    │
                                              │ "sin almuerzo" = registra           │ Finalizar Almuerzo
                                              │  Iniciar + Finalizar seguidos       ▼
                                              └──────────────────────────────► regreso_almuerzo
                                                                                    │ Terminar Jornada
                                                                                    ▼
                                                                          jornada_finalizada
```

- **El estado no se guarda**: se **deduce** cada vez a partir de cuál es la última de las 4 horas que existe (`useHorarios.ts:157-166`).
- **Es lineal**: no hay forma de terminar la jornada sin pasar por el almuerzo. "Sin almuerzo" lo resuelve registrando dos marcaciones seguidas con la misma hora.
- **Las pausas activas van aparte**, en `com_event_reports`, con un temporizador en `localStorage` del dispositivo. No forman parte del estado.

---

## 2. Dónde vive cada regla del registro

Este es el mapa que hay que recorrer hoy para cambiar cualquier cosa del flujo:

| Concepto | Dónde está definido | Copias |
|---|---|---|
| Nombres de las marcaciones (`'Comenzar Jornada'`…) | Strings literales | **22 archivos** (9 del registro, 13 de reportes, historial y monitoreo) |
| `log_type` ↔ campo (`inicioJornada`…) | `useHorarios.ts:124-145` (if/else), `useHorarios.ts:307-320` (switch), `EmployeeCardUtils.tsx` (`getObservacion`, `getHoraEvento`, `getEditadoStatus`, `getRecordIdEvento`: 4 switch), `RegistrosPage.tsx` (2 en la demo) | **8** |
| Cálculo del estado | `useHorarios.ts:157-166` | 1 (+ la demo lo asigna a mano) |
| Qué botón está activo | `EmployeeCard.tsx:153-174` (array `botones`) | 1 |
| Orden válido al editar una hora | `EditHourModal.tsx:123-134` | 1 |
| Icono de cada marcación | `EmployeeCardUtils.tsx` `getIcon` (switch) | 1 |
| "Sin almuerzo" | `EmployeeCard.handleConfirmarSinAlmuerzo` + `almuerzoOmitidoLocal` (estado local) + `TimeSlots` (`esCasillaAlmuerzo`) | 3 |
| Pausas: máximo, duración, tipos | `MAX_PAUSAS = 2` (`EmployeeCard`), `5 * 60 * 1000` (`EmployeeCardUtils`), `EVENTOS_PAUSA` (`EmployeeCardUtils` y `EmployeeCardModals`) | 3 |
| Crear o actualizar una marcación | `useHorarios.registrarEvento` (busca en la caché por `log_type` + fecha) | 1 |
| Demo | `RegistrosPage`: `registrarEventoDemo`, `guardarObservacionDemo`, `reportarEventoDemo`; `id === '99999'` en 5 archivos | — |

**Ejemplo práctico:** añadir una marcación "Salida temporal / Regreso" obliga a tocar hoy al menos `useHorarios` (×2), `RegistrosAsistencia`, `EmployeeCard` (botones y estados), `EmployeeCardUtils` (×5), `EditHourModal`, la demo de `RegistrosPage` (×2) y el tour. Y después, los 13 archivos de historial y reportes que leen `log_type`.

---

## 3. Fricciones para añadir funcionalidades

Ordenadas por cuánto bloquean.

### F1. Marcaciones sin catálogo 🔴
No hay una definición única de qué marcaciones existen. Los strings son `string`, así que TypeScript no detecta un error de escritura, y cada mapeo `log_type` → campo es un `switch` distinto.
**Bloquea:** añadir, renombrar o quitar marcaciones; configurarlas por tienda o por cargo.

### F2. Reglas del flujo repartidas y lineales 🔴
El estado se deduce en `useHorarios`, los botones activos se deciden en `EmployeeCard` y el orden de edición se valida en `EditHourModal`. Son tres versiones de la misma regla, que hay que mantener sincronizadas a mano. Además, el flujo solo admite una secuencia fija.
**Bloquea:** jornadas sin almuerzo "de verdad", turnos partidos, marcaciones opcionales y reglas distintas por tipo de turno.

### F3. Una marcación por tipo y día 🔴
`registrarEvento` busca si ya existe `(empleado, log_type, día)` y, si existe, **la actualiza** (guarda la hora anterior en `original_record_time`). No se distingue "registrar" de "editar", y una misma marcación no puede repetirse en el día.
**Bloquea:** varias entradas y salidas, turnos nocturnos que cruzan medianoche (la clave es el día) y registrar pausas como marcaciones.
> Cambiarlo afecta al modelo de datos y a todos los reportes. Hay que **decidirlo antes** de diseñar funcionalidades que lo necesiten (§7).

### F4. Contrato de acciones inconsistente 🟠
| Acción | Firma | Devuelve | Si falla |
|---|---|---|---|
| `registrarEvento` | 5 posicionales `(id, tipo, hora?, obs?, reasonId?)` | `void` | `console.error`: **quien la llama no se entera** |
| `guardarObservacion` | `(id, tipo, texto)` | `void` | Igual |
| `agregarNovedad` | Objeto con 2 campos que no se usan | `boolean` | `setError` + snackbar |
| `reportarEvento` | `(id, tipo, obs?)` | `boolean` | Snackbar |

Cualquier funcionalidad que **encadene acciones** hereda este problema. "Sin almuerzo" ya lo sufre: si falla el primer registro, se ejecuta igual el segundo y se marca `almuerzoOmitidoLocal`.

### F5. `EmployeeCard` como cajón de sastre 🟠
465 líneas, **23 `useState`** y 6 modales con su propio estado, validación y guardado. También contiene lógica de negocio: qué botón está activo, pausas, normas y el modal tras "Comenzar Jornada".
**Bloquea:** añadir una acción a la tarjeta sin que crezca todavía más; probar la lógica sin montar el componente.

### F6. Demo reimplementada 🟠
La tarjeta demo no usa la lógica real: `RegistrosPage` tiene su propia copia del mapeo y de los cambios de estado, y `id === '99999'` se comprueba en 5 archivos (`EmployeeCard`, `EmployeeCardUtils`, `EmployeeCardTimeSlots`, `RegistrosPage` y el hook de normas).
**Bloquea:** cada funcionalidad nueva necesita su versión demo y su paso en el tour, o la demo deja de reflejar la realidad.

### F7. Estado que solo vive en el navegador 🟡
- `almuerzoOmitidoLocal`: se pierde al recargar. En BD queda como un almuerzo de 0 minutos, que en los reportes no se distingue de uno real.
- Temporizador de la pausa activa en `localStorage`: es **por dispositivo**. Si el empleado cambia de equipo, la pausa no se ve.
**Bloquea:** cualquier funcionalidad que tenga que saber "qué está haciendo el empleado ahora" de forma fiable.

### F8. Reglas de negocio fijas en el código 🟡
`MAX_PAUSAS = 2`, duración de la pausa de 5 min, `EVENTOS_PAUSA = ['Iniciar Pausa Activa']` (definido 2 veces), máximo de 300 caracteres en observaciones, motivo obligatorio al editar hora (`motivoRequerido = true` por defecto).
**Bloquea:** parametrizar por tienda o cargo sin desplegar de nuevo.

### F9. Tipos del dominio débiles 🟡
`estadoActual: string`, `observaciones`/`ids`/`horas*: Record<string, …>` (opcionales, por eso aparece `registros.ids!`), `EmpleadoAsistencia.id: string` frente a `number` en BD, y `timeRecords: any[]`.
**Bloquea:** que el compilador avise cuando una funcionalidad nueva olvida un caso.

---

## 4. Bugs dentro del contexto del registro

Solo los que afectan a registrar marcaciones y que conviene corregir **antes** o **junto con** las funcionalidades nuevas, porque estas los heredarían:

| # | Bug | Dónde | Por qué importa para lo nuevo |
|---|---|---|---|
| B1 | Las acciones no informan de los errores (F4) | `useHorarios.registrarEvento`, `guardarObservacion` | Cualquier flujo encadenado (como "sin almuerzo") sigue adelante aunque falle |
| B2 | Si `store_id` llega vacío, la marcación se guarda en la **tienda 90** | `create.ts:105` (`data.store_id \|\| 90`); `useHorarios` pasa `STORE_ID as number` | Las acciones nuevas que creen registros heredan el fallback |
| B3 | Al editar una hora, la fecha sale del **dispositivo** y no del servidor, y `customParseFormat` funciona por casualidad | `useHorarios.ts:249-252` | Las funcionalidades con hora manual tendrían el mismo problema |
| B4 | La decisión crear/actualizar depende de la caché local | `useHorarios.ts:256-261` | Con dos dispositivos, o con la caché sin refrescar, se crea un duplicado |
| B5 | "Sin almuerzo" solo se guarda en estado local | `EmployeeCard.almuerzoOmitidoLocal` | Al recargar desaparece la marca visual |

---

## 5. Propuesta: el dominio del registro en un solo sitio

### 5.1 Estructura objetivo (solo el registro)

```
src/apps/horarios/
├── domain/registro/                      ← NUEVO: sin React y sin Directus; puro y testeable
│   ├── marcaciones.ts     catálogo: key, logType, etiqueta, icono, orden, "requiere"
│   ├── estado.ts          calcularEstado(), accionesDisponibles(), validarHoraEditada()
│   ├── mapeo.ts           timeRecords → RegistrosAsistencia (1 lookup, sin switch)
│   └── reglas.ts          MAX_PAUSAS, DURACION_PAUSA, MAX_OBSERVACION, …
├── hooks/registro/
│   ├── useAsistenciaHoy.ts       empleados + marcaciones + eventos → EmpleadoAsistencia[]
│   └── useAccionesRegistro.ts    registrar / editarHora / observar / reportar → Resultado
├── components/employee-card/
│   ├── EmployeeCard.tsx          solo compone
│   ├── TimeSlots.tsx             recorre el catálogo; ya no hay botones fijos
│   └── modales/…                 cada modal con su propio estado
└── components/tour/demo/
    └── useDemoRegistro.ts        implementa useAccionesRegistro en memoria con el MISMO dominio
```

`useHorarios` se mantiene como **fachada** para `NovedadesSeccion`, `ModalDetalleTienda` y `DetallePlanillaPage`, así nada fuera del registro se rompe.

### 5.2 El catálogo de marcaciones (pieza central)

```ts
// domain/registro/marcaciones.ts
export const MARCACIONES = [
	{ key: 'inicioJornada',  logType: 'Comenzar Jornada',   etiqueta: 'Comenzar Jornada',   icono: 'play',  requiere: [] },
	{ key: 'inicioAlmuerzo', logType: 'Iniciar Almuerzo',   etiqueta: 'Iniciar Almuerzo',   icono: 'food',  requiere: ['inicioJornada'],  grupo: 'almuerzo' },
	{ key: 'finAlmuerzo',    logType: 'Finalizar Almuerzo', etiqueta: 'Finalizar Almuerzo', icono: 'dining',requiere: ['inicioAlmuerzo'], grupo: 'almuerzo' },
	{ key: 'finJornada',     logType: 'Terminar Jornada',   etiqueta: 'Terminar Jornada',   icono: 'exit',  requiere: ['inicioJornada'] },
] as const;

export type MarcacionKey = (typeof MARCACIONES)[number]['key'];
export type LogType      = (typeof MARCACIONES)[number]['logType'];
export const POR_LOG_TYPE: Record<LogType, Marcacion> = …;
```

Con esto:
- Los 8 `switch` de mapeo pasan a ser `POR_LOG_TYPE[r.log_type].key`.
- `TimeSlots` recorre `MARCACIONES`; ya no hay array `botones` fijo.
- `accionesDisponibles(registros)` sale de `requiere`, y `EditHourModal` usa el mismo orden para validar.
- Un typo en un `logType` pasa a ser un **error de compilación**.
- Historial y reportes pueden importar `LogType`/`MARCACIONES` poco a poco, sin obligación inmediata.

### 5.3 Contrato único de acciones

```ts
type Resultado = { ok: true; id?: number } | { ok: false; error: string };

interface AccionesRegistro {
	registrar(input: { empleadoId: number; marcacion: MarcacionKey; observacion?: string }): Promise<Resultado>;
	editarHora(input: { empleadoId: number; marcacion: MarcacionKey; hora: string; motivoId: number; observacion?: string }): Promise<Resultado>;
	observar(input: { empleadoId: number; marcacion: MarcacionKey; texto: string }): Promise<Resultado>;
	reportarEvento(input: { empleadoId: number; tipo: EventoTipo; observacion?: string }): Promise<Resultado>;
}
```
- Separa **registrar** (crea) de **editar** (actualiza con motivo), que hoy van mezclados en `registrarEvento` (F3 y B4).
- Si falta la tienda, devuelve error y no usa la 90 (B2). La hora manual se combina con la fecha del servidor (B3).
- La demo implementa la misma interfaz en memoria (F6). `EmployeeCard` no sabe si es demo o no.

### 5.4 Cómo quedaría "añadir una funcionalidad"

| Funcionalidad de ejemplo | Hoy | Con la propuesta |
|---|---|---|
| Nueva marcación lineal (p. ej. "Salida temporal / Regreso") | ~10 archivos del registro + demo + reportes | 1 entrada en `MARCACIONES` (+ icono) y su `requiere`. La demo funciona sola. Reportes, cuando se migren |
| Jornada sin almuerzo de verdad | Truco de 2 marcaciones + estado local | `grupo: 'almuerzo'` opcional en `estado.ts`, sin marcaciones falsas |
| Límite de pausas por tienda | Cambiar la constante en `EmployeeCard` | `reglas.ts` (o leerlo de Directus en el futuro) |
| Nueva acción en la tarjeta | Más `useState` en `EmployeeCard` | Un modal nuevo en `modales/` + una acción en `AccionesRegistro` |
| Turnos partidos o varias entradas | No se puede sin cambiar el modelo (F3) | Sigue necesitando la decisión de datos de §7, pero el catálogo y el contrato ya lo soportan |

---

## 6. Plan por fases

Cada fase se puede desplegar sola y **no cambia el comportamiento visible**, salvo donde se indica.

| Fase | Qué | Archivos | Resuelve | Criterio de aceptación |
|---|---|---|---|---|
| **0. Preparación** | Quitar los `console.log` de `useAceptacionNormasEmpleados`; quitar `resetHorarios`, `eliminarEmpleado`/`onEliminarEmpleado` | `useHorarios`, `EmployeeCard`, `RegistrosPage` | Ruido | `tsc` igual que antes |
| **1. Catálogo y tipos** ✅ ([detalle](../FASE1_TIPOS_REGISTRO.md)) | `domain/registro/marcaciones.ts` + `MarcacionKey`, `LogType`, `EstadoAsistencia`; tipar `RegistrosAsistencia` con `Record<MarcacionKey, …>` sin opcionales | `domain/`, `interfaces/` | F1, F9 | Ningún literal `'Comenzar Jornada'` en los archivos del registro |
| **2. Dominio puro** | `mapeo.ts`, `estado.ts` (`calcularEstado`, `accionesDisponibles`, `validarHoraEditada`), `reglas.ts`. `useHorarios`, `EmployeeCard`, `EmployeeCardUtils` y `EditHourModal` los usan | `domain/`, consumidores | F2, F8 | Los 13 `switch`/`if` del registro desaparecen. Primeros tests unitarios del dominio |
| **3. Acciones con contrato** | `useAccionesRegistro` con `Resultado`; separar registrar y editar; sin fallback a 90; hora manual con la fecha del servidor; "sin almuerzo" se detiene si falla el 1.º; la verificación foto/GPS forma parte del input de `registrar` (§9, G1–G3) | `hooks/registro/`, `create.ts`, `EmployeeCard` | F4, B1, B2, B3, G1–G3 | "Sin almuerzo" con error simulado: no registra el 2.º y muestra el error. Un fallo al guardar deja el modal de foto abierto con el error |
| **4. Demo con el mismo dominio** | `useDemoRegistro` implementa `AccionesRegistro`; borrar los handlers demo de `RegistrosPage`; centralizar `ID_DEMO` | `components/tour/demo/`, `RegistrosPage` | F6 | `RegistrosPage` sin lógica demo. El tour funciona igual |
| **5. Partir `EmployeeCard`** | Cada modal con su propio estado; `TimeSlots` recorre el catálogo | `components/employee-card/` | F5 | `EmployeeCard` < 150 líneas y sin lógica de negocio |
| **6. Decisiones de modelo** *(cambia el comportamiento)* | Según §7: "sin almuerzo" persistido, pausa activa en el servidor, varias marcaciones por día | Directus + dominio | F3, F7, B4, B5 | Lo que se decida |

Las fases 1 y 2 son las que más desbloquean. A partir de la 2, una marcación nueva se declara en lugar de programarse.

---

## 7. Decisiones de negocio y datos (antes de la fase 6)

- [ ] **¿Qué funcionalidades nuevas hay en la hoja de ruta?** Define si basta con las fases 1–5 o hace falta la 6.
- [ ] **¿Puede haber más de una marcación del mismo tipo por día?** (turnos partidos, salidas temporales). Si es que sí, la clave `(empleado, día, log_type)` deja de valer (F3).
- [ ] **¿Hay turnos que cruzan medianoche?** La clave por `record_date` lo impide hoy.
- [ ] **"Sin almuerzo"**: ¿se guarda como un campo o evento propio en vez de 2 marcaciones con la misma hora? (F7, B5).
- [ ] **Pausas activas**: ¿el temporizador debe ser fiable entre dispositivos (servidor) o basta con `localStorage`?
- [ ] **Reglas configurables** (`MAX_PAUSAS`, duración, motivo obligatorio): ¿por tienda, por cargo o globales?
- [ ] ¿Se puede añadir un **índice único** en `com_time_records` para cerrar los duplicados (B4)?

---

## 8. Fuera de alcance (registrado, no se trabaja ahora)

| Tema | Referencia |
|---|---|
| Rendimiento: `useHorarios` sin `useMemo`, novedades con todo el histórico, 7 queries en `DetallePlanillaPage`/`ModalDetalleTienda`/`NovedadesSeccion` | — |
| Las `queryFn` devuelven `[]` ante errores (21 casos en `read`, `readBulk` y `reports`) | Afecta a todas las secciones |
| Lógica de acceso duplicada (`useHorariosPolicies` en 9 archivos, "tiendas permitidas" ×5, tienda 5 a mano) | Migrar a `useHorariosLayout().acceso` |
| ~~Normas del header que nunca se guardan; modal de "Comenzar Jornada" restringido a `temporal`; filtro `rule_id`/`version`~~ | **Pasa a alcance:** §10 |
| Sub-rutas de Monitoreo y Reportes con `SubSeccionLayout` | [`../LAYOUT_HORARIOS.md`](../LAYOUT_HORARIOS.md) |
| `agregarNovedad` sin límite de rango; `getNovedades` ≈ `getStoreNovedades`; `TipoNovedad` con `name` y `nombre` | Novedades |
| Query key factory (`horariosKeys`) | Conviene hacerla junto con la fase 3 si se tocan las claves |
| Archivos grandes fuera del registro (`MonitoreoPage` 760, `ModalCierreMasivo` 723, `ReportePage` 674…) y 3 errores de `tsc` en `MonitoreoPage` | — |
| 292 `noExplicitAny` y otros avisos de Biome en toda la app | Se reducirán en el registro con las fases 1–3 |

---

## 9. Funcionalidad agregada: foto + GPS en cada marcación (`8a19fc5`)

### 9.1 Cómo funciona

```
Clic en una marcación (TimeSlots)
   │
   ├─ empleado demo ─► registra directo, sin cámara (cambio de 62a1271)
   │
   └─ resto ─► TimeRecordVerificationModal
                 ├─ abre la cámara frontal (getUserMedia, sin galería) y pide GPS
                 │  (enableHighAccuracy, maximumAge 0, timeout 12 s)
                 ├─ "Capturar" ─► JPEG 720×900 recortado ─► vista previa ─► "Tomar otra" / "Confirmar"
                 └─ "Confirmar" (exige foto + coords)
                        1. sube la foto a directus_files ─► UUID
                        2. onConfirm ─► registrarEvento(..., { latitude, longitude, accuracy, photo })
                        3. cierra el modal
```

Piezas: `components/TimeRecordVerificationModal.tsx` (468 líneas), `hooks/useInAppCamera.ts`, `hooks/useHighPrecisionLocation.ts`, `api/directus/upload.ts`. En `create.ts`, los 4 campos solo se envían si no son `null`.

### 9.2 Huecos encontrados

| # | Hueco | Dónde | Impacto | Se resuelve en |
|---|---|---|---|---|
| G1 | **Si el guardado falla, el modal se cierra igual y la foto queda subida sin marcación.** `registrarEvento` atrapa el error y no lo relanza | `useHorarios.registrarEvento` | El empleado cree que marcó; archivos huérfanos en `directus_files` | Fase 3 (`Resultado`) |
| G2 | **Si la marcación ya existía, se ignoran la foto y el GPS**: la rama `existingRecord` actualiza la hora pero no `metadata` | `useHorarios.ts` (rama update) | La evidencia guardada no corresponde a la hora guardada | Fase 3 (separar registrar/editar) |
| G3 | **"Sin almuerzo" registra 2 marcaciones sin foto ni GPS** | `EmployeeCard.handleConfirmarSinAlmuerzo` | Hueco de control: se marcan almuerzos sin verificación | Decisión de negocio (§9.3) + fase 3 |
| G4 | **Coordenadas viejas:** al reabrir el modal, `coords` conserva la lectura anterior mientras llega la nueva, y "Confirmar" solo se bloquea si `!coords`. Si la nueva lectura falla, se guarda la vieja | `useHighPrecisionLocation` (no limpia `coords`) + modal | Contradice el `maximumAge: 0`; ubicación no fiable | Arreglo pequeño: limpiar `coords` al pedir lectura, o bloquear mientras `isGpsLoading` |
| G5 | **No hay umbral de precisión ni validación contra la tienda.** Se muestra "GPS asegurado" con cualquier `accuracy` (±2 km incluido) y no se compara con la ubicación de la tienda | Modal | El GPS se guarda pero no controla nada | Decisión de negocio (§9.3) |
| G6 | **Nadie lee la foto ni el GPS:** ni Monitoreo, ni Historial, ni Planilla, ni el tipo `TimeRecord` tienen esos campos | Lectura en toda la app | La evidencia existe solo en Directus | Funcionalidad nueva (visor) |
| G7 | Editar hora (`EditHourModal`) no pide verificación | `EditHourModal` | Probablemente correcto: es una corrección con motivo | Confirmar con negocio |
| G8 | Fotos en la raíz de `directus_files`, sin carpeta ni política de retención; permisos de lectura sin revisar | `upload.ts` | Datos personales (rostro + ubicación) sin gobierno | Directus: carpeta + permisos + retención |
| G9 | Tipado: `payload: Record<string, any>` en `create.ts`, `result: any` en `upload.ts`, `catch (err: any)` en los hooks; la firma de `metadata` está repetida en `EmployeeCard` y `useHorarios` | `create.ts`, `upload.ts`, hooks | Suma `any`; si cambia el contrato hay que tocar 3 sitios | Fase 3 (usar `VerificationData`) |
| G10 | Requiere HTTPS (cámara + GPS). En local se resolvió con `basicSsl()`, que está **sin commitear** | `vite.config.ts` | En producción debe servirse por HTTPS | Ya cubierto si prod es HTTPS |

### 9.3 Preguntas de negocio

- [ ] ¿Precisión mínima del GPS para aceptar la marcación (p. ej. ≤ 100 m)? ¿Se valida la distancia a la tienda (geocerca)?
- [ ] "Sin almuerzo": ¿debe pedir foto + GPS como cualquier marcación?
- [ ] ¿Quién debe ver la foto y la ubicación (Monitoreo, Historial)? ¿Durante cuánto tiempo se conservan?
- [ ] Si no hay cámara o se niega el permiso, ¿se bloquea la marcación (hoy sí) o se permite con una justificación?

---

## 10. Aceptación de la política (`com_rules_acceptance`) — estado actual

> Es lo **siguiente** en la hoja de ruta. El flujo completo está explicado en [`../FLUJO_ACEPTACION_NORMAS.md`](../FLUJO_ACEPTACION_NORMAS.md); aquí solo el estado y los huecos.

### 10.1 Qué hay hoy

| Pieza | Estado |
|---|---|
| Lectura de normas vigentes (`getNormasActivas`, clave `normasActivas`) | ✅ Una sola request compartida, pero **la query está declarada 2 veces** (`useNormas` y `useAceptacionNormasEmpleados`) |
| ¿Quién de la tienda aceptó? (`getEmpleadosQueAceptaronNormas`) | ✅ 1 request con `_in` (bloques de 200), solo con la política `temporal` |
| Registrar aceptación del empleado (`registrarAceptacionNormasEmpleado`) | 🟡 Funciona. Se llama **directo desde `EmployeeCard`**, sin mutation; si falla solo hay `console.error` y el modal sigue abierto sin mensaje |
| Aceptación del usuario del header (`useNormas`) | 🔴 **Nunca se guarda**: el modal en modo no obligatorio no tiene botón "Aceptar". `debeAceptar` no lo usa nadie y la persistencia sería `localStorage` |
| `yaAceptoNormas` / `registrarAceptacionNormas` (por usuario, en Directus) | ⚫ Código muerto |
| `legacy/rules.yaAceptoNormasEmpleado.ts` | ⚫ Código muerto (la versión N+1 anterior) |
| Modal tras "Comenzar Jornada" | ✅ **Corregido el 2026-10-14:** ahora va **antes** de la foto + GPS. Consulta Directus en el momento (`verificarAceptacion`) para todos los usuarios; sin aceptar no se abre la cámara ni se registra la entrada. Antes iba 2 s después de registrar y, tras `ce3316d`, no salía sin `temporal` |

### 10.2 Huecos

| # | Hueco | Impacto |
|---|---|---|
| N1 | **Nombre y esquema sin confirmar.** El código usa `com_rules_acceptance` con `employee_id`, `rule_id`, `version` (+ `date_created`). `docs/DOCUMENTACION_HORARIOS.md` §6.1 (línea 599) habla de **`com_employee_rule_acceptances`** con `accepted_at`. Una de las dos está desactualizada | Antes de tocar nada hay que confirmar en Directus cuál es la colección real |
| N2 | **Filtro permisivo `rule_id` O `version`:** una aceptación de la versión 3 de *otra* norma cuenta como aceptación de la vigente | Falsos "ya aceptó" si hay varias normas o si se reinician versiones |
| N3 | **No hay unicidad**: dos dispositivos, o dos clics, crean filas duplicadas | Ruido en reportes de cumplimiento |
| N4 | **La aceptación no deja evidencia**: no guarda qué declaraciones se marcaron, ni el texto aceptado, ni foto/GPS/dispositivo. Las 5 declaraciones están **fijas en `NormasModal`**, no en `com_rules` | Valor probatorio bajo; cambiar una declaración obliga a desplegar y no sube la versión |
| N5 | **Solo la política `temporal` ve el botón** "Aceptar normas" (el modal al iniciar jornada ya sale a todos, corregido 2026-10-14) | Empleados de tiendas sin `temporal` marcan sin haber aceptado |
| N6 | ~~No bloquea~~ ✅ Desde el 2026-10-14 bloquea "Comenzar Jornada" hasta aceptar. Las demás marcaciones no lo comprueban | Si la entrada ya estaba registrada antes del cambio, el resto del día no se pide |
| N7 | Ante un error de lectura, todos cuentan como "aceptó" (decisión consciente: no bloquear por red) | Silencioso: nadie se entera de que la consulta falló |
| N8 | `employee_id` se envía como `Number(id)`; la demo se excluye por `esEmpleadoDemo` ✅ | — |

### 10.3 Qué puede significar "actualizar la aceptación" (a definir)

| Opción | Qué implica | Toca |
|---|---|---|
| **A. Migrar de colección/esquema** (si `com_employee_rule_acceptances` es la nueva) | Cambiar las 2 lecturas y la escritura de `rules.ts`; decidir si las aceptaciones viejas cuentan (N2) | `rules.ts` + datos |
| **B. Añadir evidencia** a cada aceptación: declaraciones marcadas, `accepted_at`, y **reutilizar la foto + GPS** de la marcación con la que se acepta | Nuevos campos en la colección; `NormasModal` devuelve qué marcó; `EmployeeCard` pasa la foto de la última verificación | `rules.ts`, `NormasModal`, `EmployeeCard` |
| ~~**C. Hacerla obligatoria antes de marcar**~~ ✅ Hecho el 2026-10-14 | El modal de normas va **antes** del de foto en "Comenzar Jornada"; sin aceptar no se registra | `EmployeeCard` (orden de modales) |
| **D. Extender a todos los usuarios** (no solo `temporal`) | Quitar la condición `temporal` del hook y de la tarjeta; ojo: vuelve a haber 1 request por tienda para todos | `useAceptacionNormasEmpleados`, `EmployeeCard` |
| **E. Normas del header** | O se elimina el guardado muerto (solo lectura) o se guarda de verdad en Directus con `registrarAceptacionNormas` | `useNormas`, `HorariosHeader` |

Independientemente de la opción, conviene hacer primero esta **limpieza sin cambio de comportamiento**:
1. Hook `useNormasActivas()` único para la query `normasActivas` (hoy duplicada).
2. `useAceptarNormas()` con `useMutation`: mueve la escritura fuera de `EmployeeCard`, actualiza la caché con `marcarAceptado` y muestra el error con snackbar.
3. Borrar `legacy/rules.yaAceptoNormasEmpleado.ts`; decidir con E si se borran `yaAceptoNormas`/`registrarAceptacionNormas`.
4. Tipar las respuestas de `rules.ts` (`Normas`, `{ employee_id }`) y quitar el `any` del `catch`.

### 10.4 Preguntas para cerrar antes de implementar

- [ ] ¿Cuál es la colección real en Directus y qué campos tiene? (N1)
- [ ] ¿Qué se quiere "actualizar": esquema (A), evidencia (B), obligatoriedad (C), alcance (D) o el header (E)? Pueden ser varias.
- [ ] ¿Hay filas sin `rule_id` en producción? Si no, se quita el `_or` (N2).
- [ ] ¿Se puede añadir un índice único `(employee_id, rule_id, version)`? (N3)
