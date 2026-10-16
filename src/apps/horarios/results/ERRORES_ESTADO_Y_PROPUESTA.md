# Manejo de errores en Horarios — Estado actual y caminos para estandarizarlo

> **Fecha:** 2026-10-15, sobre `setup` @ `667faf6` + los cambios de tipos sin commitear.
> **Contexto:** en la tarea anterior los `catch (err: any)` y el manejo de errores se dejaron **tal cual a propósito**. Este documento analiza ese estado y propone cómo estandarizarlo. **No se cambió código.**
> **Aplicado (2026-10-16):** camino A, más la eliminación de `any` en la API, los hooks y los `catch` → [`ERRORES_CAMINO_A_APLICADO.md`](ERRORES_CAMINO_A_APLICADO.md).
> **Alcance:** `src/apps/horarios/` (sin `legacy/` ni `__test__/`), más las dos piezas compartidas que intervienen: `auth/services/directusInterceptor.ts` (sesión) y `shared/components/SnackbarsPosition` (avisos).

---

## 0. Resumen

Un error de Directus puede acabar de **cinco formas distintas** según por dónde pase:
- un snackbar;
- una alerta dentro de un modal;
- el texto *"Sincronizando..."* arriba de la página;
- una lista vacía, como si no hubiera datos;
- solo un `console.error`.

No hay una regla común: cada capa, y a veces cada función, decide por su cuenta.

| Métrica | Valor |
|---|---|
| Bloques `catch` | **91**: 33 `catch (x: any)`, 46 `catch (x)` y 10 `catch {}` |
| Funciones de lectura de la API que **tragan** el error (devuelven `[]`, `null` o un valor por defecto) | **17** |
| Funciones de lectura que **propagan** el error | 11 |
| Escrituras que relanzan extrayendo `error?.errors?.[0]?.message` | 11, con esa extracción **copiada 13 veces** |
| `catch` fuera de la API que **solo** escriben en consola | **11** |
| `catch` vacíos | 4 |
| `console.error` | 66 |
| `useQuery` | 60, y **solo 4** leen `error`/`isError` |
| Configuración global de React Query para errores | **Ninguna** (`new QueryClient()` por defecto) |
| `ErrorBoundary` | Solo a nivel de router (toda la app) |

**Lo que ya está bien y sirve de modelo:**
- `hooks/registro/useAccionesRegistro` y `useAccionesTarjeta`: ninguna acción lanza, todas devuelven `Resultado` y avisan con un snackbar. Es el patrón a generalizar.
- `withAutoRefresh`: centraliza la renovación del token y la redirección por sesión expirada.
- `showSnackbar`: una sola API de avisos para toda la app (sobre Sileo).
- `docs/GUIA_ERRORES_DIRECTUS.md`: ya documenta los códigos de Directus (`FORBIDDEN`, `FAILED_VALIDATION`, `RECORD_NOT_UNIQUE`…).

---

## 1. Cómo viaja hoy un error

```
Directus (SDK)  →  { errors: [{ message, extensions: { code } }], response: { status } }
     │
     ▼
withAutoRefresh (auth/services/directusInterceptor.ts)
     ├─ sin sesión / refresh falla → borra tokens, window.location = '/' y lanza Error('Sesión …')
     ├─ 401 → refresca el token y reintenta una vez
     └─ cualquier otro error → lo deja pasar tal cual
     │
     ▼
api/directus/*  ── tres estrategias, sin regla común ────────────────────────────┐
     ├─ A. traga: console.error + return [] / null / valor    (17 lecturas)      │
     ├─ B. propaga sin tocar (no tiene catch)                 (11 lecturas)      │
     └─ C. relanza: new Error(error?.errors?.[0]?.message || 'texto')  (11 escrituras)
     │                                                                            │
     ▼                                                                            │
hooks / páginas                                                                    │
     ├─ useQuery: con A, la query "funciona" con [] → nunca hay isError ◄──────────┘
     ├─ useMutation onError: setError + snackbar (useHorarios)
     ├─ acciones con Resultado + snackbar (useAccionesRegistro / useAccionesTarjeta)  ✅
     ├─ try/catch en la página: snackbar, estado local, solo consola o nada
     └─ useHorarios.error → 'Sincronizando...' si falla cualquier query
     │
     ▼
UI
     ├─ snackbar (Sileo) ............ 57 llamadas en 13 archivos
     ├─ estado de error local ....... 25 setError / setSubmitError (alertas en modales y formularios)
     ├─ texto de página ............. 'Sincronizando...' (useHorarios)
     ├─ lista vacía ................. todas las lecturas de la estrategia A
     ├─ nada (consola) .............. 11 catch + 4 catch vacíos
     └─ ErrorBoundary ............... solo los errores de render, para toda la app
```

---

## 2. Inventario

### 2.1 API (`api/directus/`)

| Archivo | Traga (`[]`/`null`/valor) | Propaga sin `catch` | Relanza con mensaje |
|---|---|---|---|
| `read.ts` | 12 (8 `[]`, 2 `null`, 2 otro valor) | 6 (`fetchTimeRecords`, `getMarcacionExistenteId`, `getEmpleados`…) | 3 |
| `readBulk.ts` | 4 | 1 | 0 |
| `reports.ts` | 5 | 3 (las exportaciones) | 0 |
| `rules.ts` | 1 (`getNormasActivas` → `null`) | 1 (`getEmpleadosQueAceptaronNormas`, a propósito) | 1 |
| `create.ts` | 0 | 1 (`createStoreClosedDay`) | 11 |
| `upload.ts` | 0 | 0 | 1 |

**Ejemplos de "tragar":** `getTiposNovedad`, `getReasons`, `getNovedades`, `getStoreNovedades`, `getStoreEventReportsToday`, `getEmpleadosBulk`, `getStoreClosedDays`, `getRecordReasonId` (→ `null`) y `getStoreIdUsuarioActual` (→ `null`).

### 2.2 Hooks, páginas y componentes (fuera de la API)

| Qué hace el `catch` | Cuántos | Ejemplos |
|---|---|---|
| Avisa con snackbar | 19 | `useAccionesRegistro`, `useAccionesTarjeta`, `ModalDetalleTienda`, `DetallePlanillaPage`… |
| Estado de error local (alerta en el modal) | 7 | `TimeRecordVerificationModal`, diálogos de Admin |
| Relanza | 4 | `useHorarios.registrarEvento` (a propósito, para el modal de foto) |
| **Solo consola** | **11** | `MonitoreoPage.tsx:228` (calendario → `[]`), `DetallePlanillaPage.tsx:457` y `ModalDetalleTienda.tsx:362` (motivo), `useNormas.ts:45`, `useAceptacionNormasEmpleados.ts:101`, `timeSync.ts` ×2, `faceDetector.ts` ×4 |
| Vacío | 4 | `EditHourModal.tsx:132` (a propósito: el aviso lo da quien confirma), `useInAppCamera.ts:410`, `useParseNombreIA.ts:25`, `faceDetector.ts:335` |
| Otro (validación yup, etc.) | 6 | `DialogNuevoEmpleado`, `DialogEditarEmpleado` |

### 2.3 React Query

- `new QueryClient()` sin opciones:
  - **3 reintentos** para cualquier error, incluidos 403 y 400, que nunca se arreglan solos;
  - no hay ningún `onError` global;
  - no se usa `meta`.
- De 60 `useQuery`, solo 4 leen el error: `useHorarios` (que lo convierte en *"Sincronizando..."*), `useCatalogosHorarios`, `HistorialPage` (la única con un estado de error real en pantalla) y `MonitoreoPage`.

---

## 3. Problemas

| # | Problema | Efecto para el usuario | Ejemplo |
|---|---|---|---|
| **EE1** | **Lecturas que tragan el error** | Un fallo de red o de permisos se ve como *"no hay datos"*. No hay reintento ni mensaje | Si falla `getNovedades`, no aparece ninguna novedad y nadie se entera |
| **EE2** | **Tres estrategias en la misma capa** | Quien llama no sabe si tiene que capturar o no; hay capturas que no sirven | `getRecordReasonId` ya devuelve `null` ante un error y aun así `DetallePlanillaPage:457` y `ModalDetalleTienda:362` lo envuelven en otro `try/catch` |
| **EE3** | **El mensaje se extrae a mano** y no se traduce | Se muestra el texto en inglés de Directus (*"You don't have permission to access this."*) o uno genérico | `error?.errors?.[0]?.message \|\| '…'` copiado 13 veces; nunca se mira `extensions.code` |
| **EE4** | **Cinco canales de aviso** sin regla | El mismo tipo de fallo se ve distinto según la pantalla; hay riesgo de doble aviso | La mutation de `useHorarios` avisa y además quien la llama puede volver a avisar |
| **EE5** | **Fallos silenciosos en flujos de usuario** | El usuario no sabe que algo falló | El calendario de Monitoreo vacío (`MonitoreoPage:228`); el motivo de una edición sin cargar |
| **EE6** | **`catch (err: any)`** (33) | Se accede a `err.message`, `err.errors`… sin comprobación; un `throw 'texto'` o un error de red rompe la lectura | `useAdminEmpleados`, `ModalDetalleTienda`, `useInAppCamera`, toda la API |
| **EE7** | **La capa de datos navega** | `withAutoRefresh` hace `window.location.href = '/'`. Las lecturas que tragan devuelven `[]` justo antes de la redirección, así que se ve un parpadeo de "sin datos" | Sesión caducada mientras se ve Monitoreo |
| **EE8** | **React Query sin política** | Se reintentan 3 veces errores de permiso (más espera y ruido); no hay ningún lugar común para avisar | Una lectura con 403 tarda unos 7 s en fallar |
| **EE9** | **`ErrorBoundary` solo global** | Un error de render en una tarjeta o en un modal tumba toda la sección | Un campo inesperado en `HistorialEventoDetalle` deja en blanco el Historial |
| **EE10** | **Logs sin estructura** | 66 `console.error` con formatos distintos (emojis, sin contexto); no hay telemetría | Diagnosticar un fallo en producción depende de que el usuario abra la consola |

---

## 4. Caminos posibles

| | **A. Mínimo** | **B. Contrato por capa** *(recomendado)* | **C. Completo** |
|---|---|---|---|
| **Qué** | Una función `mensajeDeError(err)` en lugar de las 13 extracciones manuales + traducción de los códigos de Directus | A + una política fija por capa: la API **siempre lanza** un error normalizado; las queries los gestionan con React Query; las acciones devuelven `Resultado`; la UI tiene un canal por tipo de error | B + un logger central (`reportarError`) con contexto + `ErrorBoundary` por sección + telemetría (por ejemplo Sentry) |
| **Resuelve** | EE3, parte de EE6 | EE1–EE8 | EE1–EE10 |
| **Cambio visible** | Mensajes en español y coherentes | Las pantallas que hoy muestran "vacío" ante un fallo muestran **error + Reintentar** | Igual que B + secciones aisladas ante errores de render |
| **Riesgo** | Muy bajo | Medio: hay que decidir pantalla por pantalla qué se ve cuando falla | Medio + coste del servicio de telemetría |
| **Esfuerzo** | 2–3 h | 2–3 días por fases | B + 1–2 días |

### 4.1 Camino B en detalle

**Capa API:**
- Nunca devuelve `[]` por un error, salvo los **fallbacks documentados** (§5).
- Lanza siempre un `ErrorApp` normalizado:

```ts
// utils/errores.ts (o shared/, si otras apps lo adoptan)
export type CodigoError =
	| 'SIN_SESION' | 'SIN_PERMISO' | 'NO_ENCONTRADO' | 'VALIDACION' | 'DUPLICADO' | 'RED' | 'DESCONOCIDO';

export class ErrorApp extends Error {
	constructor(
		readonly codigo: CodigoError,
		mensaje: string,                // ya en español, para mostrar
		readonly status?: number,
		readonly causa?: unknown,       // el error original, para el log
	) { super(mensaje); }
}

/** Directus / fetch / cualquier cosa → ErrorApp. Usa los códigos de docs/GUIA_ERRORES_DIRECTUS.md. */
export function normalizarError(err: unknown, porDefecto = 'Ocurrió un error inesperado'): ErrorApp { … }

/** Texto para el usuario: el mismo en toda la app. */
export const mensajeDeError = (err: unknown, porDefecto?: string) => normalizarError(err, porDefecto).message;
```

| Código de Directus | `CodigoError` | Mensaje propuesto |
|---|---|---|
| `INVALID_CREDENTIALS`, `TOKEN_EXPIRED`, 401 | `SIN_SESION` | "Tu sesión expiró. Vuelve a iniciar sesión." |
| `FORBIDDEN`, `COLLECTION_FORBIDDEN`, 403 | `SIN_PERMISO` | "No tienes permiso para esta acción." |
| `RECORD_NOT_UNIQUE` | `DUPLICADO` | "Este registro ya existe." |
| `FAILED_VALIDATION`, `INVALID_PAYLOAD`, `FIELD_NOT_FOUND_IN_COLLECTION` | `VALIDACION` | "Hay datos no válidos: …" (con el campo, si viene) |
| `TypeError: Failed to fetch` / sin `response` | `RED` | "Sin conexión con el servidor. Revisa la red e inténtalo de nuevo." |

**Capa de queries (lecturas):** se configura `QueryClient` una sola vez.

```ts
new QueryClient({
	defaultOptions: {
		queries: {
			retry: (n, err) => n < 2 && ['RED', 'DESCONOCIDO'].includes(normalizarError(err).codigo), // no reintentar 4xx
		},
	},
	queryCache: new QueryCache({
		onError: (err, query) => {
			if (query.meta?.silencioso) return;   // las que manejan su error en pantalla
			showSnackbarGlobal(mensajeDeError(err), 'error');
		},
	}),
});
```

Las pantallas principales muestran el error **en su sitio**, con un componente común `<EstadoCarga cargando error onReintentar>`, y no con una lista vacía.

**Capa de acciones (escrituras):** se generaliza el patrón de `useAccionesRegistro`: ninguna acción lanza, todas devuelven `Resultado` y el mensaje sale de `mensajeDeError`. Las `useMutation` usan `meta.mensajeError` y un `MutationCache.onError` global, para que no haya doble aviso.

**Capa de UI: un canal por tipo de error**

| Tipo | Canal |
|---|---|
| Acción del usuario (guardar, marcar, editar) | Snackbar + el modal sigue abierto si falla (como ya hace la tarjeta) |
| Carga de una pantalla o de una tabla | Estado de error en el sitio + **Reintentar** |
| Validación de un formulario | Mensaje junto al campo (yup, como hoy) |
| Sesión | Redirección + un aviso único (lo dispara `withAutoRefresh` con un evento, no con navegación directa) |
| Error de render | `ErrorBoundary` de sección con "Recargar sección" |

**`catch`:** siempre `catch (err)`, con `unknown`. Se lee el error con `normalizarError(err)`, nunca con `err.algo`.

---

## 5. Fallbacks que deben seguir siendo silenciosos (decisiones conscientes)

Son casos en los que **no avisar** es lo correcto y deben quedar documentados en el código:

| Dónde | Comportamiento | Motivo |
|---|---|---|
| `useAceptacionNormasEmpleados.verificarAceptacion` | Ante un error, cuenta como "aceptó" | No bloquear la marcación por la red |
| `getNormasActivas` → `null` | Sin normas no se pide aceptación | Igual que el anterior |
| `timeSync.syncTimeWithServer` | Usa la hora del dispositivo | Degradación aceptable |
| `faceDetector` (4 catch) | Sin modelo, la detección automática se desactiva | La captura manual sigue funcionando |
| `EditHourModal` `catch {}` | El modal se queda abierto | El aviso ya lo dio quien confirma |
| `getRecordReasonId` → `null` | El selector abre sin motivo precargado | No bloquea la edición. Sobran los `try/catch` de quien la llama (EE2) |

Con el camino B, estos casos se marcan con `meta: { silencioso: true }` o con un comentario `// fallback:` que explique el motivo.

---

## 6. Plan por fases (camino B)

Cada fase es un commit. **E0–E2 no cambian nada visible**; desde E3 cambia lo que se ve **cuando algo falla** (nunca el camino feliz).

| Fase | Qué | Resuelve | Visible | Criterio |
|---|---|---|---|---|
| **E0** | `utils/errores.ts`: `ErrorApp`, `normalizarError`, `mensajeDeError`, tabla de códigos + tests | — | No | 100 % de cobertura de la tabla de códigos |
| **E1** | Sustituir las 13 extracciones `error?.errors?.[0]?.message` por `mensajeDeError` en `api/` y en las acciones | EE3 | Mensajes en español | `grep "errors?.\[0\]"` → 0 |
| **E2** | `QueryClient` con `retry` que no reintenta 4xx | EE8 | Los fallos de permiso aparecen antes | Un 403 falla en el primer intento |
| **E3** | **Lecturas:** la API deja de tragar (17 funciones) y propaga un `ErrorApp`, salvo los fallbacks del §5. Las pantallas principales (Registros, Historial, Monitoreo, Novedades, Reportes) muestran `<EstadoCarga>` con Reintentar | EE1, EE2, EE5 | **Sí:** error + Reintentar en lugar de vacío | Con la red cortada, cada pantalla muestra un error y no "sin datos" |
| **E4** | `QueryCache`/`MutationCache` `onError` global con `meta`; quitar los avisos duplicados | EE4 | Un aviso por fallo | Ningún fallo genera dos snackbars |
| **E5** | `catch (err: any)` → `catch (err)` + `normalizarError` (33 sitios) | EE6 | No | `grep "catch (\w*: any)"` → 0 |
| **E6** | `withAutoRefresh` emite un evento `sesion-expirada` y un listener en el layout redirige y avisa | EE7 | Un aviso de sesión claro | Ninguna lectura devuelve `[]` por una sesión caducada |
| **E7** *(camino C)* | `ErrorBoundary` por sección, `reportarError()` con contexto (usuario, tienda, sección) y telemetría | EE9, EE10 | Las secciones aisladas | Un error de render no tumba la app |

**Orden recomendado:**
1. **E0 → E1 → E2:** sin riesgo y con beneficio inmediato.
2. **E3**, pantalla por pantalla y con las pruebas de [`PRUEBAS_NAVEGADOR.md`](PRUEBAS_NAVEGADOR.md) bloqueando la red.
3. **E4–E6.**
4. **E7** si se quiere observabilidad en producción.

**Relación con la indicación anterior ("mantener los `any`"):** las fases E0–E4 **no requieren** tocar los `catch (err: any)`. Pueden convivir, porque `normalizarError` acepta `unknown`. La E5 es la que los cambia, y queda **a tu decisión**.

---

## 7. Riesgos

| Riesgo | Mitigación |
|---|---|
| E3 cambia la experiencia: donde antes se veía una lista vacía, ahora se ve un error | Hacerlo pantalla por pantalla y empezar por las de admin (Monitoreo, Reportes) antes que Registros (tiendas) |
| Más avisos al principio, porque aparecen fallos que antes estaban ocultos | Es información real. Revisar los logs la primera semana y ajustar `meta.silencioso` donde sea un fallback válido |
| `normalizarError` no reconoce un código | Cae en `DESCONOCIDO` con el mensaje por defecto y el original queda en `causa` para el log |
| `shared/` frente a `apps/horarios/` | Empezar en `apps/horarios/utils/errores.ts`; moverlo a `shared/` si otra app lo adopta |

---

## 8. Decisiones que necesito

- [ ] **¿Qué camino?** A (mínimo), **B (recomendado)** o C (con telemetría).
- [ ] **E3:** ¿se acepta que las pantallas muestren *error + Reintentar* en lugar de vacío? ¿Por cuál empezamos?
- [ ] **E5:** ¿cambiamos ya los `catch (err: any)` o seguimos manteniéndolos?
- [ ] **Telemetría (C):** ¿hay algún servicio previsto (Sentry u otro), o basta con la consola?
- [ ] **Alcance:** ¿solo Horarios, o `utils/errores.ts` nace en `src/shared/` para toda la app?
