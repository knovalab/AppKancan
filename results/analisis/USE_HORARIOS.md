# `useHorarios` — Análisis

> **Fecha:** 2026-10-14, sobre `setup` @ `cd0c6af`.
> **Archivo:** `src/apps/horarios/hooks/useHorarios.ts` (479 líneas).
> **Aplicado (2026-10-14):** pasos 1–6 de §7 → [`../USE_HORARIOS_CAMBIOS_APLICADOS.md`](../USE_HORARIOS_CAMBIOS_APLICADOS.md). Pendientes: 7 y 8.
> **Contexto:** es la fase 2 y la fase 3 de [`MEJORAS_HORARIOS.md`](MEJORAS_HORARIOS.md) vistas desde el hook. Aquí está el detalle de qué hace, qué falla y cómo partirlo sin romper a quienes lo usan.

---

## 0. Resumen

`useHorarios` es **el único hook de datos del registro**, y también lo usan otras 3 pantallas. Hace a la vez cinco cosas:

1. Resuelve la tienda (la del usuario o la que se le pasa).
2. Lanza **7 queries**: tienda, empleados, tipos de novedad, motivos, novedades, marcaciones de hoy y eventos de hoy.
3. **Deriva** el estado de cada empleado (registros, estado, pausas) y oculta a los que tienen novedad hoy.
4. Expone **4 acciones** de escritura (marcar, observar, novedad, evento) más 2 que no hacen nada.
5. **Mapea las novedades** para la sección Novedades.

Los problemas principales son:
- **Las acciones no informan si fallan.** Con la foto y el GPS esto ya tiene coste real: la foto se sube aunque la marcación no se guarde (§3, H1).
- **Una sola función hace "registrar" y "editar hora"**, y decide entre crear y actualizar con la caché local (§3, H2–H4).
- **Quien solo necesita los motivos paga las 7 queries** (§4, P1).
- **Nada está memorizado**: todo se recalcula en cada render (§4, P2).

La propuesta (§6) es partirlo en 4 hooks pequeños y mantener `useHorarios` como **fachada** con la misma firma. Así ningún consumidor tiene que cambiar el mismo día.

---

## 1. Qué hace hoy

### 1.1 Entradas y salidas

```
useHorarios(storeOverride?)
 │
 ├─ STORE_ID = storeOverride ?? tienda del usuario (readMe)
 │
 ├─ queries (todas con STORE_ID salvo los catálogos)
 │    horariosStoreId      30 min
 │    empleados            5 min, sin refetch al volver a la pestaña
 │    tiposNovedad         10 min
 │    reasons              10 min
 │    novedades            0 (siempre "viejo")  ← TODO el histórico de la tienda
 │    timeRecords  (hoy)   0
 │    eventReportsToday    0
 │
 ├─ derivados (en cada render, sin useMemo)
 │    idsConNovedadHoy     novedades → ids con report_date === hoy
 │    empleadosMapeados    empleados × timeRecords → registros, estadoActual, pausasActivasCount
 │    empleados            empleadosMapeados − idsConNovedadHoy
 │    novedadesMapped      novedades → NovedadMapeada[]
 │
 └─ devuelve
      empleados, novedades, tiposNovedad, reasons, loading, error
      registrarEvento, guardarObservacion, agregarNovedad, reportarEvento
      resetHorarios (nadie lo usa), eliminarEmpleado (función vacía)
```

### 1.2 Quién lo usa y qué toma

| Consumidor | Toma | Queries que dispara | Necesita de verdad |
|---|---|---|---|
| `pages/RegistrosPage` | casi todo | 7 | 7 |
| `components/ModalDetalleTienda` | `empleados`, `loading`, `reasons` | 7 | empleados + marcaciones + novedades + motivos |
| `pages/secciones/NovedadesSeccion` | `novedades`, `loading` | 7 | novedades (+ empleados para el nombre) |
| `pages/DetallePlanillaPage` | **solo `reasons`** | **7** | 1 (`reasons`) |

### 1.3 Acciones

| Acción | Firma | Qué hace | Devuelve | Si falla |
|---|---|---|---|---|
| `registrarEvento` | `(id, tipo, hora?, obs?, reasonId?, metadata?)`: 6 posicionales | Busca en la caché `(empleado, log_type, fecha)`. Si existe, **actualiza** la hora (guarda la original); si no, **crea** con foto y GPS. Después hace upsert del motivo | `void` | `console.error`. El llamador no se entera |
| `guardarObservacion` | `(id, tipo, texto)` | Busca el `recordId` en los registros derivados y actualiza `observations` | `void` | `console.error`. Si no hay registro, `setError` |
| `agregarNovedad` | objeto con 7 campos (2 no se usan) | Valida el tipo y las fechas; crea **una fila por día** del rango | `boolean` | `setError` (+ snackbar en la mutation) |
| `reportarEvento` | `(id, tipo, obs?)` | Crea en `com_event_reports` con la hora del servidor | `boolean` | Snackbar |
| `resetHorarios` | — | Invalida **todas** las queries de la app | — | Nadie la usa |
| `eliminarEmpleado` | `(_id)` | Nada | — | Se pasa a `EmployeeCard`, que la llama tras crear una novedad |

---

## 2. Cambios recientes que lo afectan

| Commit | Cambio en `useHorarios` |
|---|---|
| `8a19fc5` | `registrarEvento` recibe `metadata { latitude, longitude, accuracy, photo }` y la pasa a `createTimeRecord`. **Solo en la rama de crear** |
| `62a1271` | Mapeo con `keyPorLogType` (sin switch); estado con `MARCACIONES[].estadoResultante`; tipos `LogType`, `EventoTipo`, `TimeRecord[]` y `EventReportHoy[]` |
| `cd0c6af` | Nada directo. Las normas ahora se comprueban **antes** de la foto, en `EmployeeCard` |

---

## 3. Hallazgos de correctitud

| # | Hallazgo | Dónde | Consecuencia |
|---|---|---|---|
| **H1** | **`registrarEvento` atrapa el error y no lo relanza.** `TimeRecordVerificationModal` espera que `onConfirm` lance para mostrar el error, pero nunca lanza | `useHorarios.ts:270` | El modal se cierra como si se hubiera guardado; la **foto queda subida sin marcación**. "Sin almuerzo" registra el 2.º aunque falle el 1.º |
| **H2** | **La rama "ya existe" ignora `metadata`** | `useHorarios.ts:241-250` | Si se vuelve a marcar el mismo tipo el mismo día, la hora cambia, pero la foto y el GPS siguen siendo los de la primera marcación (o ninguno) |
| **H3** | **Registrar y editar van en la misma función.** Se decide por si hay `horaOverride`, y la decisión crear/actualizar sale de la **caché** `timeRecords` | `useHorarios.ts:233-238` | Con dos dispositivos, o con la caché sin refrescar, se crea un duplicado (B4). La rama de editar puede crear un registro nuevo sin foto |
| **H4** | **Hora manual:** `dayjs(horaOverride, 'hh:mm A')` toma la **fecha del dispositivo**, no la del servidor. Además, el formato solo se interpreta porque `customParseFormat` lo registra `AdapterDayjs` de MUI al cargar `EditHourModal`: en `src/` nadie lo extiende | `useHorarios.ts:226-228` | Un dispositivo con la fecha mal edita el día equivocado. Si se llamara sin haber cargado el picker, saldría `Invalid Date` (B3) |
| **H5** | **`store_id: STORE_ID as number`** cuando `STORE_ID` puede ser `null`: `createTimeRecord` cae en `store_id \|\| 90` | `useHorarios.ts:254`, `:353`, `:377` | Marcaciones, novedades o eventos guardados en la **tienda de pruebas** (B2) |
| **H6** | Al actualizar, `observations: observacion` **sobrescribe** la observación con `''` si no se pasa ninguna | `useHorarios.ts:248` | Se pierde la observación anterior al editar sin texto |
| **H7** | `guardarObservacion` y `registrarEvento` **no devuelven nada**; `setError` deja un mensaje pegado en la página que solo se limpia en la siguiente acción | `useHorarios.ts:296`, `:44` | El error se muestra fuera de contexto y tarde |
| **H8** | `error` devuelve **"Sincronizando..."** si falla cualquier query. Además, la mayoría de las `queryFn` devuelven `[]` ante un error, así que casi nunca falla ninguna | `useHorarios.ts:469-471` | Un fallo real de red se ve como una lista vacía |
| **H9** | `eliminarEmpleado` está vacía y `resetHorarios` no tiene consumidores | `useHorarios.ts:305-311` | Ruido (fase 0) |
| **H10** | `agregarNovedad` no limita el rango: un rango de un año crea 365 filas en una sola petición | `useHorarios.ts:345-356` | Riesgo de error o de timeout (§8 de MEJORAS) |

---

## 4. Rendimiento

| # | Hallazgo | Impacto |
|---|---|---|
| **P1** | **Todo consumidor paga 7 queries.** `DetallePlanillaPage` solo quiere `reasons` y descarga empleados, novedades, marcaciones y eventos de `firstStoreId` | Peticiones inútiles en Planilla |
| **P2** | **Sin `useMemo`.** `empleadosMapeados` recorre `timeRecords` y `eventReportsToday` por cada empleado (O(E×R)) en **cada render**, y `idsConNovedadHoy.includes` es O(E×N). Con 100 empleados y 400 registros son unas 40 000 comparaciones por render, y cualquier `useState` de la página lo vuelve a lanzar | Tarjetas re-renderizadas; las acciones son funciones nuevas en cada render |
| **P3** | **`novedades` descarga todo el histórico de la tienda** (`limit: -1`, con `employee_id.*`, `store_id.*` y `newness_id.*`) para saber quién tiene novedad **hoy** | Crece sin límite. Registros solo necesita `report_date = hoy` |
| **P4** | `timeRecords` trae nombre, documento y tienda de cada empleado en cada registro, y Registros no los usa. **No trae** `latitude`/`photo` | Más payload. La evidencia no está disponible para un visor (G6) |
| **P5** | `timeRecords`, `novedades` y `eventReportsToday` tienen `staleTime: 0` y refetch al volver a la pestaña | Cada vuelta a la pestaña dispara 3 peticiones (es aceptable para "hoy", pero no está decidido) |
| **P6** | Las invalidaciones son amplias: `['timeRecords']` invalida **todas** las tiendas y fechas (también las de Monitoreo y Planilla), y `['empleados']` todas las tiendas | Peticiones en cascada en vistas de administración |

---

## 5. Tipos y calidad

- `any` en: `novedadesDB: any[]`, `nov: any` (×3), `reportes: any[]`, `onSuccess(data: any)`, `onError(err: any)` (×3), `catch (err: any)` (×5).
- La firma de `metadata` está repetida en `useHorarios`, `EmployeeCard` y `create.ts`; `VerificationData` ya existe.
- **El mapeo de novedades se hace dos veces:** `getNovedades` ya calcula `empleadoNombre`, `tipo`, `observaciones` y `tiendaNombre`, y `novedadesMapped` lo repite con fallbacks. La segunda rama solo se usa cuando `empleadoNombre` es `'Empleado #…'`.
- `TipoNovedad` tiene `name` y `nombre` con el mismo valor, y por eso `agregarNovedad` compara con los dos.
- `idsConNovedadHoy` compara ids como `string` y `empleadosMapeados` como `number`.
- Las query keys son literales sueltos (`['empleados', STORE_ID]`, `['timeRecords', STORE_ID, hoy]`…), repetidos en otros 4 archivos que invalidan.

---

## 6. Propuesta: partirlo detrás de una fachada

### 6.1 Estructura

```
hooks/registro/
├── keys.ts                    horariosKeys: empleados(store), timeRecords(store, fecha), eventosHoy(store, fecha), novedades(store), …
├── useTiendaActual.ts         STORE_ID (override ?? readMe)                        1 query
├── useCatalogosHorarios.ts    reasons, tiposNovedad                                2 queries, compartidas
├── useAsistenciaHoy.ts        empleados + timeRecords + eventos + novedades de HOY  4 queries
│                              → EmpleadoAsistencia[] con useMemo, usando domain/registro/mapeo.ts y estado.ts
├── useAccionesRegistro.ts     registrar / editarHora / observar / reportarEvento → Resultado
└── useNovedadesTienda.ts      novedades (histórico) + NovedadMapeada[]            para NovedadesSeccion

hooks/useHorarios.ts           FACHADA: compone los anteriores y devuelve exactamente lo de hoy
```

### 6.2 Contrato de acciones (detalle de la fase 3 de MEJORAS)

```ts
type Resultado = { ok: true; id?: number } | { ok: false; error: string };

registrar(input: {
	empleadoId: number;
	marcacion: LogType;
	verificacion?: VerificationData;   // foto + GPS, el mismo tipo del modal
	observacion?: string;
}): Promise<Resultado>;                // SIEMPRE crea; si ya existe → { ok:false, error:'ya registrada' }

editarHora(input: {
	recordId: number;                  // el id ya está en registros.ids: no se busca en la caché
	hora: string;                      // 'HH:mm', se combina con la fecha del registro (no la del dispositivo)
	motivoId: number;
	observacion?: string;              // undefined = no tocar
}): Promise<Resultado>;

observar(input: { recordId: number; texto: string }): Promise<Resultado>;
reportarEvento(input: { empleadoId: number; tipo: EventoTipo; observacion?: string }): Promise<Resultado>;
```

Con este contrato:

| Hallazgo | Cómo queda |
|---|---|
| H1 | `registrar` devuelve `{ ok:false }`. La fachada **lanza** para el modal de foto, así que el modal muestra el error y no se cierra |
| H2, H3 | Registrar siempre crea con su verificación; editar actualiza por `recordId`. Ya no se busca en la caché |
| H4 | `editarHora` usa la fecha del registro y `'HH:mm'` sin `customParseFormat` |
| H5 | Sin tienda → `{ ok:false, error:'Sin tienda' }`. Se quita el `\|\| 90` de `create.ts` |
| H6 | `observacion` `undefined` no se envía |
| H7 | Cada acción devuelve su error; desaparece el `setError` global |

### 6.3 Compatibilidad: la fachada

`useHorarios(storeOverride)` sigue devolviendo **los mismos nombres y firmas**:
- `registrarEvento(id, tipo, hora?, obs?, reasonId?, metadata?)` elige `editarHora` si hay `hora` y `registrar` si no, y **lanza** si `!ok`.
- `guardarObservacion`, `agregarNovedad` y `reportarEvento` mantienen su retorno actual.

Así `RegistrosPage`, `ModalDetalleTienda`, `NovedadesSeccion` y `DetallePlanillaPage` no cambian en el mismo PR. Después se migran de uno en uno:

| Consumidor | Pasa a usar | Queries |
|---|---|---|
| `DetallePlanillaPage` | `useCatalogosHorarios().reasons` | 7 → **1** |
| `NovedadesSeccion` | `useNovedadesTienda(store)` | 7 → 2–3 |
| `ModalDetalleTienda` | `useAsistenciaHoy(store)` + catálogos | 7 → 5 |
| `RegistrosPage` | `useAsistenciaHoy` + `useAccionesRegistro` | 7 → 6, con novedades solo de hoy |

---

## 7. Plan de trabajo (en orden)

Cada paso se puede commitear solo. Salvo donde se indica, **no cambia nada visible**.

| Paso | Qué | Resuelve | Comprobación |
|---|---|---|---|
| **1** ✅ | Quitar `eliminarEmpleado`/`onEliminarEmpleado` y `resetHorarios`; borrar los `console.log` (con tu visto bueno) | H9 | `tsc` igual |
| **2** ✅ | `domain/registro/mapeo.ts` (`mapearRegistros(records)`) y `estado.ts` (`calcularEstado(registros)`); `useHorarios` los usa dentro de `useMemo`, con índices `Map<empleadoId, …>` en vez de `filter` por empleado | P2, fase 2 | Mismo estado en las 16 combinaciones (ya verificado en la fase 1); primeros tests unitarios |
| **3** ✅ | `hooks/registro/keys.ts` y uso de las keys en `useHorarios` y en los 4 archivos que invalidan | P6, §5 | Las invalidaciones apuntan a la tienda y la fecha concretas |
| **4** ✅ | `useCatalogosHorarios` y `DetallePlanillaPage` lo usa | P1 | Planilla: 1 request en lugar de 7 |
| **5** ✅ | `useAccionesRegistro` con `Resultado`; la fachada lanza ante un error | H1, H5, H7 · *visible: el modal de foto muestra el error en vez de cerrarse* | Error simulado en `createTimeRecord`: el modal sigue abierto con el mensaje |
| **6** ✅ | Separar `editarHora` (por `recordId`, hora `'HH:mm'` sobre la fecha del registro) | H2, H3, H4, H6 | Editar en un dispositivo con la fecha cambiada no mueve el día |
| **7** | Novedades de Registros solo de hoy; `useNovedadesTienda` para la sección | P3, §5 (doble mapeo) | Registros no descarga el histórico |
| **8** | Limitar el rango de `agregarNovedad` *(regla de negocio por decidir)* | H10 | — |

Los pasos 2 y 5 son los que más aportan: el 2 desbloquea la fase 2 y el 5 cierra el agujero de la foto sin marcación.

---

## 8. Preguntas abiertas

- [x] **Se rechaza** (decidido el 2026-10-14). Si una marcación ya existe, ¿se rechaza (propuesta) o se sobrescribe como hoy? Define H2/H3 y depende de F3 de MEJORAS (¿varias marcaciones del mismo tipo por día?).
- [ ] ¿Se puede borrar la foto subida cuando el guardado falla (limpieza de huérfanos), o basta con no cerrar el modal?
- [ ] Rango máximo de una novedad (H10).
- [ ] ¿`timeRecords`, `novedades` y `eventosHoy` deben refrescarse al volver a la pestaña (P5)? Con varios dispositivos por tienda, probablemente sí.
