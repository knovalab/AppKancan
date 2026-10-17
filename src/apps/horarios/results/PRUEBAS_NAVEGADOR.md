# Pruebas en el navegador — App de Horarios

> **Fecha:** 2026-10-16, sobre `setup` @ `d751023`.
> **Alcance:** todo lo cambiado desde `23d35de`. **Novedades de esta versión** frente a la guía del 2026-10-15 (`295d825`):
> - `d95ef98` — **lazy loading:** secciones, tour, modales de detalle, mapa y librerías de Excel se cargan bajo demanda → **§9**;
> - `513c730` — **tipos e interfaces:** coordenadas centralizadas, DTO, funciones de horas movidas, festivos unificados → **§10**;
> - `d751023` — **errores (camino A):** mensajes en español y respuestas de la API tipadas → **§11**. Cambia el **texto esperado** de los casos de fallo del §3.
>
> **Cómo usarla:** sigue las secciones en orden y marca cada caso en la tabla del §14. Las 🔴 son obligatorias antes de desplegar.

Prioridad: 🔴 comportamiento nuevo o corregido · 🟠 flujo principal (debe ser idéntico a antes) · 🟡 regresión y rendimiento.

---

## 0. Preparación

### 0.1 Entorno

```bash
npm install     # ⚠️ obligatorio: leaflet y @vladmandic/face-api están en package.json pero no siempre en node_modules
npm run dev     # vite --host, con HTTPS local (basicSsl): la cámara y el GPS lo exigen
```

- Abre `https://localhost:<puerto>/horarios` o, desde una tablet, `https://<IP-del-PC>:<puerto>/horarios`, y acepta el certificado.
- Concede permisos de **cámara** y **ubicación**.
- Para los casos de lazy loading (§9), prueba también con el **build de producción**: `npx vite build && npx vite preview --host`. En `dev`, Vite no genera los mismos chunks.

### 0.2 Usuarios (uno por rol)

| Rol | Cómo se reconoce | Para |
|---|---|---|
| **Tienda** con `temporal` | Sin políticas de admin, report ni area manager | §2–§5 |
| **Tienda** sin `temporal` | Igual, sin `temporal` | R3 |
| **Tienda** con política `demo` | — | §5 |
| **Admin** (política con `admin` + `horario`/`time_log`) | Ve todas las tiendas | §1, §7, §8, §10 |
| **Area manager** (`time_log` + `manager`/`area`) | Solo sus tiendas | §1, Planilla, Reporte semanal |
| **Report** | Política con `report` | §1, Reportes |
| *(Opcional)* Un rol **sin permiso** de lectura o escritura sobre una colección (p. ej. `com_newness_reports`) | Para provocar un 403 real | X2 |

### 0.3 Datos

- 3 o 4 empleados **sin marcaciones hoy** en una tienda de prueba (cada caso "gasta" marcaciones).
- Acceso a Directus: `com_time_records`, `com_rules_acceptance`, `com_event_reports`, `com_records_reasons`, `com_newness_reports`, `com_store_closed_days`, `directus_files`.
- ⚠️ **Comprueba que `com_time_records` tiene el campo `location`** (*geometry point*). Las marcaciones con foto envían `location: { type: 'Point', coordinates: [lon, lat] }`. Si no existe, **toda marcación con foto fallará** (R1).
- Para repetir un caso: borra las filas de **hoy** del empleado en `com_time_records` (y su aceptación en `com_rules_acceptance`) y pulsa F5.

### 0.4 DevTools

1. **Network** con **Preserve log**. Para §9, marca también **Disable cache** y usa el throttling *Slow 4G*.
2. **Simular fallos de red:** `Ctrl+Shift+P` → *Show Network request blocking* → *Enable* → `+` con el patrón del caso. Desmárcalo para desbloquear.
   - Una petición bloqueada llega a la app como `TypeError: Failed to fetch`. Desde `d751023` se muestra como **"Sin conexión con el servidor. Revisa la red e inténtalo de nuevo."**
3. **Console:** no debe aparecer `Uncaught (in promise)` ni `ChunkLoadError` en ningún caso.
4. **Application → Local Storage:** clave `activeBreakExpires_<idEmpleado>` (pausas) y los tokens de sesión.
5. *(Opcional)* **React DevTools → Profiler** con *Highlight updates*.

### 0.5 Mensajes de error esperados (desde `d751023`)

| Situación | Mensaje |
|---|---|
| Petición bloqueada o sin red | Sin conexión con el servidor. Revisa la red e inténtalo de nuevo. |
| 401 / token inválido | Tu sesión expiró. Vuelve a iniciar sesión. |
| Sin sesión o refresh fallido (`withAutoRefresh`) | Sesión no encontrada… / Sesión expirada… (y redirige a `/`) |
| 403 / `FORBIDDEN` | No tienes permiso para esta acción. |
| `RECORD_NOT_UNIQUE` | Este registro ya existe. |
| `FAILED_VALIDATION` / `INVALID_PAYLOAD` | Hay datos no válidos en la solicitud. |
| Marcación repetida (regla propia) | Esta marcación ya está registrada hoy. Para cambiar la hora usa "Editar hora". |

---

## 1. Navegación, roles y layout 🟠

| Caso | Pasos | Esperado |
|---|---|---|
| **N1** Pestañas por rol | Entra a `/horarios` con cada usuario del §0.2 | **Tienda:** Registros, Novedades, Historial · **Admin:** las anteriores + Monitoreo + Admin · **Area manager:** Monitoreo + Reporte · **Report:** Reporte. "Malla" no aparece |
| **N2** Redirección inicial | Abre `/horarios` y una ruta inexistente (`/horarios/xyz`) | Redirige a la primera sección del rol |
| **N3** Ruta prohibida | Con un usuario de tienda, escribe `/horarios/monitoreo` o `/horarios/admin` | Redirige a su sección inicial, sin pantalla en blanco |
| **N4** Subsecciones | Monitoreo (admin): Resumen y Auditoría; con area manager también Control de horas y Editar registros. Reporte: Marcaciones, Novedades, Pausas, Semanal | Cada subpestaña carga su vista; las de area manager **no** las ve el admin |
| **N5** Selector de tienda | Con admin o area manager, cambia de tienda en el header | La URL cambia a `?tienda=<id>` y se mantiene al recargar; el usuario de tienda **no** ve el selector |
| **N6** Tienda propia | Con un usuario de tienda, entra a Registros | Ve **su** tienda sin elegir nada (`readMe` → `store_id`, ahora tipado con `idRelacion`) |
| **N7** Header | Botones Normas, Tutorial y Actualizar | "Normas" abre el modal **de solo lectura**; "Actualizar" recarga los datos |

---

## 2. Registro: flujo de marcación 🟠

### R1 — Comenzar Jornada con normas aceptadas (camino feliz) 🔴

1. En un empleado sin marcaciones, pulsa **Comenzar Jornada**.

**Esperado:**
- Spinner breve (consulta de normas) y después el **modal de foto + GPS**.
- **GPS:** *"GPS asegurado (Precisión: ±N m)"*.
- **Rostro:** *Buscando rostro… → Rostro detectado → Rostro alineado*. La foto se toma sola o con **Tomar Fotografía**. Sin rostro: *"No se detectó un rostro en la fotografía…"*.
- **Confirmar** → el modal se cierra y aparece *Registro de "Comenzar Jornada" guardado con éxito*.
- **Tarjeta:** hora en la fila, chip **JORNADA INICIADA**, siguiente activo **Iniciar Almuerzo** y *"Pausa activa pendiente"*.

**Network:** `GET com_rules_acceptance` → `POST /files` → `GET com_time_records …limit=1` → `POST com_time_records`.

**En el payload, comprobar:**
- `store_id` de la tienda seleccionada (**no** 90);
- `photo` es un UUID;
- **`location.coordinates` = `[longitud, latitud]`** (Colombia: longitud ≈ −74, latitud ≈ 4). Desde `513c730` lo arma `aPunto()`;
- viene `accuracy`.

**Directus:** una sola fila, con `location` y `photo`.

### R2 — Comenzar Jornada sin normas aceptadas (usuario con `temporal`)

Borra la aceptación del empleado y recarga. La tarjeta muestra **⚠ ACEPTAR NORMAS**. Pulsa **Comenzar Jornada**.

**Esperado:** primero el **modal de normas** (obligatorio, no se cierra con Esc ni haciendo clic fuera). Al marcar las casillas y pulsar **ACEPTO**, se guarda y se abre la cámara. Al confirmar se registra la entrada y el botón "Aceptar normas" desaparece.

### R3 — Normas pendientes con un usuario **sin** `temporal`

Igual que R2, pero la tarjeta **no** muestra "Aceptar normas". Al pulsar "Comenzar Jornada" **sí** sale el modal de normas antes de la cámara.

### R4 — "Aceptar normas" desde la cabecera

**⚠ ACEPTAR NORMAS** → **ACEPTO**: se cierra, el botón desaparece y **no** se abre la cámara ni se registra nada.

### R5 — Almuerzos sin foto

**Iniciar Almuerzo** y **Finalizar Almuerzo** se registran directamente (spinner + snackbar verde). **Network:** no hay `POST /files`.

### R6 — Terminar Jornada con foto

Cámara **sin** normas → Confirmar → **JORNADA FINALIZADA**, *"Jornada completada"* y ningún botón activo.

### R7 — Marcación repetida (otra pestaña) 🔴

1. Pestaña B: **Comenzar Jornada**, con la cámara abierta.
2. Pestaña A: registra la entrada de ese empleado.
3. Pestaña B: foto → **Confirmar**.

**Esperado en B:** alerta en el modal y snackbar *"Esta marcación ya está registrada hoy. Para cambiar la hora usa 'Editar hora'."*; **no** hay `POST com_time_records`.

### R8 — Sin tienda (opcional)

Con un usuario sin tienda: *"No hay una tienda seleccionada…"* y **nada** se guarda en la tienda 90.

---

## 3. Fallos corregidos 🔴

> Desde `d751023`, en todos estos casos el snackbar o la alerta dicen **"Sin conexión con el servidor. Revisa la red e inténtalo de nuevo."** (petición bloqueada). Antes salía un texto genérico.

| Caso | Pasos | Esperado |
|---|---|---|
| **F1** Fallo al guardar con foto | Cámara → foto → bloquea `*com_time_records*` → **Confirmar**. Desbloquea → Confirmar | 1.º: modal abierto, alerta y snackbar con el mensaje de conexión; la tarjeta no cambia. 2.º: se guarda y cierra |
| **F2** Observación con fallo | Observación → escribe → bloquea `*com_time_records*` → **Guardar**. Desbloquea → Guardar | 1.º: mensaje de conexión y el modal sigue abierto **con el texto**. 2.º: se guarda y cierra |
| **F3** Aceptar normas con fallo | Modal de normas → bloquea `*com_rules_acceptance*` → ACEPTO. Desbloquea → ACEPTO | 1.º: mensaje de conexión y el modal sigue. 2.º: continúa a la cámara |
| **F4** Fin de pausa con fallo | Inicia una pausa → bloquea `*com_event_reports*` → espera a 0:00. Desbloquea y espera ≤ 30 s | Al vencer: el contador desaparece, **la clave sigue** en Local Storage, mensaje de conexión y la cabecera no suma. Al desbloquear: *Evento reportado con éxito*, la clave se borra y aparece *"Pausa activa 1 de 2 completada"* |
| **F5** "Sin almuerzo" con fallo | **Turno sin almuerzo** → bloquea `*com_time_records*` → Confirmar. Desbloquea → Confirmar | 1.º: mensaje de conexión, el modal sigue y no hay casillas omitidas. 2.º: dos snackbars verdes y **Terminar Jornada** activo |
| **F6** Editar hora con fallo | Reloj → hora + motivo → bloquea `*com_time_records*` → Guardar | Mensaje de conexión y el modal sigue; al desbloquear se guarda |
| **F7** Hora editada en otro día | Cambia la fecha del dispositivo a mañana y edita una hora de hoy | Se actualiza **la misma fila** (mismo `id` y `record_date`) |

---

## 4. Modales de la tarjeta 🟠

| Caso | Qué comprobar |
|---|---|
| **M1** Observación | Reloj y observación **deshabilitados** en las marcaciones no registradas (*"No disponible"*). Texto guardado precargado y "Guardar" deshabilitado hasta que cambies algo. Tooltip *"Observación: …"*. **Reapertura limpia:** escribe sin guardar, Cancelar, reabre → aparece el texto **guardado** |
| **M2** Editar hora | Guardar → *Registro actualizado correctamente*. El reloj queda deshabilitado (*"Esta hora ya fue editada…"*). **Network:** `PATCH com_time_records/<id>` con `record_time` en 24 h (`12:15 AM` → `00:15:00`, `12:15 PM` → `12:15:00`) + `com_records_reasons` |
| **M3** Novedad | Solo con la entrada pendiente. Validaciones (tipo y fechas obligatorios, fin ≥ inicio, 300 caracteres). **Festivos** marcados que cambian con el año. Guardar → *Novedad registrada con éxito* y **la tarjeta desaparece**. `date.nager.at` sale **al abrir** el modal |
| **M4** Pausa activa | Icono activo solo con la jornada en curso, sin pausa en curso y con pausas disponibles. Tooltips: *"Iniciar Pausa Activa"*, *"No disponible"*, *"Pausas activas completadas (2 de 2)"*. Durante la pausa **todas** las marcaciones están deshabilitadas |
| **M5** Pausa: F5 y otra pestaña | F5 → el contador vuelve con el **tiempo restante**. Una pausa iniciada en otra pestaña aparece sin recargar |
| **M6** Sin almuerzo | Solo en la fila de Iniciar Almuerzo cuando es la siguiente. Confirmar bloquea las dos casillas |

---

## 5. Demo y tour 🟡

| Caso | Qué comprobar |
|---|---|
| **D1** Tarjeta demo | En *USUARIO DE EJEMPLO*, Comenzar Jornada se registra **al instante**, sin normas ni cámara. Observación, editar hora, novedad y evento funcionan **sin** peticiones a `com_time_records`, `/files`, `com_rules_acceptance` ni `com_event_reports` |
| **D2** Pausa demo | **Terminar Demo** la cierra y suma 1. No aparece `activeBreakExpires_99999` en Local Storage |
| **D3** Tour | El tutorial resalta `tour-employee-card`, `tour-marcacion`, `tour-novedad-btn` y `tour-evento-btn`. ⚠️ Ver también **L2** (§9): el tour ahora se carga bajo demanda |
| **D4** Demo + reales | Con la demo activa, una tarjeta **real** sigue pidiendo normas y cámara |

---

## 6. Evidencia: fotos, GPS y mapas 🔴

Prepara 2 o 3 marcaciones **con foto** (R1, R6) y alguna **sin** foto (almuerzos).

| Caso | Pasos | Esperado |
|---|---|---|
| **E1** Detalle de una marcación | Historial → pulsa una hora con foto | Foto **difuminada**; **Ampliar imagen** (lightbox difuminado); observación o *"Sin observaciones adicionales…"*; GPS con *"Precisión: ±N m"*; chip **Admin** si eres admin. **Ver mapa en vivo** → marcador en el punto; **Abrir en Google Maps** → mismas coordenadas. Una hora de almuerzo no muestra una imagen rota ni un mapa vacío |
| **E2** Jornada completa | Historial → ojo (**Ver jornada completa**) | *"Jornada Diaria"* con las 4 marcaciones en orden y su color, miniaturas difuminadas, total de horas y tienda |
| **E3** Reportes sin difuminar | Reporte → Marcaciones → detalle | La misma foto **sin difuminar** |
| **E4** Monitoreo: historial del empleado | Monitoreo → Resumen → tienda → historial de un empleado | Miniatura y vista ampliada. ⚠️ Sale **sin difuminar** (H3) |
| **E5** Reporte semanal: día | Reporte → Semanal → empleado → día | Observaciones del día; al cerrar un día abierto desde *Festivos*, vuelve a festivos. ⚠️ Sin fotos ni GPS (H5) |
| **E6** Marcaciones antiguas | Una marcación hecha **entre `8a19fc5` y `4f720eb`** | Se ve la foto. El GPS probablemente **no** aparece (H4) |
| **E7** Privacidad del difuminado *(prueba de seguridad de la propia app)* | Copia la URL de una miniatura difuminada y ábrela **sin** `transforms=…` | **Deseable:** que no se vea la original. **Probable hoy:** sí se ve, y la URL lleva `access_token` (H2) |
| **E8** Token caducado | Deja que caduque la sesión y abre otra foto | Carga; una imagen rota indica una URL con un token viejo |

**Coordenadas (desde `513c730`):** en E1, E2 y E4 el marcador y Google Maps deben apuntar **al mismo sitio que antes**. Ahora las lee `coordenadasDe()` en un único punto; si el marcador cae en el océano o en otro país, se invirtieron latitud y longitud.

---

## 7. Otras secciones (regresión) 🟡

| Caso | Dónde | Esperado |
|---|---|---|
| **O1** Detalle de tienda | Monitoreo → Resumen → abrir una tienda | Tabla con estados, horas del día y de la semana como antes; editar una hora se guarda y refresca |
| **O2** Calendario de tienda | Mismo detalle → calendario | Colores por día como antes (`EstadoDia` movido) |
| **O3** Planilla | Monitoreo → Editar registros (area manager) | Carga y edita horas. Al abrir **no** salen `com_event_reports` ni `com_newness?fields=id,name` |
| **O4** Auditoría y ranking | Monitoreo → Auditoría; ranking de empleados y tiendas | Lista de ediciones con su motivo; el ranking cuenta igual por empleado (`RegistroEditado`) |
| **O5** Novedades | Sección Novedades | Lista igual: nombre, documento, tipo, tienda y estado activo |
| **O6** Historial | Buscar, cambiar rango, paginar, **Exportar** | Funciona; el Excel tiene las columnas de siempre |
| **O7** Reportes | Marcaciones, Novedades, Pausas, Semanal + exportaciones | Cargan y exportan como antes |
| **O8** Admin | Buscar, crear y editar un empleado, ver su perfil (marcaciones, novedades y eventos), eliminar una novedad | Todo como antes |
| **O9** Cierre masivo | Monitoreo → Cierre masivo de tiendas | El calendario marca los **festivos** (ahora con `useHolidays`); cerrar y reabrir días funciona |
| **O10** Login | Cerrar sesión y entrar | Funciona |

---

## 8. Rendimiento 🟡

| Caso | Qué comprobar |
|---|---|
| **P1** Pausa activa | Profiler: durante una pausa solo se resalta el **contador** cada segundo |
| **P2** Modales | Abrir y cerrar un modal no re-renderiza las filas de **otras** tarjetas |
| **P3** Normas en Registros | **Una** sola petición a `com_rules_acceptance` (con `_in`) para toda la tienda; ninguna sin `temporal` |
| **P4** Mapa | Desplegar y plegar el mapa varias veces no duplica mapas ni da errores de Leaflet |
| **P5** Carga inicial | Al entrar a Registros **no** se descargan los chunks de Leaflet, ExcelJS ni del tour (ver §9) |

---

## 9. Lazy loading (`d95ef98`) 🔴

Prueba con **Disable cache** + *Slow 4G* y, si puedes, con el build de producción (§0.1).

| Caso | Pasos | Esperado |
|---|---|---|
| **L1** Secciones | Entra a Registros y cambia a Novedades, Historial, Monitoreo y Reporte | Cada sección muestra el **spinner** mientras se descarga su chunk y luego se pinta. Registros (la de entrada) no espera |
| **L2** Tour en frío | Recarga sin caché y lanza el **tutorial** desde Registros | El tour arranca (puede tardar un instante, porque `HorariosTour` es lazy) y **las fases de Novedades e Historial encuentran sus elementos**. Antes estaban importadas directamente porque el tour las necesitaba en el DOM; ahora se precargan al iniciar el tour. ⚠️ Si un paso queda "colgado" o resalta la nada, el prefetch no llegó a tiempo |
| **L3** Modales de detalle | Historial → primera vez que abres el detalle de una marcación y la jornada completa | Se abren con un instante de retraso la **primera** vez (`fallback={null}`, no se ve nada mientras carga); las siguientes, al momento |
| **L4** Mapa | Primera vez que pulsas **Ver mapa en vivo** | Aparece un **recuadro gris animado** y luego el mapa |
| **L5** Exportaciones | Primera exportación de la sesión (Historial, Reportes) | Se descargan los chunks de `exceljs` y `file-saver` y el Excel se genera igual que antes |
| **L6** Chunk sin red 🔴 | Con la app ya cargada, activa **Offline** y abre por primera vez el mapa, un modal de detalle o una exportación | **Hoy no hay manejo:** el `import()` falla. Anota qué se ve: pantalla del `ErrorBoundary` global, nada o un error en la consola (H8) |
| **L7** Nueva versión desplegada | Con la app abierta, despliega una versión nueva y navega a una sección no visitada | Si el chunk antiguo ya no existe, aparece un error de carga (H8) |

---

## 10. Reestructuración de tipos (`513c730`) 🟠

No cambia el comportamiento; estos casos cubren el código **movido**.

| Caso | Qué se movió | Dónde probar | Esperado |
|---|---|---|---|
| **T1** Coordenadas | `aPunto` / `coordenadasDe` (`domain/ubicacion.ts`) | R1 (payload), E1, E2, E4 | `[lon, lat]` en el guardado; el mapa en el mismo punto que antes |
| **T2** Horas trabajadas | `calcularMinutosDia` y `calcularMinutosSemanales` → `utils/horasTrabajadas.ts` | O1 (horas del día y de la semana), Reporte → Semanal y su exportación | Mismas horas que antes |
| **T3** Filas de detalle | `FilaEmpleadoDetalle`, `EstadoDia` | O1, O2, historial del empleado (E4) | Igual |
| **T4** Planilla | `FilaEmpleadoPlanilla` | O3 | Igual |
| **T5** Festivos | `ModalCierreMasivo` usa `useHolidays` | O9 | Festivos marcados. **Diferencia:** sin red, la consulta de festivos reintenta y puede dejar errores en la consola, pero el calendario se ve sin festivos igual que antes |
| **T6** Tiendas en el cierre masivo | `TiendaOpcion` | O9 | La lista de tiendas se ve igual |

---

## 11. Errores y respuestas de la API (`d751023`) 🔴

| Caso | Pasos | Esperado |
|---|---|---|
| **X1** Sin red al guardar | Cualquier escritura (marcar, observar, editar hora, novedad, aceptar normas, cerrar un día, eliminar una novedad en Admin) con su colección bloqueada | *"Sin conexión con el servidor…"*, en español y sin el texto genérico de antes |
| **X2** Sin permiso (403) | Con el rol sin permiso del §0.2, intenta guardar en esa colección | *"No tienes permiso para esta acción."* (antes, el texto en inglés de Directus) |
| **X3** Sesión | En Application → Local Storage, borra los tokens y luego guarda algo | Mensaje de sesión (*"Sesión no encontrada…"*) y redirección a `/`. Antes, el genérico *"Error al crear registro de tiempo"* |
| **X4** Duplicado | Si existe un índice único en Directus (p. ej. sobre la aceptación de normas), provoca el duplicado | *"Este registro ya existe."* |
| **X5** Exportaciones con fallo | Bloquea `*com_time_records*` / `*com_newness_reports*` / `*com_event_reports*` y exporta desde Reportes | Mensaje concreto. ⚠️ En el **diálogo unificado**, registros, novedades y pausas siguen mostrando su texto fijo (*"Error al exportar …"*), porque no usaban el error. El semanal sí da el mensaje concreto |
| **X6** Admin | Busca un empleado con la red bloqueada; edita uno con la red bloqueada | *"Sin conexión…"* en los dos |
| **X7** IA | Admin → nuevo empleado → separar un nombre con IA, con y sin red | Funciona igual; los errores de la IA se muestran como antes |
| **X8** Cámara | Deniega el permiso de cámara en el navegador y abre el modal de foto | *"Permiso de cámara denegado…"* (el `name` del error ya no se lee con `any`) |
| **X9** Lecturas que fallan 🟡 | Bloquea `*com_newness_reports*` y abre Novedades | **Comportamiento sin cambios (camino A):** la lista sale **vacía** y no hay mensaje. Es lo esperado hasta aplicar el camino B (H9) |
| **X10** Novedades (mapeo unificado) | Novedades y Registros (los empleados con novedad hoy desaparecen) | Igual que antes: nombre, documento, tipo y tienda |
| **X11** Detalle de novedad en Monitoreo | Detalle de tienda → chip de novedad de un empleado | Se abre el detalle de esa novedad (`novedadId` numérico, ahora con el tipo correcto) |

---

## 12. Hallazgos para confirmar

| # | Hallazgo | Dónde | Caso |
|---|---|---|---|
| H1 | Las marcaciones con foto dependen del campo `location` (geometry) | `api/directus/create.ts` | §0.3, R1 |
| H2 | El difuminado va en la URL y no protege la original; la URL lleva `access_token` | `utils/directusAssets.ts` | E7 |
| H3 | El historial de Monitoreo y Reportes muestran la foto sin difuminar; la sección Historial, difuminada | `HistorialHorasModal`, `HistorialTimelineView` | E3, E4 |
| H4 | Las marcaciones antiguas con `latitude`/`longitude` probablemente no muestran el GPS (solo se pide `location`) | `read.ts`, `useHistorial` | E6 |
| H5 | El detalle de día del Reporte semanal no recibe fotos ni GPS | `ReporteSemanalAreaManager` | E5 |
| H6 | Las teselas del mapa vienen de `tile.openstreetmap.org` (servicio externo; ojo con la CSP) | `attendance/LeafletMap.tsx` | E1 |
| H7 | Dependencias en el lockfile pero no instaladas (`leaflet`, `face-api`) | `package.json` | §0.1 |
| **H8** | **Los `lazy()` no tienen manejo de fallo de carga:** sin red o tras un despliegue, el `import()` falla y lo recoge el `ErrorBoundary` global, o nada si el fallo ocurre en un modal | `routes.tsx`, `HorariosLayout`, `HistorialPage`, `AttendanceGpsAccordion` | L6, L7 |
| **H9** | Las lecturas siguen devolviendo una lista vacía ante un error (camino A no lo cambia) | `api/directus/read*.ts`, `reports.ts` | X9 |
| **H10** | El tour depende del **prefetch** de Novedades e Historial para encontrar sus elementos | `HorariosTourContext` | L2 |

---

## 13. Comprobaciones automáticas previas

```bash
npx tsc --noEmit -p tsconfig.json 2>&1 | grep "apps/horarios" | grep -v TS6133   # vacío
npm run test:horarios                                                            # 35 archivos, 264 tests en verde
npx vite build --logLevel error                                                  # OK
```

Estado al preparar la guía (`d751023`): las tres en verde.

---

## 14. Resumen de resultados

| Caso | Prio. | Resultado | Notas |
|---|---|---|---|
| N1–N7 Navegación y roles | 🟠 | ☐ OK ☐ Falla | |
| R1 Comenzar Jornada (foto, rostro, GPS, `location`) | 🔴 | ☐ OK ☐ Falla | |
| R2–R6 Normas, almuerzos y fin de jornada | 🟠 | ☐ OK ☐ Falla | |
| R7 Marcación repetida | 🔴 | ☐ OK ☐ Falla | |
| R8 Sin tienda | 🟡 | ☐ OK ☐ N/A | |
| F1–F7 Fallos corregidos (con el mensaje de conexión) | 🔴 | ☐ OK ☐ Falla | |
| M1–M6 Modales de la tarjeta | 🟠 | ☐ OK ☐ Falla | |
| D1–D4 Demo y tour | 🟡 | ☐ OK ☐ Falla | |
| E1–E2 Detalle, jornada y mapa | 🔴 | ☐ OK ☐ Falla | |
| E3–E6 Difuminado, Monitoreo, semanal, antiguas | 🟠 | ☐ OK ☐ Falla | |
| E7 Privacidad del difuminado | 🔴 | ☐ OK ☐ Falla | |
| E8 Token caducado | 🟡 | ☐ OK ☐ Falla | |
| O1–O10 Otras secciones | 🟡 | ☐ OK ☐ Falla | |
| P1–P5 Rendimiento | 🟡 | ☐ OK ☐ Falla | |
| L1–L5 Lazy loading | 🔴 | ☐ OK ☐ Falla | |
| L6–L7 Chunks sin red o tras un despliegue | 🔴 | ☐ OK ☐ Falla | |
| T1–T6 Código movido (tipos) | 🟠 | ☐ OK ☐ Falla | |
| X1–X8 Mensajes de error | 🔴 | ☐ OK ☐ Falla | |
| X9–X11 Lecturas y mapeos | 🟡 | ☐ OK ☐ Falla | |

**Si algo falla**, anota:
1. El caso y el paso.
2. El usuario o rol.
3. Una captura de Network (la petición y su respuesta).
4. Los errores de la consola.
5. La fila de Directus implicada.
