# Pruebas en el navegador — App de Horarios

> **Fecha:** 2026-10-15, sobre `setup` @ `295d825` ("maps in details").
> **Alcance:** todo lo cambiado en la app desde `23d35de`: navegación, normas, foto + GPS con detección de rostro, tipos del dominio, `useHorarios`, tarjeta de empleado, detalle de registros con fotos y mapas.
> **Cómo usarla:** sigue las secciones en orden. Las 🔴 son obligatorias antes de desplegar. Marca cada caso en la tabla del §11.

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

### 0.2 Usuarios (uno por rol)

| Rol | Cómo se reconoce | Para |
|---|---|---|
| **Tienda** con `temporal` | Sin políticas de admin, report ni area manager | §2, §3, §4, §5 |
| **Tienda** sin `temporal` | Igual, sin `temporal` | R3 |
| **Tienda** con política `demo` | — | §6 |
| **Admin** (política con `admin` + `horario`/`time_log`) | Ve todas las tiendas | §1, §7, §8 |
| **Area manager** (`time_log` + `manager`/`area`) | Solo sus tiendas | §1, Planilla, Reporte semanal |
| **Report** | Política con `report` | §1, Reportes |

### 0.3 Datos

- 3 o 4 empleados **sin marcaciones hoy** en una tienda de prueba (cada caso "gasta" marcaciones).
- Acceso a Directus: `com_time_records`, `com_rules_acceptance`, `com_event_reports`, `com_records_reasons`, `directus_files`.
- ⚠️ **Antes de empezar, comprueba que `com_time_records` tiene el campo `location`** (tipo *geometry point*). Desde `4f720eb`, las marcaciones con foto envían `location: { type: 'Point', coordinates: [lon, lat] }` en lugar de `latitude`/`longitude`. Si el campo no existe, **toda marcación con foto fallará** (ver R1).
- Para repetir un caso: borra las filas de **hoy** del empleado en `com_time_records` (y su aceptación en `com_rules_acceptance`) y pulsa F5.

### 0.4 DevTools

1. **Network** con **Preserve log**.
2. **Simular fallos:** `Ctrl+Shift+P` → *Show Network request blocking* → *Enable* → `+` con el patrón del caso. Desmárcalo para desbloquear.
3. **Console:** no debe aparecer `Uncaught (in promise)` en ningún caso.
4. **Application → Local Storage:** clave `activeBreakExpires_<idEmpleado>` (pausas).
5. *(Opcional)* **React DevTools → Profiler** con *Highlight updates*.

---

## 1. Navegación, roles y layout (`23d35de`) 🟠

| Caso | Pasos | Esperado |
|---|---|---|
| **N1** Pestañas por rol | Entra a `/horarios` con cada usuario del §0.2 | **Tienda:** Registros, Novedades, Historial · **Admin:** las anteriores + Monitoreo + Admin · **Area manager:** Monitoreo + Reporte · **Report:** Reporte. "Malla" no aparece (deshabilitada) |
| **N2** Redirección inicial | Abre `/horarios` y una ruta inexistente (`/horarios/xyz`) | Redirige a la primera sección del rol |
| **N3** Ruta prohibida | Con un usuario de tienda, escribe `/horarios/monitoreo` o `/horarios/admin` | Redirige a su sección inicial, sin pantalla en blanco |
| **N4** Subsecciones | Monitoreo (admin): Resumen y Auditoría; con area manager también Control de horas y Editar registros. Reporte: Marcaciones, Novedades, Pausas, Semanal | Cada subpestaña carga su vista; las de area manager **no** las ve el admin |
| **N5** Selector de tienda | Con admin o area manager, cambia de tienda en el header | La URL cambia a `?tienda=<id>`; al recargar se mantiene; el usuario de tienda **no** ve el selector |
| **N6** Header | Botones Normas, Tutorial y Actualizar | "Normas" abre el modal **de solo lectura** (botón Cerrar); "Actualizar" recarga los datos |

---

## 2. Registro: flujo de marcación 🟠

### R1 — Comenzar Jornada con normas aceptadas (camino feliz)

1. En un empleado sin marcaciones, pulsa **Comenzar Jornada**.

**Esperado:**
- Spinner breve en el botón (consulta de normas) y después se abre el **modal de foto + GPS**.
- **GPS:** el banner muestra *"GPS asegurado (Precisión: ±N m)"*.
- **Detección de rostro:** *Buscando rostro… → Rostro detectado → Rostro alineado*. Con el rostro alineado la foto se toma sola (o con **Tomar Fotografía**). Sin rostro aparece *"No se detectó un rostro en la fotografía…"*.
- **Confirmar** → el modal se cierra y aparece el snackbar *Registro de "Comenzar Jornada" guardado con éxito*.
- **Tarjeta:** hora en la fila, chip **JORNADA INICIADA**, siguiente activo **Iniciar Almuerzo** y línea *"Pausa activa pendiente"*.

**Network:** `GET com_rules_acceptance` → `POST /files` → `GET com_time_records …limit=1` → `POST com_time_records`.

**En el payload, comprobar:**
- `store_id` es la tienda seleccionada (**no** 90);
- `photo` es un UUID;
- `location.coordinates` es `[longitud, latitud]` (en Colombia: longitud ≈ −74, latitud ≈ 4);
- viene `accuracy`.

**Directus:** una sola fila, con `location` y `photo`.

### R2 — Comenzar Jornada sin normas aceptadas (usuario con `temporal`)

1. Borra la aceptación del empleado y recarga. La tarjeta muestra **⚠ ACEPTAR NORMAS**.
2. Pulsa **Comenzar Jornada**.

**Esperado:**
- Primero el **modal de normas** (obligatorio: no se cierra con Esc ni haciendo clic fuera), **no** la cámara.
- Marca todas las casillas y pulsa **ACEPTO**: se guarda la aceptación, se abre la cámara y al confirmar se registra la entrada.
- El botón "Aceptar normas" desaparece.

### R3 — Normas pendientes con un usuario **sin** `temporal`

Igual que R2, pero la tarjeta **no** muestra "Aceptar normas". Al pulsar "Comenzar Jornada" **sí** sale el modal de normas antes de la cámara.

### R4 — "Aceptar normas" desde la cabecera

Con normas pendientes, pulsa **⚠ ACEPTAR NORMAS** → **ACEPTO**. Se cierra, el botón desaparece y **no** se abre la cámara ni se registra nada.

### R5 — Almuerzos sin foto

Pulsa **Iniciar Almuerzo** y después **Finalizar Almuerzo**. Se registran **directamente**, sin cámara ni normas: spinner y snackbar verde.

**Network:** no hay `POST /files`.

### R6 — Terminar Jornada con foto

Cámara **sin** pasar por normas → Confirmar → chip **JORNADA FINALIZADA**, banner *"Jornada completada"* y ningún botón activo.

### R7 — Marcación repetida (otra pestaña o dispositivo)

1. Abre la tienda en dos pestañas. En la B, pulsa **Comenzar Jornada** y deja la cámara abierta.
2. En la A, registra la entrada de ese empleado.
3. En la B, toma la foto y pulsa **Confirmar**.

**Esperado en B:** alerta en el modal y snackbar *"Esta marcación ya está registrada hoy. Para cambiar la hora usa 'Editar hora'."*; **no** hay `POST com_time_records`.

### R8 — Sin tienda (opcional)

Con un usuario sin tienda asignada, intenta marcar: snackbar *"No hay una tienda seleccionada…"* y **nada** se guarda en la tienda 90.

---

## 3. Fallos corregidos 🔴

| Caso | Pasos | Esperado | Antes |
|---|---|---|---|
| **F1** Fallo al guardar con foto | Abre la cámara, toma la foto, bloquea `*com_time_records*` y pulsa **Confirmar**. Desbloquea y vuelve a confirmar | 1.º: modal abierto + error + snackbar rojo, la tarjeta no cambia. 2.º: se guarda y cierra | El modal se cerraba y la foto quedaba subida sin marcación |
| **F2** Observación con fallo (E1) | Observación → escribe → bloquea `*com_time_records*` → **Guardar**. Desbloquea → Guardar | 1.º: snackbar rojo y el modal sigue abierto **con el texto**; el botón se bloquea mientras guarda. 2.º: se guarda y cierra | Se cerraba como si se hubiera guardado |
| **F3** Aceptar normas con fallo (E2) | En el modal de normas, bloquea `*com_rules_acceptance*` → ACEPTO. Desbloquea → ACEPTO | 1.º: snackbar rojo y el modal sigue. 2.º: continúa a la cámara | No se mostraba nada |
| **F4** Fin de pausa con fallo (E3) | Inicia una pausa (icono amarillo → *Iniciar Pausa Activa*). Bloquea `*com_event_reports*` y espera a 0:00. Desbloquea y espera ≤ 30 s | Al vencer: el contador desaparece, **la clave sigue** en Local Storage, snackbar rojo y la cabecera no suma. Al desbloquear: `POST` OK, *Evento reportado con éxito*, la clave se borra y aparece *"Pausa activa 1 de 2 completada"* | La pausa se perdía |
| **F5** "Sin almuerzo" con fallo | Icono naranja **Turno sin almuerzo** → bloquea `*com_time_records*` → Confirmar. Desbloquea → Confirmar | 1.º: snackbar rojo, el modal sigue y las casillas **no** quedan omitidas. 2.º: dos snackbars verdes y **Terminar Jornada** se activa | Registraba el 2.º aunque fallara el 1.º |
| **F6** Editar hora con fallo | Reloj → hora + motivo → bloquea `*com_time_records*` → Guardar | Snackbar rojo y el modal sigue; al desbloquear, se guarda | Se cerraba igual |
| **F7** Hora editada en otro día | Cambia la fecha del dispositivo a mañana y edita una hora de hoy | Se actualiza **la misma fila** (mismo `id` y `record_date`), sin crear una nueva | Podía crear un registro en otro día |

---

## 4. Modales de la tarjeta 🟠

| Caso | Qué comprobar |
|---|---|
| **M1** Observación | Reloj y observación **deshabilitados** en las marcaciones no registradas (*"No disponible"*). Con la marcación registrada: el texto guardado aparece precargado y "Guardar" está deshabilitado hasta que cambies algo. El tooltip muestra *"Observación: …"*. **Reapertura limpia:** escribe sin guardar, Cancelar, reabre → aparece el texto **guardado** |
| **M2** Editar hora | Reloj → hora + motivo → Guardar → *Registro actualizado correctamente*. El reloj queda deshabilitado con el tooltip *"Esta hora ya fue editada…"*. **Network:** `PATCH com_time_records/<id>` con `record_time` en 24 h (`12:15 AM` → `00:15:00`, `12:15 PM` → `12:15:00`) + `com_records_reasons` |
| **M3** Novedad | Solo activa con la entrada pendiente. Validaciones: Guardar deshabilitado sin tipo o fechas; *"La fecha fin debe ser igual o posterior a la de inicio"*; observaciones de más de 300 caracteres. Los **festivos** salen marcados y cambian al cambiar de año. Guardar → *Novedad registrada con éxito* y **la tarjeta desaparece**. **Network:** `date.nager.at` sale **al abrir** el modal, no al cargar la página |
| **M4** Pausa activa | Icono activo solo con la jornada en curso, sin pausa en curso y con pausas disponibles. Tooltips: *"Iniciar Pausa Activa"*, *"No disponible"*, *"Pausas activas completadas (2 de 2)"*. Durante la pausa (5:00 bajando) **todas** las marcaciones están deshabilitadas. Al terminar se reactivan y la cabecera suma 1 |
| **M5** Pausa: F5 y otra pestaña | Con una pausa en curso, F5 → el contador vuelve con el **tiempo restante**. Con dos pestañas, iniciar la pausa en una → aparece en la otra sin recargar |
| **M6** Sin almuerzo | El icono naranja solo aparece en la fila de Iniciar Almuerzo cuando es la siguiente marcación. Confirmar bloquea las dos casillas; el aviso *"solo se puede revertir llamando a soporte"* sigue igual |

---

## 5. Demo y tour 🟡

| Caso | Qué comprobar |
|---|---|
| **D1** Tarjeta demo | Activa el modo demo. En *USUARIO DE EJEMPLO*: Comenzar Jornada se registra **al instante**, sin normas ni cámara. Observación, editar hora, novedad y evento funcionan **sin** peticiones a `com_time_records`, `/files`, `com_rules_acceptance` ni `com_event_reports` |
| **D2** Pausa demo | Contador con el botón **Terminar Demo**, que la cierra y suma 1. No aparece ninguna clave `activeBreakExpires_99999` en Local Storage |
| **D3** Tour | El tutorial resalta la tarjeta (`tour-employee-card`), las marcaciones (`tour-marcacion`), la novedad (`tour-novedad-btn`) y la pausa (`tour-evento-btn`) |
| **D4** Demo + reales | Con la demo activa, una tarjeta **real** sigue pidiendo normas y cámara |

---

## 6. Evidencia: fotos, GPS y mapas (`4f720eb`, `295d825`) 🔴

Prepara 2 o 3 marcaciones **con foto** (R1, R6) y alguna **sin** foto (almuerzos).

### E1 — Historial: detalle de una marcación

1. **Historial** (usuario de tienda o admin) → en la tabla, pulsa una hora (inicio o fin de turno).

**Esperado:** se abre el detalle de la marcación con:
- la foto **difuminada**;
- **Ampliar imagen**, que abre el lightbox, también difuminado;
- la observación, o *"Sin observaciones adicionales para esta marcación."*;
- la tarjeta GPS con *"Precisión: ±N m"*.

Con un usuario admin aparece además el chip **Admin**.

2. **Mapa:**
   - **Ver mapa en vivo con Leaflet** despliega un mapa de OpenStreetMap con el marcador en el punto registrado.
   - **Abrir en Google Maps** abre las mismas coordenadas en una pestaña nueva.
3. Pulsa una hora **de almuerzo** (sin foto ni GPS). No se rompe nada: no aparece una imagen rota ni un mapa vacío.

### E2 — Historial: jornada completa

En la fila, pulsa el ojo (**Ver jornada completa**).

**Esperado:** modal *"Jornada Diaria"* con las 4 marcaciones en orden (Inicio de Jornada, Inicio de Almuerzo, Fin de Almuerzo, Fin de Jornada), cada una con su color e icono. Las miniaturas aparecen difuminadas. Muestra el total de horas y la tienda. Las fotos se amplían y el GPS se despliega como en E1.

### E3 — Reportes: fotos sin difuminar

**Reporte → Marcaciones** (usuario report o area manager) → abrir el detalle de una marcación.

**Esperado:** la **misma** foto aparece **sin difuminar** (`esReporte`), tanto la miniatura como la ampliada.

### E4 — Monitoreo: historial del empleado

**Monitoreo → Resumen** → abre una tienda → icono de historial de un empleado → vista de línea de tiempo.

**Esperado:** las marcaciones con miniatura y vista ampliada.

⚠️ **Confirmar con negocio:** aquí la foto sale **sin difuminar**. `HistorialHorasModal` no pasa `esReporte` y `HistorialTimelineView` usa `true` por defecto. ¿Es lo esperado para admin y area manager?

### E5 — Reporte semanal: detalle del día

**Reporte → Semanal** (area manager) → elige un empleado → pulsa un día.

**Esperado:** el modal de jornada diaria con las observaciones del día. Al cerrarlo desde un día abierto desde *Festivos*, vuelve al modal de festivos.

⚠️ Aquí el modal **no** recibe `eventos`: comprueba si deben verse las fotos y el GPS.

### E6 — Marcaciones antiguas

Abre en el Historial una marcación hecha **entre `8a19fc5` y `4f720eb`**, que guardaba `latitude`/`longitude` y no `location`.

**Esperado:** se ve la foto. Comprueba si el GPS aparece: hoy solo se lee `location`, así que probablemente **no** se verá.

### E7 — Privacidad del difuminado 🔴 *(prueba de seguridad sobre la propia app)*

1. En el Historial (foto difuminada), clic derecho en la miniatura → *Copiar dirección de la imagen*.
2. En una pestaña nueva, pega la URL **quitando** el parámetro `transforms=…`.

**Esperado deseable:** la imagen **no** se muestra sin difuminar.

**Lo probable hoy:** sí se muestra la original. El difuminado se pide **en la URL**, así que no protege la foto si el usuario tiene permiso de lectura sobre `directus_files`.

Además, la URL incluye `access_token=…`, que puede quedar en el historial del navegador o en logs. Si se confirma, registrarlo para resolverlo en el servidor (permisos o presets de Directus).

### E8 — Token caducado

Deja la app abierta hasta que caduque la sesión (o fuerza el refresco) y abre otra foto. Debe cargar; si sale una imagen rota, la URL se generó con un token viejo.

---

## 7. Otras secciones (regresión) 🟡

| Caso | Dónde | Esperado |
|---|---|---|
| **O1** Detalle de tienda | Monitoreo → Resumen → abrir una tienda | Tabla de empleados con estados y horas como antes; editar una hora se guarda y refresca; el modal se queda abierto si falla |
| **O2** Calendario de tienda | Mismo detalle → calendario mensual | Colores por día como antes |
| **O3** Planilla | Monitoreo → Editar registros (area manager) | Carga y permite editar horas. **Network:** al abrir ya **no** salen `com_event_reports` ni `com_newness?fields=id,name` (antes salían 7 queries) |
| **O4** Auditoría | Monitoreo → Auditoría | Lista de ediciones manuales con su motivo |
| **O5** Novedades | Sección Novedades | La lista carga igual que antes |
| **O6** Historial: filtros y paginación | Historial → buscar por nombre, cambiar rango, paginar | Funciona; **Exportar** genera el Excel con las columnas de siempre |
| **O7** Reportes | Marcaciones, Novedades, Pausas y Semanal; exportaciones | Cargan y exportan como antes |
| **O8** Admin | Admin → crear y editar un empleado, ver su perfil | Se guarda y la lista se refresca |
| **O9** Login | Cerrar sesión y volver a entrar | El login funciona (`badb155` cambió `isLoading`) |

---

## 8. Rendimiento 🟡

| Caso | Qué comprobar |
|---|---|
| **P1** Pausa activa | Profiler: durante una pausa, cada segundo solo se resalta el **contador**, no la tarjeta ni las demás |
| **P2** Modales | Abrir y cerrar un modal en una tarjeta no re-renderiza las filas de las **otras** tarjetas |
| **P3** Normas en Registros | **Network** al abrir Registros con muchos empleados: **una** sola petición a `com_rules_acceptance` (con `_in`), no una por tarjeta. Con un usuario sin `temporal`: ninguna al cargar |
| **P4** Mapa | Desplegar y plegar el mapa varias veces no deja mapas duplicados ni errores de Leaflet en la consola |

---

## 9. Hallazgos para confirmar (detectados al preparar esta guía)

| # | Hallazgo | Dónde | Caso |
|---|---|---|---|
| H1 | Las marcaciones con foto dependen del campo `location` (geometry) en `com_time_records` | `api/directus/create.ts` | §0.3, R1 |
| H2 | El difuminado de las fotos va en la URL y no protege la original; la URL lleva `access_token` | `utils/directusAssets.ts` | E7 |
| H3 | Historial de Monitoreo y Reportes muestran la foto sin difuminar; la sección Historial, difuminada | `HistorialHorasModal`, `HistorialTimelineView` (`esReporte = true` por defecto) | E3, E4 |
| H4 | Las marcaciones antiguas con `latitude`/`longitude` probablemente no muestran el GPS | `read.ts` / `useHistorial` (solo leen `location`) | E6 |
| H5 | El detalle de día del Reporte semanal no recibe fotos ni GPS | `ReporteSemanalAreaManager` → `DailyAttendanceModal` | E5 |
| H6 | Los mapas cargan teselas de `tile.openstreetmap.org` (servicio externo): necesita red y, si hay CSP, permitir el dominio | `attendance/LeafletMap.tsx` | E1 |
| H7 | `leaflet` y `@vladmandic/face-api` no estaban instalados en este entorno, aunque sí en el lockfile | `package.json` | §0.1 |

---

## 10. Comprobaciones automáticas previas

```bash
npx tsc --noEmit -p tsconfig.json 2>&1 | grep "apps/horarios" | grep -v TS6133   # vacío
npm run test:horarios                                                            # 17 archivos, 146 tests en verde
npx vite build --logLevel error                                                  # OK
```

Estado al preparar la guía (`295d825`, tras `npm install`): las tres en verde.

---

## 11. Resumen de resultados

| Caso | Prio. | Resultado | Notas |
|---|---|---|---|
| N1–N6 Navegación y roles | 🟠 | ☐ OK ☐ Falla | |
| R1 Comenzar Jornada (foto, rostro, GPS, `location`) | 🔴 | ☐ OK ☐ Falla | |
| R2 Normas pendientes (`temporal`) | 🟠 | ☐ OK ☐ Falla | |
| R3 Normas pendientes (sin `temporal`) | 🟠 | ☐ OK ☐ Falla | |
| R4 Aceptar normas desde la cabecera | 🟠 | ☐ OK ☐ Falla | |
| R5 Almuerzos sin foto | 🟠 | ☐ OK ☐ Falla | |
| R6 Terminar Jornada con foto | 🟠 | ☐ OK ☐ Falla | |
| R7 Marcación repetida | 🔴 | ☐ OK ☐ Falla | |
| R8 Sin tienda | 🟡 | ☐ OK ☐ N/A | |
| F1–F7 Fallos corregidos | 🔴 | ☐ OK ☐ Falla | |
| M1–M6 Modales de la tarjeta | 🟠 | ☐ OK ☐ Falla | |
| D1–D4 Demo y tour | 🟡 | ☐ OK ☐ Falla | |
| E1 Detalle de marcación + mapa | 🔴 | ☐ OK ☐ Falla | |
| E2 Jornada completa | 🔴 | ☐ OK ☐ Falla | |
| E3 Reportes sin difuminado | 🟠 | ☐ OK ☐ Falla | |
| E4 Monitoreo: historial | 🟠 | ☐ OK ☐ Falla | |
| E5 Reporte semanal: día | 🟠 | ☐ OK ☐ Falla | |
| E6 Marcaciones antiguas | 🟡 | ☐ OK ☐ Falla | |
| E7 Privacidad del difuminado | 🔴 | ☐ OK ☐ Falla | |
| E8 Token caducado | 🟡 | ☐ OK ☐ Falla | |
| O1–O9 Otras secciones | 🟡 | ☐ OK ☐ Falla | |
| P1–P4 Rendimiento | 🟡 | ☐ OK ☐ Falla | |

**Si algo falla**, anota:
1. El caso y el paso.
2. El usuario o rol.
3. Una captura de Network (la petición y su respuesta).
4. Los errores de la consola.
5. La fila de Directus implicada.
