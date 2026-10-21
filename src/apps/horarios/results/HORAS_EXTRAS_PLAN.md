# Horas extras: plan y estado

> **Actualizado:** 2026-10-20, sobre `setup`. Cambios de código **sin commitear**.
> **Qué es:** el plan de horas extras de Horarios, reescrito con todo lo que se decidió e implementó en las fases 0 a 3. **Sustituye** a la versión inicial de este documento, la del análisis previo a implementar.
> **Detalle por fase:** [`HORAS_EXTRAS_F0_F1.md`](HORAS_EXTRAS_F0_F1.md) (decisiones, esquema, permisos, dominio y API), [`HORAS_EXTRAS_F2A_LIDER.md`](HORAS_EXTRAS_F2A_LIDER.md) (vista del líder) y [`HORAS_EXTRAS_F3_COMERCIAL.md`](HORAS_EXTRAS_F3_COMERCIAL.md) (vista del comercial).
> **Nómina y periodos:** pasan a [`HORAS_EXTRAS_PLAN_V2.md`](HORAS_EXTRAS_PLAN_V2.md).

---

## 0. Resumen

| | Estado |
|---|---|
| Flujo | **Manual.** El líder de zona registra horas extras, que quedan **pendientes**, y el comercial las **aprueba o rechaza**. Las sugerencias automáticas quedan para el futuro |
| Fuera de alcance | **Nómina:** periodos (`com_period`, `period_id`), rezagadas y liquidación. **ETL:** no interviene en esta implementación |
| Frontend | ✅ Sección **Horas extras**, con sub-pestañas por rol: Registradas (líder), Historial y Aprobación (comercial) |
| Directus | ❌ **Esquema y políticas sin aplicar** (§5). Es lo que bloquea la prueba real |
| Tests | ⚠️ **349 en verde y 1 en rojo** en Horarios. El rojo depende de la pregunta Q1 (§9) |
| Navegador | ❌ No probado, por lo anterior |

---

## 1. Decisiones

### 1.1 Respuestas a P1–P8

| # | Decisión |
|---|---|
| P1 | Horas en **bloques de 30 minutos**. Se guardan como **minutos enteros** (`minutes`). Sin máximo diario |
| P2 | El **líder** ve **sus tiendas** (`core_user_stores`, sin la tienda 5). El **jefe comercial** ve **todas** |
| P3 | `liquidacion_date` se crea en `com_period`, pero **no se usa**. Después, toda la nómina quedó fuera de alcance (§1.2) |
| P4 | La tienda es, por defecto, **la del empleado**. El líder puede elegir **otra** (rotación o trabajo en otro lugar) |
| P5 | `approval_at` pasa a **`reviewed_at`**: fecha de la decisión, apruebe o rechace |
| P6 | El líder **no** retira pendientes |
| P7 | La tienda **no** ve horas extras |
| P8 | **Sin** notificaciones |

### 1.2 Decisiones posteriores (2026-10-20)

| Tema | Decisión |
|---|---|
| Fecha trabajada | En Directus el campo se llama **`work_date`**, no `work_day`. `com_time_record_store` sigue usando `work_day`: es otro campo |
| Nómina | **Fuera de alcance:** sin periodos, sin `period_id`, sin rezagadas y sin `liquidacion_date` en la app |
| Quién revisó | **No** se crea `reviewed_by`. Se usa **`updated_by`** (*User Updated*), que Directus llena solo. Una fila revisada queda en estado final y no vuelve a cambiar, así que `updated_by` es el comercial que decidió |
| Vista del líder | Lista de **horas extras registradas** + botón **Registrar hora extra**, con un **buscador de empleados** dentro del formulario. No ve una lista de trabajadores |
| Vista del comercial | **Dos sub-pestañas separadas:** **Historial** (todo menos pendiente, con filtros de rango de fechas y estado en una misma fila) y **Aprobación** (pendientes) |
| Rol comercial | **Se suma** a lo que el usuario ya veía. En Horas extras **no** ve ni registra: Registradas se le oculta |
| Líder | **No** ve Historial ni Aprobación |
| ETL | No se toca |

---

## 2. Roles y vistas

### 2.1 Cómo se detecta cada rol

Los roles salen de las políticas de Directus del usuario (`useHorariosPolicies`):

| Rol | Política | Notas |
|---|---|---|
| Admin | Contiene "admin" + time_log/horario | |
| Area Manager (líder de zona) | Contiene "time_log" + "manager"/"area", y no es admin | También recibe `report` |
| Report | Contiene "report" | |
| **Comercial** | Contiene **"comercial" + time_log/timelog/horario**. Ejemplo: `time_log_comercial` | Una política llamada solo "comercial" **no** activa el rol, para no confundirla con la de otros módulos |
| Tienda | Ninguna de las anteriores | El comercial **no** quita este rol |

**Prioridad para la página de entrada:** admin → areaManager → tienda → report → **comercial**. El comercial va último, así que su página de entrada **no cambia** respecto a antes.

### 2.2 Qué ve cada uno en Horas extras

| Sub-pestaña | Ruta | Líder | Comercial | Contenido |
|---|---|:-:|:-:|---|
| **Registradas** | `/horarios/horas-extras/registradas` | ✅ | ❌ (`ocultarA`) | Horas extras de sus tiendas (filtro de estado, totales y paginación) + **Registrar hora extra** |
| **Historial** | `/horarios/horas-extras/historial` | ❌ | ✅ | Todo menos `pendiente`. **Rango de fechas** (`DateRangeFilter`, el calendario de Monitoreo → Apertura y Cierre; por defecto, el mes en curso) y **estado**, en la misma fila |
| **Aprobación** | `/horarios/horas-extras/aprobacion` | ❌ | ✅ | Pendientes. **Aprobar y rechazar** por fila y en lote. El rechazo exige motivo |

- **Un Area Manager que además es comercial** ve Historial y Aprobación, pero **no** Registradas.
- **Fuera de Horas extras**, cada usuario ve lo mismo que antes: Registros, Monitoreo, Reportes… según sus otros roles.
- **`/horarios/horas-extras`** abre la primera sub-pestaña permitida, conservando `?tienda=`.
- Una **única regla**, `puedeVerSubseccion` (`roles` y `ocultarA`), decide las sub-pestañas visibles, el índice y el guard de la ruta, así que los tres no pueden contradecirse.

### 2.3 Tiendas

| Dónde | Líder | Comercial |
|---|---|---|
| Registradas | Sus tiendas asignadas (header: una o "Todas") | — |
| Historial y Aprobación | — | **Todas** las tiendas. El header empieza en "Todas" |
| Resto de la app | Igual que antes | Igual que antes (tienda propia, asignadas o todas, según su otro rol) |

La lista de tiendas permitidas es **global**, así que **`accesoDeSubseccion`** (`hooks/useHorariosLayout.ts`) da todas las tiendas al comercial **solo** dentro de sus sub-pestañas. Si se la diera siempre, un usuario de tienda vería un selector en Registros y un líder perdería el filtro por sus tiendas.

La tienda **90** (pruebas) se excluye de las consultas salvo que se pida. La **5** no está en las tiendas del líder.

---

## 3. Modelo de datos

### 3.1 `com_over_time` (adaptada; no se crea `extra_time`)

| Campo | Tipo | Uso |
|---|---|---|
| `employee_id` | M2O → `adm_employees`, requerido | Empleado (el `user_id` del modelo original) |
| `store_id` | M2O → `core_stores` (id **texto**), requerido | Tienda donde se trabajó. Por defecto, la del empleado |
| `work_date` | Date, requerido | Día trabajado. No puede ser futuro |
| `minutes` | Integer, requerido, > 0 | Minutos en bloques de 30 (el `hours` del modelo original) |
| `status` | String con validación `_in` | Ver §4 |
| `observations` | Text, ≤ 300 | Justificación del líder |
| `review_note` | Text | **Motivo del rechazo** (obligatorio al rechazar) |
| `reviewed_at` | **Timestamp** | Fecha de la decisión, apruebe o rechace. Sustituye a `approval_at` |
| `created_at` / `created_by` | *Date Created* / *User Created* | Quién y cuándo se registró |
| `updated_at` / `updated_by` | *Date Updated* / *User Updated* | En una fila revisada, el comercial que decidió |
| `period_id` | M2O → `com_period` | **Existe, pero la app no lo lee ni lo escribe** (nómina, fuera de alcance) |

**Duplicados:** una fila **activa** (sugerida, pendiente o aprobada) por empleado y `work_date`. El formulario avisa, pero **no bloquea**. Directus no admite índices compuestos condicionados.

### 3.2 Otras colecciones

| Colección | Papel |
|---|---|
| `com_period` | **Fuera de alcance.** No hace falta ningún cambio |
| `com_time_record_store` | Sin cambios. Su campo es `work_day` |
| `adm_employees`, `core_stores`, `core_user_stores` | Lectura: empleados activos, tiendas y tiendas del líder |
| `directus_users` | Lectura de `id`, `first_name` y `last_name`, para mostrar quién creó y quién revisó |

---

## 4. Estados y transiciones

| Valor | Texto | Final | Quién |
|---|---|:-:|---|
| `sugerida` | Sugerida | No | Sistema *(futuro)* |
| `pendiente` | Pendiente | No | Líder, al registrar |
| `descartada_lider` | Descartada por el líder | Sí | Líder, sobre una `sugerida` *(futuro)* |
| `descartada_comercial` | Rechazada | Sí | Comercial |
| `aprobada` | Aprobada | Sí | Comercial |

**Transiciones** (`domain/horasExtras/transiciones.ts`):
- **Líder:** crear → `pendiente`; `sugerida` → `pendiente` o `descartada_lider`; editar una `pendiente`.
- **Comercial:** `pendiente` → `aprobada` o `descartada_comercial`.
- De un estado final no se sale.

Los valores viven en un único catálogo (`domain/horasExtras/estados.ts`). **No hay que cambiarlos** una vez haya datos.

**Seguimiento:** no hace falta guardar un historial aparte.
- **Creación:** `created_at` / `created_by`.
- **Decisión:** `reviewed_at`, `updated_by` y `review_note`.

---

## 5. Directus: cambios por aplicar (F0)

> **Nada se aplicó.** Lo hace un administrador. La lista detallada, campo por campo, está en `HORAS_EXTRAS_F0_F1.md` §2.

| Cambio | Qué |
|---|---|
| `com_over_time` | Crear `work_date`, `observations`, `review_note`, `reviewed_at` (Timestamp) y `updated_at`/`updated_by`. Borrar `approval_at`. Volver a crear `created_at` como Timestamp. Hacer requeridos `employee_id`, `store_id`, `work_date`, `minutes` y `status`. Opciones y validación de `status`. `minutes > 0` |
| Política del **líder** | **Leer y crear** solo en sus tiendas: la tienda trabajada **o** la del empleado está en `core_user_stores` del usuario. Crear solo con `status = pendiente` |
| Política del **comercial** (nombre con "comercial" + time_log/horario) | **Leer** todo. **Actualizar** solo filas `pendiente`, solo los campos `status`, `reviewed_at` y `review_note`, con `status _in [aprobada, descartada_comercial]` |
| Lectura auxiliar | `directus_users` (nombres), `adm_employees` y `core_stores` para las dos políticas |
| Recomendado | *Preset* `reviewed_at = $NOW` en la política del comercial, para no depender del reloj del dispositivo |
| Prueba de aceptación | Un líder de prueba no puede leer ni crear filas de otras tiendas por la API. Un comercial no puede modificar una fila ya revisada |

---

## 6. Frontend implementado

| Capa | Archivos |
|---|---|
| Dominio | `domain/horasExtras/`: `estados.ts` (catálogo, finales, activos), `transiciones.ts`, `reglas.ts` (`BLOQUE_MINUTOS`, `validarHoraExtra`, `buscarDuplicado`, `formatoMinutos`) |
| Tipos | `interfaces/api/overTime.ts` (`OverTimeDto`, `CreateOverTimeDto`, `UpdateOverTimeDto`, `ReviewOverTimeDto`), `interfaces/horasExtras.ts` (`HoraExtraFila`), `interfaces/acceso.ts` (`tiendasGlobales`) |
| API | `api/directus/horasExtras.ts`: `filtroHorasExtras` (tiendas por la tienda trabajada **o** la del empleado, sin la 90, rango de `work_date` y estados), `listarHorasExtras`, `crearHoraExtra`, `actualizarHoraExtra`, `revisarHorasExtras` (lote en una sola petición; motivo obligatorio al rechazar) |
| Hooks | `hooks/useHorasExtras.ts` (no consulta sin tiendas), claves `horariosKeys.horasExtras` y `empleados.tiendas` |
| Roles y acceso | `useHorariosPolicies` (`esComercial`), `useHorariosAcceso` (rol aditivo, `tiendasGlobales`), `useHorariosLayout` (`accesoDeSubseccion`), `useTiendaSeleccionada` (el comercial empieza en "Todas") |
| Navegación | `navigation/secciones.ts`: sección `horas-extras`, `ocultarA` y `puedeVerSubseccion`. `navigation/RequireRole.tsx`: `IndexSubseccion` y `RequireSubseccion`. `routes.tsx`: sub-rutas con carga diferida. Es el primer uso de `SubSeccionLayout` con rutas hijas |
| Páginas | `pages/horas-extras/RegistradasPage.tsx`, `HistorialPage.tsx`, `AprobacionPage.tsx`; `pages/secciones/HorasExtrasSeccion.tsx` |
| Componentes | `components/horas-extras/`: `HorasExtrasTabla` (selección y acciones opcionales), `HoraExtraEstadoChip`, `RegistrarHoraExtraModal` (buscador de empleado, tienda, fecha, horas, observación y aviso de duplicado), `HistorialHorasExtras`, `PendientesAprobacion`, `RevisionHoraExtraDialog` |
| Reutilizado | `DateRangeFilter`, `ReporteTiendasPagination`, `getEmpleadosBulk`, `getStores` (misma caché que el acceso), `useAvisos`, `mensajeDeError`/`errorDeApi`, `getRealColombiaTime` |

**Criterio de código:** se siguen las capas y convenciones del módulo. No se copiaron malas prácticas cuando había una alternativa igual de corta: por ejemplo, el chip usa un mapa de colores en lugar de una cadena de `if`, no hay `as any` ni valores por defecto silenciosos de tienda, y las sub-pestañas son rutas en lugar de índices.

---

## 7. Fases

| Fase | Estado | Qué quedó |
|---|---|---|
| **F0: Decisiones y esquema** | ✅ Decisiones · ❌ Directus | Lista de cambios lista para aplicar (§5) |
| **F1: Dominio, tipos y API** | ✅ | §6, con tests |
| **F2: Líder** | ✅ (sin editar) | Registradas + Registrar hora extra. **Falta editar una pendiente** desde la tabla (`actualizarHoraExtra` ya existe) |
| **F3: Comercial** | ✅ | Historial y Aprobación en sub-pestañas separadas. Rol aditivo, sin ver Registradas |
| **Prueba real** | ❌ | Navegador con los dos roles, cuando F0 esté aplicada en Directus |
| **F4: Exportación** | Pendiente | Excel del historial y opción en la exportación unificada de Reporte |
| **F5: Tours y documentación** | Pendiente | Pasos de tour para Registradas y Aprobación. Rehacer `context.md`, que se perdió (§8) |
| **Futuro** | — | Sugerencias del sistema (`sugerida`) y nómina (periodos, rezagadas, liquidación) |

---

## 8. Riesgos y límites conocidos

| Riesgo o límite | Mitigación |
|---|---|
| **Esquema y permisos sin aplicar** | Hasta F0, las consultas fallan contra Directus real |
| **Permisos solo en la UI** | El filtro por tiendas del líder **tiene** que estar en la política de Directus (§5). Si no, la API lo deja leer y crear en otras tiendas |
| `crearHoraExtra` ya no envía `status` (cambio externo) | Ver Q1. Si Directus no pone `pendiente` por defecto, las filas nuevas **no aparecen en Aprobación** |
| `getEmpleadosBulk` oculta sus errores | Si falla, el buscador sale vacío en lugar de mostrar el error. Es el comportamiento que ya tenía la función, que también usa Registros |
| `reviewed_at` con el reloj del dispositivo | *Preset* `$NOW` en Directus (§5) |
| Duplicados por concurrencia | Aviso en el formulario. Si hiciera falta, un Flow de Directus |
| Ids de tienda como texto (`"90"`) | Se comparan siempre convertidos a número |
| Paginación en el navegador | Se piden todas las filas del filtro. Si crece, pasar a `limit`/`offset` de Directus |
| "Seleccionar todas" en Aprobación | Marca solo la página visible, a propósito |
| **Trabajo perdido antes de esta implementación** | La carpeta `results/` se vació (los documentos anteriores siguen en git) y se perdió el endpoint `GET /tiendas/jornadas` del ETL. `context.md` no estaba en git |

---

## 9. Preguntas abiertas

| # | Pregunta | Por qué importa |
|---|---|---|
| **Q1** | ¿`status` tiene **`pendiente` como valor por defecto** en Directus? | Se quitó `status: 'pendiente'` de `crearHoraExtra`. Si hay valor por defecto, se ajusta el test que hoy está en rojo. Si no, hay que volver a enviarlo |
| Q2 | ¿El líder debe poder **editar** una pendiente (minutos, tienda, observación)? | La API y la transición existen; falta la acción en Registradas |
| Q3 | ¿El Historial muestra el **motivo del rechazo** y **quién revisó**? | Los datos ya llegan en la consulta (`review_note`, `updated_by`); solo faltan las columnas |
| Q4 | ¿Qué sub-pestaña abre el comercial al entrar: Historial (como ahora) o Aprobación? | Es el orden en `secciones.ts` |
| Q5 | ¿Exportación a Excel del historial (F4)? ¿Y en la exportación unificada de Reporte? | Coherencia con las demás pestañas |
