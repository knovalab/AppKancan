# 02 — Pruebas en el navegador

> Prioridad: 🔴 cambia el comportamiento (obligatorias) · 🟠 regresión del registro · 🟡 regresión de otras secciones.
> Para cada caso: **pasos → qué se ve → qué mirar en DevTools → qué mirar en Directus**.

---

## 0. Preparación

### 0.1 Levantar la app con HTTPS

La cámara y el GPS **solo funcionan en HTTPS** (o en `localhost`). `vite.config.ts` ya tiene `basicSsl()` activo en local.

```bash
npm run dev            # vite --host
```

- **En el mismo PC:** abre `https://localhost:<puerto>`.
- **Desde una tablet o un móvil de la red:** abre `https://<IP-del-PC>:<puerto>` y acepta el certificado autofirmado.
- Concede los permisos de **cámara** y **ubicación** cuando el navegador los pida.

### 0.2 Usuarios y datos

| Qué | Para qué casos |
|---|---|
| Usuario de **tienda** (con tienda asignada) | P1–P11 |
| Usuario **area manager** | P12 (Planilla) |
| Usuario **admin** | P13, P14 |
| Una tienda con **al menos 2 empleados sin marcaciones hoy** | P1–P7 (cada caso "gasta" marcaciones) |
| Acceso a **Directus admin** (`com_time_records`, `com_rules_acceptance`, `directus_files`) | Verificar lo guardado |

> Si te quedas sin empleados "limpios", borra en Directus sus filas de **hoy** en `com_time_records` y recarga la página (F5).

### 0.3 DevTools (Chrome/Edge)

1. `F12` → pestaña **Network** → marca **Preserve log**.
2. Filtro de texto: `com_time_records` (o el que indique cada caso).
3. **Bloquear peticiones** (para simular fallos):
   - `Ctrl+Shift+P` → *Show Network request blocking* → **Enable network request blocking** → `+` → patrón `*com_time_records*`.
   - Para desbloquear, desmarca el patrón (no hace falta borrarlo).
   - Bloquear `com_time_records` hace fallar **tanto la consulta de existencia (GET) como el guardado (POST/PATCH)**, pero **no** la subida de la foto (`/files`).
4. Pestaña **Console** abierta: no debe salir ningún error rojo `Uncaught (in promise)`.

### 0.4 Peticiones que vas a ver al marcar (referencia)

| Orden | Petición | Origen |
|---|---|---|
| 1 | `GET /items/com_rules_acceptance?…` | Solo en "Comenzar Jornada": comprueba las normas |
| 2 | `POST /files` | Sube la foto (modal de verificación) |
| 3 | `GET /items/com_time_records?filter…&limit=1&fields=id` | **Nueva:** ¿ya existe esta marcación? |
| 4 | `POST /items/com_time_records` | Crea la marcación, con `latitude`, `longitude`, `accuracy`, `photo` y `store_id` |
| 5 | `GET /items/com_time_records?filter…` | Refresco de las marcaciones de la tienda |

---

## 🔴 P1 — Marcar con foto (camino feliz)

1. Ve a **Registros** con un empleado que tenga las normas aceptadas y ninguna marcación hoy.
2. Pulsa **Comenzar Jornada**.
3. En el modal: espera a ver *"GPS asegurado"*, pulsa **Tomar Fotografía** y luego **Confirmar**.

**Qué se ve:**
- El botón muestra *"Guardando..."* y el modal se cierra.
- Snackbar verde: *Registro de "Comenzar Jornada" guardado con éxito*.
- La tarjeta muestra la hora y el estado **JORNADA INICIADA**; el siguiente botón activo es **Iniciar Almuerzo**.

**DevTools:** aparecen las peticiones 2 → 3 → 4 → 5 de §0.4.
- La 3 responde `data: []`.
- En el payload de la 4: `store_id` es **la tienda seleccionada** (no `90`), `photo` es un UUID y vienen `latitude`, `longitude` y `accuracy`.

**Directus:** hay **1** fila nueva en `com_time_records` con la foto y las coordenadas, y el archivo está en `directus_files`.

---

## 🔴 P2 — Normas antes de la foto (`cd0c6af`)

1. En Directus, **borra** la fila del empleado en `com_rules_acceptance` (o usa uno que no las haya aceptado).
2. En Registros, pulsa **Comenzar Jornada** en ese empleado.

**Qué se ve:** primero el **modal de normas** (obligatorio, sin botón de cerrar) y **no** la cámara. Al marcar todas las casillas y pulsar **ACEPTO**, se abre el **modal de foto**. Al confirmar se registra la entrada como en P1.

**DevTools:**
- `GET com_rules_acceptance` (con `employee_id _in [id]`) → `POST com_rules_acceptance` → `POST /files` → `POST com_time_records`.

**Variante:** con un empleado que ya aceptó, "Comenzar Jornada" va **directo** a la cámara (sale el GET de normas, pero no el modal).

---

## 🔴 P3 — Fallo al guardar: el modal no se cierra y se puede reintentar

1. Usa un empleado sin marcaciones. Pulsa **Comenzar Jornada** y **Tomar Fotografía**. **No** confirmes todavía.
2. Activa el bloqueo `*com_time_records*` (§0.3).
3. Pulsa **Confirmar**.

**Qué se ve:**
- El modal **sigue abierto** con una alerta roja de error.
- Snackbar rojo.
- La tarjeta **no** cambia de estado.

4. Desactiva el bloqueo y pulsa **Confirmar** otra vez.

**Qué se ve:** se guarda, el modal se cierra y aparece el snackbar verde (como en P1).

**DevTools:**
- 1.er intento: `POST /files` OK y `GET com_time_records` **(blocked)**.
- 2.º intento: otro `POST /files` y luego la secuencia normal.

**Directus:**
- **1** sola fila en `com_time_records`.
- **2** fotos en `directus_files`: la del primer intento queda huérfana. Es un **riesgo conocido** (§5 de CAMBIOS_APLICADOS), no un fallo de esta prueba.

**Antes del cambio:** el modal se cerraba como si se hubiera guardado y la tarjeta no cambiaba.

---

## 🔴 P4 — Marcación repetida desde otro dispositivo o pestaña: se rechaza

1. Abre **dos pestañas** (A y B) en Registros, con la misma tienda.
2. En **B**, en un empleado sin marcaciones, pulsa **Comenzar Jornada**, acepta las normas si salen y deja el **modal de foto abierto**, sin confirmar.
3. En **A**, marca **Comenzar Jornada** para el **mismo** empleado y confírmalo (P1).
4. Vuelve a **B**, pulsa **Tomar Fotografía** y luego **Confirmar**.

**Qué se ve en B:**
- El modal sigue abierto con *"Esta marcación ya está registrada hoy. Para cambiar la hora usa 'Editar hora'."*, y el mismo texto en el snackbar.
- Al cerrar el modal, la tarjeta muestra la hora registrada en A.

**DevTools en B:**
- O bien el rechazo sale de la caché (no hay `GET … limit=1`, porque al volver a la pestaña se refrescó la lista),
- o bien `GET com_time_records … limit=1` responde `data: [{ id }]`.
- En los dos casos **no** debe haber `POST /items/com_time_records`.

**Directus:** **1** sola fila de "Comenzar Jornada" para ese empleado hoy.

**Antes del cambio:** B **sobrescribía la hora** de A y la nueva foto no se guardaba.

---

## 🔴 P5 — Editar hora

1. En un empleado con **Comenzar Jornada** registrado, pulsa el icono del **reloj** de esa fila.
2. Cambia la hora (p. ej. 10 minutos antes), elige un **motivo** y pulsa **Guardar**.

**Qué se ve:**
- Snackbar *Registro actualizado correctamente* y el modal se cierra.
- La hora cambia en la tarjeta y el reloj queda **deshabilitado**, con el tooltip *"Esta hora ya fue editada…"*.

**DevTools:**
- `PATCH /items/com_time_records/<id>`, con `record_time` en formato `HH:mm:00` (24 h) y `original_record_time` igual a la hora original.
- `POST` o `PATCH` a `com_records_reasons`.
- **No** hay `GET … limit=1` ni `POST com_time_records`.

**Directus:**
- La **misma** fila (mismo `id`, mismo `record_date`), con la hora nueva y `original_record_time`.
- La foto original se conserva.

**Comprueba la conversión de hora:** si editas a las **12:15 PM**, en Directus debe quedar `12:15:00`, y si editas a las **12:15 AM**, `00:15:00`.

---

## 🔴 P6 — Editar hora con fallo: el modal no se cierra

1. Usa un empleado con una marcación **no editada**. Abre el reloj y cambia la hora y el motivo.
2. Activa el bloqueo `*com_time_records*` y pulsa **Guardar**.

**Qué se ve:**
- Snackbar rojo, y el modal de editar hora **sigue abierto**.
- En la consola no aparece `Uncaught (in promise)`.

3. Desbloquea y pulsa **Guardar** otra vez: se guarda y el modal se cierra.

---

## 🔴 P7 — "Sin almuerzo" con fallo: no se marca a medias

1. Usa un empleado con **Comenzar Jornada** y sin almuerzo. Pulsa el icono **Turno sin almuerzo**.
2. Activa el bloqueo `*com_time_records*` y pulsa **Confirmar**.

**Qué se ve:**
- Snackbar rojo, y el modal **sigue abierto**.
- Las casillas de almuerzo **no** aparecen como omitidas.

3. Desbloquea y pulsa **Confirmar**.

**Qué se ve:** dos snackbars verdes (Iniciar y Finalizar Almuerzo), el modal se cierra y las casillas de almuerzo quedan marcadas. El estado pasa a **REGRESO ALMUERZO**.

**Directus:** **2** filas (`Iniciar Almuerzo` y `Finalizar Almuerzo`) **sin** foto ni GPS. Esto es el comportamiento actual: G3, pendiente de decisión.

**Antes del cambio:** si fallaba el primero, el segundo se intentaba igual y las casillas quedaban como omitidas.

---

## 🟠 P8 — Observación

1. En una marcación registrada, pulsa el icono de **observación**, escribe un texto y guarda.

**Qué se ve:** snackbar *Registro actualizado correctamente*; al reabrir, el texto sigue ahí.

**DevTools:** `PATCH /items/com_time_records/<id>` con solo `observations`.

---

## 🟠 P9 — Pausa activa (reportar evento)

1. En un empleado con la jornada iniciada, pulsa el botón de **evento**, elige *Iniciar Pausa Activa* y confirma.
2. Espera a que termine el temporizador, o pulsa terminar.

**Qué se ve:** snackbar *Evento reportado con éxito* (×2) y el contador de pausas sube en 1.

**DevTools:** `POST /items/com_event_reports` con `store_id` = **la tienda seleccionada** (no `90`), seguido de un refresco de `com_event_reports`.

---

## 🟠 P10 — Novedad: el empleado sale de la lista

1. En un empleado **sin marcaciones**, pulsa **Registrar novedad**, elige el tipo y las fechas (hoy) y guarda.

**Qué se ve:** snackbar *Novedad registrada con éxito*; el modal se cierra y **la tarjeta desaparece** de Registros.

Esto valida que quitar `onEliminarEmpleado`, que era una función vacía, no cambia nada: la tarjeta desaparece porque se refresca la lista de novedades.

---

## 🟠 P11 — Empleado demo

1. Activa el **modo demo** (botón del header; requiere la política demo) y marca en la tarjeta *USUARIO DE EJEMPLO*.

**Qué se ve:** **no** se abren las normas ni la cámara; la marcación aparece al instante.

**DevTools:** **ninguna** petición a `com_time_records`, `/files` ni `com_rules_acceptance`.

---

## 🟡 P12 — Planilla: 1 query en lugar de 7

1. Con un usuario **area manager**: **Monitoreo → Editar registros**.
2. En Network, **sin filtro**, recarga la página con esa pestaña abierta.

**Qué esperar:**
- Aparece `com_reasons`.
- **No** aparece `com_event_reports` (lo pedía `useHorarios` para la "primera tienda").
- **No** aparece `com_newness?fields=id,name` (tipos de novedad), salvo que otra vista abierta lo pida.
- `com_time_records` y `com_newness_reports` **sí** pueden aparecer: son las queries propias de Planilla (`recordsDiaMulti` y `novedadesMulti`).

3. Edita una hora desde Planilla.

**Qué se ve:** se guarda y el modal se cierra, como antes. Si fuerzas un fallo (bloqueo), el modal queda abierto.

---

## 🟡 P13 — Monitoreo: detalle de tienda

1. Con un usuario **admin**: **Monitoreo → Resumen de Asistencia** → abre una tienda.

**Qué se ve:** la tabla de empleados con sus estados y horas, **igual que antes**. Compara con una tienda que conozcas.

2. Edita una hora desde el detalle: se guarda y se refresca la tabla.

---

## 🟡 P14 — Historial, Admin y Novedades (solo cambiaron las query keys)

| Sección | Qué hacer | Esperado |
|---|---|---|
| **Historial** | Abrir y cambiar de rango | Carga igual que antes |
| **Admin → empleados** | Editar un empleado y guardar | La lista se refresca |
| **Admin → perfil del empleado** | Cambiar algo que invalide las novedades | Se refresca |
| **Novedades** | Abrir la sección | Lista igual que antes |
| **Reportes → exportar eventos** | Abrir el diálogo | Carga la tienda del usuario |

---

## 🟡 P15 — (Opcional) Sin tienda

Solo si tienes un usuario **sin tienda asignada** que pueda llegar a Registros. Intentar marcar debe dar el snackbar *"No hay una tienda seleccionada: no se puede guardar el registro."* y **no** crear nada en la tienda 90.

---

## Resumen de resultados

| Caso | Prioridad | Resultado | Notas |
|---|---|---|---|
| P1 Marcar con foto | 🔴 | ☐ OK ☐ Falla | |
| P2 Normas antes de la foto | 🔴 | ☐ OK ☐ Falla | |
| P3 Fallo al guardar + reintento | 🔴 | ☐ OK ☐ Falla | |
| P4 Marcación repetida rechazada | 🔴 | ☐ OK ☐ Falla | |
| P5 Editar hora | 🔴 | ☐ OK ☐ Falla | |
| P6 Editar hora con fallo | 🔴 | ☐ OK ☐ Falla | |
| P7 Sin almuerzo con fallo | 🔴 | ☐ OK ☐ Falla | |
| P8 Observación | 🟠 | ☐ OK ☐ Falla | |
| P9 Pausa activa | 🟠 | ☐ OK ☐ Falla | |
| P10 Novedad | 🟠 | ☐ OK ☐ Falla | |
| P11 Demo | 🟠 | ☐ OK ☐ Falla | |
| P12 Planilla | 🟡 | ☐ OK ☐ Falla | |
| P13 Detalle de tienda | 🟡 | ☐ OK ☐ Falla | |
| P14 Historial/Admin/Novedades | 🟡 | ☐ OK ☐ Falla | |
| P15 Sin tienda (opcional) | 🟡 | ☐ OK ☐ N/A | |

**Si algo falla**, anota:
1. El caso y el paso.
2. Una captura de la pestaña Network (la petición y su respuesta).
3. Los errores de la consola.
4. La fila de Directus implicada.
