# Horas extras: Fase 0 y Fase 1 (resultados)

> **Fecha:** 2026-10-20, sobre `setup` @ `d9f2b2c`. Cambios **sin commitear**.
> **Plan:** [`HORAS_EXTRAS_PLAN.md`](HORAS_EXTRAS_PLAN.md). Este documento recoge las decisiones del 2026-10-20 y **prevalece** sobre el plan donde se contradigan.
> **Actualización (2026-10-20, posterior):** **la nómina queda fuera de alcance.** Se quitaron del código los periodos (`com_period`, `period_id`) y las rezagadas, y el líder de zona ve las horas extras registradas, pero no los periodos. Ver [`HORAS_EXTRAS_F2A_LIDER.md`](HORAS_EXTRAS_F2A_LIDER.md). Las menciones a periodos que siguen en las secciones 1 y 3 de este documento son históricas; la sección 2 ya está corregida.
> **Fuera de alcance:** el ETL (`services/horarios-etl`), que no interviene en esta implementación y no se tocó.

---

## 0. Resumen

| | Estado |
|---|---|
| F0: decisiones | ✅ Cerradas (§1) |
| F0: esquema y permisos en Directus | 📋 **Lista lista para aplicar** (§2). **No se aplicó:** hace falta un administrador de Directus; desde aquí no hay credenciales de esquema |
| F1: dominio | ✅ `domain/horasExtras/`: estados, transiciones, reglas y periodos |
| F1: tipos y API | ✅ `interfaces/api/overTime.ts`, `interfaces/api/period.ts`, `api/directus/horasExtras.ts` y las claves de caché |
| F1: rol Comercial | ✅ Se detecta (`esComercial`). ⏸️ La conexión con navegación y acceso pasa a F2 (§3.4) |
| Tests | ✅ **326** en verde en Horarios (antes 303; 23 nuevos) |
| Tipos y lint | ✅ Sin errores nuevos. Los 4 de `MonitoreoPage.tsx` ya existían |
| Probado contra Directus real | ❌ No: el esquema todavía no está aplicado |

---

## 1. Decisiones (F0)

| # | Decisión | Efecto |
|---|---|---|
| P1 | **Bloques de 30 minutos** | Se guarda en `minutes`, un entero múltiplo de 30 mayor que 0. No hay máximo diario |
| P2 | El **líder de zona** ve sus tiendas. El **jefe comercial** ve **todas** | Filtro por tiendas solo para el líder. El comercial no tiene filtro de tienda en el permiso |
| P3 | Se crea `liquidacion_date`, pero **no se usa** | Al aprobar, la hora va **siempre al periodo vigente**, el que contiene la fecha de aprobación |
| P4 | La tienda es, por defecto, **la del empleado**, pero el líder puede elegir **otra** (rotación o trabajo en otro lugar) | `store_id` = la tienda donde se trabajó. El líder ve una fila si la tienda trabajada **o** la del empleado es suya |
| P5 | `approval_at` pasa a **`reviewed_at`** | Fecha de la decisión, apruebe o rechace |
| P6 | El líder **no** retira pendientes | `descartada_lider` solo existe para descartar una `sugerida` (futuro) |
| P7 | La tienda no ve horas extras | Sin cambios en Registros |
| P8 | Sin notificaciones | Sin cambios |

**Cómo cambia el plan:**
- **§3.2, periodo al aprobar:** se elimina la regla de "periodo liquidado", que se apoyaba en `liquidacion_date`. Si no existe un periodo vigente, **no se puede aprobar**: la API lo rechaza antes de llamar a Directus.
- **Rezagada:** fila `pendiente` o `sugerida`, sin periodo y con `work_date` anterior al inicio del periodo vigente. Una aprobada nunca es rezagada. Por eso **sobra** la acción "asignar rezagadas al vigente" del histórico.
- **Retirar pendientes:** desaparece por P6.

---

## 2. Cambios en Directus por aplicar (F0)

> Lo aplica un administrador en **Configuración → Modelo de datos → Commerce → Time Tracking**. Las dos colecciones están vacías (según el análisis del 2026-10-17; **confirmarlo antes**), así que cambiar tipos no pierde datos. En Directus, para cambiar el tipo de un campo hay que borrarlo y crearlo de nuevo.

### 2.1 `com_over_time`

| # | Campo | Acción | Configuración |
|---|---|---|---|
| 1 | `employee_id` | Editar | Requerido |
| 2 | `store_id` | Editar | Requerido |
| 3 | `minutes` | Editar | Requerido. Validación: `minutes > 0` |
| 4 | `status` | Editar | Lista desplegable con estas opciones (texto → valor): Sugerida → `sugerida`, Pendiente → `pendiente`, Descartada por el líder → `descartada_lider`, Rechazada → `descartada_comercial`, Aprobada → `aprobada`. Requerido. **Sin** valor por defecto. Validación `status _in` con esos cinco valores |
| 5 | `work_date` | **Crear** | Date, requerido |
| 6 | `observations` | **Crear** | Text (área de texto), nulo |
| 7 | `review_note` | **Crear** | Text, nulo (motivo del rechazo) |
| 8 | `reviewed_at` | **Crear** (sustituye a `approval_at`) | **Timestamp**, nulo |
| 9 | `reviewed_by` | **No se crea** | Quién revisó queda en `updated_by` (*User Updated*), porque los estados finales ya no cambian |
| 10 | `approval_at` | **Borrar** | Lo sustituye `reviewed_at` (P5) |
| 11 | `created_at` | Volver a crear | Timestamp, especial *Date Created* |
| 12 | `created_by` | Comprobar | M2O → `directus_users`, especial *User Created* |
| 13 | `updated_at` / `updated_by` | **Crear** | *Date Updated* (Timestamp) y *User Updated* (M2O → `directus_users`) |
| 14 | `period_id` | Sin cambio | Nómina: fuera de alcance. La app no lo lee ni lo escribe |

### 2.2 `com_period`

Fuera de alcance (nómina). No hace falta ningún cambio para este flujo.

### 2.3 Políticas

| Política | Asignar a | `com_over_time` | Otras |
|---|---|---|---|
| `time_log_overtime_leader` | Rol de los Area Manager | **Leer:** filtro *tienda trabajada **o** tienda del empleado* en sus tiendas (§2.4). **Crear:** campos `employee_id`, `store_id`, `work_date`, `minutes`, `observations`, `status`; validación `status = pendiente` y el mismo filtro de tienda sobre `employee_id.store_id`. **Actualizar:** filtro `status = pendiente` + tienda; campos `store_id`, `minutes`, `observations` | Leer `directus_users` (solo `id`, `first_name`, `last_name`). Leer `adm_employees` y `core_stores` (ya los tiene) |
| `time_log_comercial` | Rol del jefe comercial | **Leer:** todo. **Actualizar:** filtro `status = pendiente`; campos `status`, `reviewed_at`, `review_note`; validación `status _in [aprobada, descartada_comercial]` | Leer `adm_employees`, `core_stores`, `com_time_records`, `com_time_record_store` y `directus_users` (`id`, `first_name`, `last_name`) |
| Política de reporte que ya existe | Report y Admin | **Leer** | Leer `directus_users` (nombres) |

- **Nadie tiene permiso para borrar.**
- **El nombre de la política tiene que cumplir la detección del frontend:** debe contener "comercial" **y** "time_log", "timelog" u "horario". Por ejemplo, `time_log_comercial`. Una política llamada solo "comercial" **no** activa el rol.
- **Lectura de `directus_users`:** la lista pide los nombres de quién creó, editó y revisó cada fila. Sin ese permiso, la consulta puede fallar entera.
- **Recomendado:** en el *Actualizar* del comercial, poner el *preset* `reviewed_at = $NOW`. Así Directus usa los valores del servidor aunque el frontend envíe los suyos (§3.3).

### 2.4 Filtro por las tiendas del líder

Hay que comprobar que `core_stores` tenga el alias O2M hacia `core_user_stores`. Si no existe, se crea el alias; no cambia datos. Con él, el filtro de lectura queda así: la tienda de la fila, o la tienda del empleado, tiene un registro en `core_user_stores` del usuario actual (`$CURRENT_USER`) con estado `Activo`.

**Prueba de aceptación de F0:** con un usuario líder de prueba, `GET /items/com_over_time` devuelve solo filas de sus tiendas, y crear una fila de otra tienda responde 403.

---

## 3. Lo implementado (F1)

### 3.1 Archivos

| Archivo | Qué |
|---|---|
| `domain/horasExtras/estados.ts` *(nuevo)* | Catálogo de los cinco estados, etiquetas, finales, activos (para detectar duplicados) y *type guard* |
| `domain/horasExtras/transiciones.ts` *(nuevo)* | `puedeTransicionar(actor, de, a)`: el líder crea en `pendiente`, edita pendientes y gestiona sugeridas; el comercial aprueba o rechaza pendientes. De un estado final no se sale |
| `domain/horasExtras/reglas.ts` *(nuevo)* | `BLOQUE_MINUTOS = 30`. `validarHoraExtra`: fecha no futura, minutos > 0 y múltiplos de 30, observación de 300 caracteres como máximo, empleado activo y de las tiendas del líder. `buscarDuplicado`: aviso, no bloquea. `formatoMinutos` (90 → "1 h 30 min") |
| `domain/horasExtras/periodo.ts` *(nuevo)* | `periodoVigente(periodos, hoy)` y `esRezagada(fila, vigente)` |
| `domain/horasExtras/index.ts` *(nuevo)* | Exportaciones |
| `interfaces/api/overTime.ts` *(nuevo)* | `OverTimeDto`, `CreateOverTimeDto`, `UpdateOverTimeDto`, `ReviewOverTimeDto` |
| `interfaces/api/period.ts` *(nuevo)* | `PeriodDto` |
| `api/directus/horasExtras.ts` *(nuevo)* | `filtroHorasExtras`, `listarHorasExtras`, `listarPeriodos`, `crearHoraExtra` (siempre en `pendiente`), `actualizarHoraExtra` y `revisarHorasExtras` (lote, en una sola petición) |
| `hooks/registro/keys.ts` | Claves `horasExtras.todos`, `horasExtras.lista(filtros)` y `periodos` |
| `hooks/useHorariosPolicies.ts` | `esComercial()` |
| `__test__/domain/horasExtras.test.ts` *(nuevo)* | 14 tests: validación, transiciones, finales, periodo vigente, rezagadas, duplicado y formato |
| `__test__/api/horasExtras.test.ts` *(nuevo)* | 7 tests: filtro (pruebas, rotación, combinado), creación en `pendiente` y revisión (periodo, motivo, lote vacío, sin llamada a Directus si falta un dato) |
| `__test__/hooks/useHorariosPolicies.test.ts` | 2 tests de `esComercial` |
| `__test__/hooks/useHorariosAcceso.test.ts`, `useAceptacionNormasEmpleados.test.ts` | A los mocks se les agrega `esComercial` (tipo) |

### 3.2 Cómo funciona

- **Lista** (`listarHorasExtras`):
  - Filtra por tiendas (la trabajada **o** la del empleado), empleado, rango de `work_date`, estados y periodo.
  - Excluye la tienda 90 salvo con `incluirPruebas`. La tienda 5 ya viene excluida de las tiendas permitidas del líder.
  - Ordena por día descendente.
  - Expande el empleado, la tienda, el periodo y los usuarios que crearon, editaron y revisaron.
- **Crear:** siempre con `status = pendiente`. El frontend no permite elegir el estado y Directus lo vuelve a validar (§2.3).
- **Revisar** (`revisarHorasExtras(ids, decisión)`):
  - Aprobar exige `periodId`, el del periodo vigente.
  - Rechazar exige un motivo, que se guarda sin espacios sobrantes en `review_note`.
  - Las dos decisiones guardan `reviewed_at`. Quién revisó lo registra Directus en `updated_by`.
  - Si falta un dato, falla **antes** de llamar a Directus.
- **Errores:** todas las funciones usan `errorDeApi`, igual que el resto de `api/directus`. Los mensajes quedan listos para `useAvisos` en F2.

### 3.3 Atajos conocidos (`shortcut:` en el código)

| Dónde | Límite | Cuándo mejorarlo |
|---|---|---|
| `revisarHorasExtras` | `reviewed_at` usa la hora del dispositivo, en UTC | Al aplicar el *preset* `$NOW` de §2.3. Así Directus pone la hora del servidor |

### 3.4 Lo que pasa a F2

- **`'comercial'` como `Rol`, `INICIO_POR_ROL` y `tiendasPermitidas`:** no se agregan todavía. Si el rol existiera sin la sección `horas-extras`, su página de entrada no existiría: `IndexRedirect` y `RequireRole` redirigirían en bucle. Se agregan junto con la sección. Hasta entonces, un usuario con la política comercial sigue viendo la app como hoy.
- **Hook `useHorasExtras` (React Query):** va con la primera pantalla que lo use. Las claves de caché ya están.

---

## 4. Verificación

| Comprobación | Resultado |
|---|---|
| `vitest run src/apps/horarios` | **43 archivos, 326 tests en verde** (303 → 326) |
| `tsc --noEmit` en Horarios | Sin errores nuevos. Siguen los 4 de `MonitoreoPage.tsx`, anteriores a este cambio |
| `eslint` sobre los archivos nuevos | Sin errores. Las llamadas a `readItems`, `createItem` y `updateItem(s)` no necesitan `as any` |
| Directus real | **No probado:** el esquema de §2 aún no existe |

---

## 5. Siguiente paso

1. **Aplicar §2 en Directus** y hacer la prueba de aceptación de §2.4.
2. **F2, líder:**
   - sección `horas-extras` con su sub-pestaña Solicitudes;
   - rol `comercial` completo;
   - `useHorasExtras`;
   - formulario con apoyo: jornada del empleado y apertura y cierre de la tienda.
3. Al terminar F2, probar en el navegador con un usuario líder, contra los permisos reales.
