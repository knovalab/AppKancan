# `useHorarios` — Cambios aplicados

> **Fecha:** 2026-10-14, sobre `setup` @ `cd0c6af`. Cambios **sin commitear**.
> **Plan:** pasos 1 a 6 de [`analisis/USE_HORARIOS.md`](analisis/USE_HORARIOS.md) §7. Los pasos 7 (novedades solo de hoy) y 8 (rango máximo de novedad) quedan pendientes.
> **Decisión de negocio aplicada:** una marcación que ya existe **se rechaza** (pregunta 1 de §8).

---

## 1. Qué cambia para el usuario

| Antes | Ahora |
|---|---|
| Si fallaba el guardado, el modal de foto se cerraba como si hubiera ido bien y la foto quedaba subida sin marcación | El modal **sigue abierto con el error**, y "Confirmar" vuelve a intentarlo |
| Marcar un tipo que ya existía hoy (otro dispositivo o caché vieja) **sobrescribía la hora** sin foto | **Se rechaza** con *"Esta marcación ya está registrada hoy. Para cambiar la hora usa 'Editar hora'."* |
| "Sin almuerzo": si fallaba el 1.º, se registraba igual el 2.º y se marcaba como omitido | Se detiene en el 1.º que falla y el modal queda abierto para reintentar |
| Editar hora: si fallaba, el modal se cerraba igual | El modal queda abierto; el error sale en el snackbar |
| Editar hora con la fecha del dispositivo mal: podía crear un registro nuevo en otro día | Se edita **por id**, sobre la fecha del propio registro |
| Sin tienda resuelta, las marcaciones y los eventos se guardaban en la **tienda 90** | Se rechaza con *"No hay una tienda seleccionada…"* (también en novedades) |
| Planilla lanzaba 7 queries para usar solo los motivos | Lanza **1** |

Lo demás funciona igual: los mismos snackbars de éxito, los mismos estados y las mismas tarjetas.

---

## 2. Paso a paso

### Paso 1 — Código sin uso a `legacy/`

| Qué | De | A |
|---|---|---|
| `eliminarEmpleado` (función vacía) y `resetHorarios` (sin consumidores) | `hooks/useHorarios.ts` | `legacy/useHorarios.sinUso.ts` |
| `yaAceptoNormas`, `registrarAceptacionNormas` (aceptación por usuario; nadie las llamaba) | `api/directus/rules.ts` | `legacy/rules.aceptacionUsuario.ts` |
| Prop `onEliminarEmpleado` | `EmployeeCard` y `RegistrosPage` (×2) | Eliminada. Tras crear una novedad el empleado sale de la lista solo, porque la query de novedades se invalida |

Los `console.log` de `useAceptacionNormasEmpleados` **no se tocaron**.

### Paso 2 — Dominio puro y memorización

Archivos nuevos en `domain/registro/`:
- **`mapeo.ts`**
  - `mapearRegistros(marcaciones)`: filas de `com_time_records` → `RegistrosAsistencia`. Es el bucle que antes vivía dentro de `useHorarios`.
  - `agruparPorEmpleado(items, getId)`: agrupa en `Map<empleadoId, T[]>` en una sola pasada.
  - `MarcacionCruda`: lo mínimo que necesita de una fila, para no depender de la API.
- **`estado.ts`**
  - `calcularEstado(registros)`: el estado que deja la última marcación.
  - `yaRegistrada(registros, marcacion)`.

En `useHorarios`:
- `empleadosMapeados`, `empleados` e `idsConNovedadHoy` están en `useMemo`.
- Las marcaciones y las pausas se agrupan **una vez** por render de datos. Antes se filtraban por cada empleado en cada render: O(E×R), unas 40 000 comparaciones con 100 empleados.
- `idsConNovedadHoy` pasa de array a `Set` (`.has` en lugar de `.includes`).

**Verificación:** 5000 casos aleatorios (0–5 marcaciones, tipos repetidos, tipos desconocidos y horas editadas) comparando el código anterior con el nuevo: **0 diferencias** en registros y estado.

### Paso 3 — Query keys

- **`hooks/registro/keys.ts`** define `horariosKeys`, con **la misma forma que antes** (`['timeRecords', store, fecha]`…). Así las cachés existentes y las invalidaciones por prefijo siguen valiendo.
- **Literales sustituidos** por `horariosKeys.*` en: `useHorarios`, `ModalDetalleTienda`, `DetallePlanillaPage`, `useAdminEmpleados`, `DialogPerfilEmpleado`, `useHorariosAcceso`, `ExportEventosDialog` y `useHistorial`. Es el mismo valor; en esos archivos solo cambian el import y la línea.
- **Invalidaciones más precisas:** las acciones del registro invalidan solo **la tienda actual** (`timeRecords.tienda(store)`, `eventosHoy.tienda(store)`), y no todas las tiendas. Las de admin (`ModalDetalleTienda`, Planilla, perfil de empleado) siguen siendo amplias a propósito: editan registros de cualquier tienda.

### Paso 4 — Catálogos y tienda

- **`hooks/registro/useCatalogosHorarios.ts`**
  - `useCatalogosHorarios()`: `reasons` y `tiposNovedad`.
  - `useMotivosEdicion()`: solo `reasons`.
- **`hooks/registro/useTiendaActual.ts`**: la tienda recibida o, si no hay, la del usuario (`readMe`).
- **`DetallePlanillaPage`** usa `useMotivosEdicion()`: pasa de **7 queries a 1**. Se eliminó `firstStoreId`, que solo servía para eso.

### Paso 5 — Acciones con contrato `Resultado`

`hooks/registro/useAccionesRegistro.ts`:

```ts
type Resultado = { ok: true; id?: number } | { ok: false; error: string };

registrar({ empleadoId, marcacion, verificacion?, observacion? })   // siempre crea
editarHora({ recordId, hora, motivoId?, observacion? })             // actualiza por id
observar({ recordId, texto })
reportarEvento({ empleadoId, tipo, observacion? })
```

- **Ninguna acción lanza:** todas devuelven `Resultado` y muestran su snackbar (de éxito o de error).
- **Sin tienda** → `{ ok:false }`. Ya no se cae en `store_id || 90`.
  - El fallback **sigue en `create.ts`**, porque `ModalDetalleTienda` y `DetallePlanillaPage` también llaman a `createTimeRecord`. Quitarlo de ahí queda para cuando se migren.
- **`verificacion`** es el mismo tipo `VerificationData` del modal de foto. La firma de `metadata` ya no está repetida.

**La fachada `useHorarios`** mantiene los mismos nombres y firmas para los 4 consumidores:

| Función | Antes | Ahora |
|---|---|---|
| `registrarEvento(id, tipo, hora?, obs?, reasonId?, metadata?)` | `void`; tragaba el error | Con `hora` → `editarHora`; sin `hora` → `registrar`. **Lanza** si `!ok` |
| `guardarObservacion(id, tipo, texto)` | `void`; `setError` global | `Promise<boolean>`; error por snackbar |
| `reportarEvento(id, tipo, obs?)` | `boolean` | `boolean` (delegado) |
| `agregarNovedad(...)` | sin cambios | Ahora rechaza si no hay tienda |

**Quién recoge el error que lanza `registrarEvento`:**
- **Modal de foto:** ya tenía un `catch` que muestra el mensaje y no se cierra. En `EmployeeCard`, `pendingEvento` ya **no se limpia si falla**, para que "Confirmar" pueda reintentar. Lo limpia el `onClose` del modal.
- **`EditHourModal`:** ahora hace `try { await onConfirm(); onClose(); } catch {}`. Si falla, sigue abierto. Esto afecta también a `ModalDetalleTienda` y a Planilla: antes un error dejaba el modal abierto con una promesa rechazada sin capturar, y ahora queda abierto sin ese error en consola.
- **"Sin almuerzo"** (`handleConfirmarSinAlmuerzo`): tiene `catch`, así que se detiene en el primero que falla.

### Paso 6 — Registrar ≠ editar; marcación repetida = rechazo

**`registrar`:**
1. Mira la **caché del día**. Si ya existe → rechazo inmediato.
2. Consulta **Directus en el momento** con `getMarcacionExistenteId(empleado, log_type, fecha)`, una función nueva en `read.ts`. Si existe → rechazo y refresco de la caché. Esto cubre otro dispositivo o una caché vieja.
3. Si no existe, crea con foto y GPS. La fecha y la hora salen de `getRealColombiaTime()`.

**`editarHora`:**
- Recibe el `recordId`, que ya está en `registros.ids`, y no busca por fecha.
- La hora se convierte con `hora24()`, en `utils/format.ts` (`'08:05 PM'` → `'20:05:00'`). Antes se usaba `dayjs(hora, 'hh:mm A')`, que solo funcionaba porque el `AdapterDayjs` de MUI registra `customParseFormat`.
  - **Verificación de `hora24`:** 10 casos (12 AM/PM, 24 h, segundos e inválidos).
- `original_record_time` se toma del registro en caché (`original || record_time`), igual que antes.
- La observación solo se envía si se pasa.

---

## 3. Archivos

| Tipo | Archivo |
|---|---|
| Nuevo | `domain/registro/mapeo.ts`, `domain/registro/estado.ts` |
| Nuevo | `hooks/registro/keys.ts`, `useAccionesRegistro.ts`, `useCatalogosHorarios.ts`, `useTiendaActual.ts` |
| Nuevo (legacy) | `legacy/useHorarios.sinUso.ts`, `legacy/rules.aceptacionUsuario.ts` |
| Reescrito | `hooks/useHorarios.ts` (479 → 375 líneas; ahora es fachada) |
| Modificado | `EmployeeCard.tsx` (props, reintento, "sin almuerzo"), `EditHourModal.tsx` (try/catch), `RegistrosPage.tsx` (sin `onEliminarEmpleado`), `DetallePlanillaPage.tsx` (motivos), `read.ts` (`getMarcacionExistenteId`), `rules.ts` (funciones movidas), `utils/format.ts` (`hora24`), `domain/registro/index.ts` |
| Solo keys | `ModalDetalleTienda`, `DialogPerfilEmpleado`, `useAdminEmpleados`, `useHorariosAcceso`, `ExportEventosDialog`, `useHistorial` |

## 4. Verificación

- `tsc`: 0 errores nuevos en `apps/horarios`.
- `vite build`: OK.
- Biome: los archivos nuevos y los reescritos pasan sin errores. Quedan avisos:
  - `noConsole` en los `console.error`, que es la convención del proyecto.
  - 5 `any` en la parte de novedades de `useHorarios`, que corresponde al paso 7.
- **Falta probar en el navegador:**
  1. Marcar con foto: se guarda y el modal se cierra.
  2. Simular un fallo (Network → offline al pulsar "Confirmar"): el modal sigue abierto con el error, y al volver online "Confirmar" lo guarda.
  3. Marcar la misma entrada desde dos pestañas: la segunda se rechaza con el mensaje.
  4. Editar hora: se actualiza el mismo registro y el reloj queda bloqueado (editada).
  5. "Sin almuerzo" con red cortada: no marca el almuerzo como omitido.
  6. Planilla: en Network solo sale `com_reasons` de lo que antes pedía `useHorarios`.
  7. Novedades y el detalle de tienda en Monitoreo cargan igual que antes.

## 5. Pendiente y riesgos conocidos

- **Fotos huérfanas en dos casos:** el modal sube la foto **antes** de llamar a `registrar`, así que queda una foto sin marcación si (a) Directus rechaza por repetida desde otro dispositivo o (b) el guardado falla. Cada reintento sube otra foto. Para evitarlo habría que registrar primero y subir después, o borrar el archivo al fallar (pregunta 2 de §8).
- **La carrera entre dos dispositivos** en el mismo segundo sigue siendo posible. La solución definitiva es un índice único `(employee_id, log_type, record_date)` en Directus.
- **`create.ts` mantiene `store_id || 90`** para Monitoreo y Planilla.
- **Paso 7:** novedades solo de hoy en Registros, `useNovedadesTienda` y la eliminación del doble mapeo y de los `any`.
- **Paso 8:** rango máximo de una novedad (pendiente de negocio).
