# Registro de Horarios — Análisis para añadir funcionalidades

> **Reconstruido el 2026-10-13** sobre `setup` @ `ce3316d`.
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
         └─ Modales: novedad, evento, observación, editar hora, sin almuerzo, normas
```

### 1.2 Datos en Directus

| Colección | Qué guarda | Clave lógica |
|---|---|---|
| `com_time_records` | Una marcación: `log_type`, `record_date`, `record_time`, `observations`, `original_record_time` | **(empleado, día, `log_type`)**: si ya existe se actualiza |
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
| **3. Acciones con contrato** | `useAccionesRegistro` con `Resultado`; separar registrar y editar; sin fallback a 90; hora manual con la fecha del servidor; "sin almuerzo" se detiene si falla el 1.º | `hooks/registro/`, `create.ts`, `EmployeeCard` | F4, B1, B2, B3 | "Sin almuerzo" con error simulado: no registra el 2.º y muestra el error |
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
| Normas del header que nunca se guardan; modal de "Comenzar Jornada" restringido a `temporal`; filtro `rule_id`/`version` | [`../FLUJO_ACEPTACION_NORMAS.md`](../FLUJO_ACEPTACION_NORMAS.md) |
| Sub-rutas de Monitoreo y Reportes con `SubSeccionLayout` | [`../LAYOUT_HORARIOS.md`](../LAYOUT_HORARIOS.md) |
| `agregarNovedad` sin límite de rango; `getNovedades` ≈ `getStoreNovedades`; `TipoNovedad` con `name` y `nombre` | Novedades |
| Query key factory (`horariosKeys`) | Conviene hacerla junto con la fase 3 si se tocan las claves |
| Archivos grandes fuera del registro (`MonitoreoPage` 760, `ModalCierreMasivo` 723, `ReportePage` 674…) y 3 errores de `tsc` en `MonitoreoPage` | — |
| 292 `noExplicitAny` y otros avisos de Biome en toda la app | Se reducirán en el registro con las fases 1–3 |
