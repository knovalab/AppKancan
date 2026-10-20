# Horas extras: análisis y plan de acción

> **Fecha:** 2026-10-20, sobre `setup` @ `d9f2b2c`. Solo análisis: **no se cambió código, datos ni esquema**.
> **Alcance:** flujo manual de horas extras. El líder de zona las crea y el comercial las aprueba o rechaza. Incluye un histórico con su seguimiento. Las sugerencias del sistema quedan preparadas, pero no se implementan.
> **Alcance actualizado (2026-10-20):** la **nómina (periodos y rezagadas) queda fuera**, y el líder ve las horas extras registradas y registra nuevas buscando al empleado. Ver [`HORAS_EXTRAS_F2A_LIDER.md`](HORAS_EXTRAS_F2A_LIDER.md) §1. Lo que este plan dice sobre periodos, rezagadas y la lista del líder ya no aplica.
> **Decisiones P1–P8 (2026-10-20):** en [`HORAS_EXTRAS_F0_F1.md`](HORAS_EXTRAS_F0_F1.md) §1, que prevalece sobre este plan. Cambian el §3.2 (siempre al periodo vigente), el nombre `approval_at` (ahora `reviewed_at`) y el retiro de pendientes (no existe).
> **Relacionado:** `ETL_HORAS_EXTRAS.md` (diseño original del ETL), `ETL_DIRECTUS_ESQUEMA_ANALISIS.md` (esquema real de `com_over_time` y `com_period`), `ETL_DIA_TIENDA_APLICADO.md` (periodos y día de tienda). Estos documentos se borraron del árbol de trabajo (§8.1); se leyeron desde git.

---

## 0. Resumen

| Tema | Propuesta |
|---|---|
| Colección | **Adaptar `com_over_time`**, que ya existe y está vacía. No crear `extra_time` (§2.1) |
| Nombres de campo | Mantener los reales: `employee_id` en lugar de `user_id` y `minutes` en lugar de `hours` (§2.1) |
| Horas enteras | **No**: guardar **minutos enteros** (ya es así) y capturar en la UI horas y minutos. Pendiente de confirmar (P1) |
| Campos nuevos en `com_over_time` | `work_date`, `observations`, `review_note`, `updated_at`/`updated_by` y `reviewed_by` (§2.1) |
| Estados | Cambiar `Gen/Req/Aprov/Decl` por los cinco del flujo (§3) |
| `period_id` | Se asigna **al aprobar** (§3.2). Las rezagadas salen de esa regla |
| Seguimiento | Sin tabla de historial: el flujo tiene como máximo dos transiciones y los estados finales no cambian. Bastan los campos de la fila (§3.3) |
| Ubicación | **Nueva sección "Horas extras"** con tres sub-pestañas por rol: Solicitudes, Aprobación e Histórico. No se agrega a Monitoreo (§4) |
| Rol nuevo | **Comercial**: una política que contenga "comercial" **y** "time_log"/"horario" (§5) |
| ETL | Ahora solo cambian los tipos y el nombre de los periodos. Las sugerencias siguen como `shortcut` (§7) |
| Bloqueantes | Que existan periodos en `com_period`, los permisos de Directus filtrados por las tiendas del líder y las preguntas P1–P6 (§9) |

---

## 1. Lo que ya existe

| Pieza | Estado | Dónde |
|---|---|---|
| `com_over_time` | Creada y **vacía**. Campos: `employee_id`, `store_id`, `minutes`, `status`, `approval_at`, `created_at`, `created_by`, `period_id`. **No tiene `work_date`** | `ETL_DIRECTUS_ESQUEMA_ANALISIS.md` §2.1 |
| `com_period` | Creada. Campos: `start_date`, `end_date`, `created_at`, `created_by`. **No tiene `name` ni `liquidacion_date`**. Sin filas al 2026-10-17 | Ídem §2.2 |
| Creación de periodos | El ETL calcula las quincenas y llama a `asegurarPeriodo`, pero **le falta permiso para crear en `com_period`** | `services/horarios-etl/src/load/periodo.ts` |
| `com_time_record_store` | Lo escribe el proceso nocturno. Solo tiene días pasados | `src/load/registroTienda.ts` |
| Horas extras en el ETL | Funciones vacías con `shortcut`. Tipo `EstadoHoraExtra = 'Gen' \| 'Req' \| 'Aprov' \| 'Decl'` | `src/transform/horasExtras.ts`, `src/load/horasExtras.ts`, `src/directus/schema.ts` |
| Tiendas del líder | `useHorariosAcceso` lee `core_user_stores` (Directus ya lo filtra por usuario) y excluye la tienda 5 | `hooks/useHorariosAcceso.ts` |
| Sub-pestañas por ruta | `SubSeccionLayout` y `subsecciones` en `SECCIONES` existen, pero **nadie las usa como rutas todavía**. Monitoreo y Reporte usan pestañas internas por índice | `layouts/SubSeccionLayout.tsx`, `navigation/secciones.ts` |
| Patrones de API | `withAutoRefresh` + `readItems`, `FiltroDirectus`, `errorDeApi`/`mensajeDeError`, claves en `horariosKeys` y avisos con `useAvisos` | `api/directus/*.ts`, `hooks/registro/keys.ts` |

---

## 2. Cambios de datos (Directus)

> Nada de esto se aplicó. Lo debe hacer un administrador de Directus en la fase F0 (§6). Las dos colecciones están vacías, así que no se pierden datos.

### 2.1 `com_over_time`: adaptar, no crear `extra_time`

Motivos para adaptarla: ya está en **Commerce → Time Tracking** con el prefijo `com_`, el ETL ya tiene sus tipos y su política de servicio la incluye, y está vacía.

| Campo | Hoy | Cambio | Motivo |
|---|---|---|---|
| `employee_id` | M2O → `adm_employees` | Sin cambio. Pasa a **requerido** | Es tu `user_id`, con el mismo nombre que en `com_time_records` |
| `store_id` | M2O → `core_stores` (id **texto**) | **Requerido y siempre lleno** | El modelo dice "se llena cuando el usuario no tiene tienda", pero los permisos por tienda del líder y los filtros dependen de él. Propuesta: **la tienda donde se trabajaron las horas** (P4) |
| `minutes` | Integer | Sin cambio. Requerido y > 0 | Sustituye a `hours`. Con horas enteras se pierden 30 o 45 minutos. Decimal daría problemas de redondeo en nómina (P1) |
| `status` | String (`Gen/Req/Aprov/Decl`, sin verificar) | Nuevas opciones (§3.1), regla de validación `_in`, requerido. Sin valor por defecto, o `pendiente` | Directus solo valida el desplegable en el formulario del Data Studio. La API necesita la regla |
| `work_date` | No existe | **Crear**: Date, requerido | Una fila por empleado y **día**, no por periodo. Permite ver la jornada de apoyo, detectar duplicados y calcular las rezagadas |
| `observations` | No existe | **Crear**: Text, máximo 300 caracteres | Justificación del líder. Mismo límite que `MAX_CARACTERES_OBSERVACION` |
| `review_note` | No existe | **Crear**: Text | **Motivo del rechazo**. Obligatorio al rechazar (lo valida la UI) |
| `reviewed_by` | No existe | **Crear**: M2O → `directus_users` | Quién aprobó o rechazó |
| `approval_at` | DateTime | **Cambiar a Timestamp** y usarlo para la **fecha de la decisión**, apruebe o rechace (P5) | Sin zona horaria, el valor depende de quién lo escriba (`ETL_DIRECTUS_ESQUEMA_ANALISIS.md` §3.1) |
| `created_at` / `created_by` | DateTime / UUID | `created_at` → Timestamp con *Date Created*. Comprobar que `created_by` sea *User Created* (M2O) | Quién creó la fila, para el histórico |
| `updated_at` / `updated_by` | No existen | **Crear**: *Date Updated* / *User Updated* | Detectar ediciones mientras está `pendiente` |
| `period_id` | M2O → `com_period` | Sin cambio. Se llena al aprobar (§3.2) | |

**Unicidad:** una fila **activa** (`sugerida`, `pendiente` o `aprobada`) por empleado y `work_date`. Directus no tiene índices compuestos condicionados, así que la UI lo comprueba antes de guardar. Dos líderes guardando a la vez podrían crear un duplicado. El riesgo es bajo y lo ve el comercial. Si hiciera falta, se agrega un Flow de Directus que bloquee el duplicado.

### 2.2 `com_period`

| Campo | Cambio | Motivo |
|---|---|---|
| `name` | **Crear**: String. Ejemplo: "2026-10 · 1.ª quincena" | Mostrarlo en filtros y exportaciones. Lo llena el ETL (§7) |
| `liquidacion_date` | **Crear**: Date, nulo | Fecha de liquidación de la nómina. Con ella se sabe si un periodo ya está "cerrado" (§3.2). Quién la llena: P3 |
| `created_at` | Cambiar a Timestamp | Igual que en §2.1 |
| Filas | **Tienen que existir** antes de aprobar | Dar a la política del ETL el permiso para crear que falta y rellenar con el CLI, o que un administrador las cree a mano |

### 2.3 `com_time_record_store`

No cambia. Se usa solo para mostrar apoyo en el formulario (apertura y cierre de la tienda ese día).

### 2.4 Permisos por rol

Hay que crear las políticas nuevas y asignarlas a los roles de Directus que corresponda.

| Política (propuesta) | Para | `com_over_time` | Otras colecciones |
|---|---|---|---|
| `time_log_overtime_leader` | Area Manager | **Leer** y **crear** con el filtro de *sus tiendas*. **Actualizar** solo si `status` es `sugerida` o `pendiente` y la tienda es suya, y solo los campos `status` (a `pendiente` o `descartada_lider`), `minutes` y `observations`. Al crear, `status` solo puede ser `pendiente` | Leer `com_period` y `com_time_record_store`. Las marcaciones y los empleados ya los lee |
| `time_log_comercial` | Comercial | **Leer** (alcance: P2). **Actualizar** solo si `status = pendiente`, y solo los campos `status` (a `aprobada` o `descartada_comercial`), `approval_at`, `reviewed_by`, `review_note` y `period_id` | Leer `com_period`, `adm_employees`, `core_stores`, `com_time_records` y `com_time_record_store` (como apoyo) |
| Se agrega lectura a la política de reporte | Report y Admin | **Leer** | Leer `com_period` |
| `crud_overtime_etl` (ya existe) | ETL | Más adelante: crear solo con `status = sugerida` y actualizar solo filas `sugerida` | **Crear** en `com_period` (falta hoy) |

- **Nadie borra.** Los descartes son estados, no borrados.
- ⚠️ **Filtro por "sus tiendas" en Directus:** hay que comprobar que `core_stores` tenga una relación inversa (O2M) hacia `core_user_stores`. Así el permiso se puede escribir como "la tienda de la fila tiene un `core_user_stores` del usuario actual". Si esa relación no existe, se crea el alias O2M (no cambia datos). **Sin este filtro, el líder podría leer o modificar horas de otras tiendas llamando a la API directamente.** El filtro de la UI no basta.
- **Validaciones en Directus** (además de las de la UI): `minutes > 0`, `status _in [...]` y, si Directus lo admite en la validación, `work_date <= $NOW` (por verificar).

---

## 3. Flujo de estados

### 3.1 Valores

| Valor en BD (propuesto) | Texto | Final | Quién lo pone |
|---|---|---|---|
| `sugerida` | Sugerida | No | ETL *(futuro)* |
| `pendiente` | Pendiente | No | Líder: al crear, o al solicitar una sugerida |
| `descartada_lider` | Descartada por el líder | **Sí** | Líder, sobre una `sugerida`, o al retirar una `pendiente` (P6) |
| `descartada_comercial` | Rechazada | **Sí** | Comercial |
| `aprobada` | Aprobada | **Sí** | Comercial |

Se usan los valores que propones en lugar de `Gen/Req/Aprov/Decl`: la colección está vacía y así no se arrastra una tabla de equivalencias. Como en marcaciones y novedades, **los valores no se pueden cambiar** una vez haya datos. Por eso viven en un único catálogo del dominio (`domain/horasExtras/estados.ts`), igual que `MARCACIONES`.

**Transiciones permitidas** (el dominio las valida y Directus las vuelve a exigir con los permisos del §2.4):

| De | A | Rol |
|---|---|---|
| (nueva) | `pendiente` | Líder |
| `sugerida` | `pendiente` (tal cual o editada) / `descartada_lider` | Líder |
| `pendiente` | `pendiente` (editar minutos u observación) | Líder |
| `pendiente` | `aprobada` / `descartada_comercial` | Comercial |

### 3.2 Periodo: cuándo se asigna `period_id`

**Se asigna al aprobar.** Al crear no se sabe cuándo se aprobará, y una hora aprobada tarde no puede caer en un periodo ya liquidado.

Al aprobar se toma **el periodo que contiene el `work_date`**, siempre que no esté liquidado: `liquidacion_date` vacía o posterior a hoy. Si ya está liquidado, se toma **el periodo vigente**, el que contiene hoy.

**Rezagadas** (tu §2.4): horas con `work_date` anterior al inicio del periodo vigente y sin `period_id`. Con esta regla son:
- las **pendientes antiguas**: el comercial las ve primero y marcadas como "Rezagada". Al aprobarlas van al periodo vigente;
- las **aprobadas que se quedaron sin periodo**, porque no existía el periodo vigente al aprobar. El histórico ofrece una acción para asignarlas al periodo vigente. No debería pasar si los periodos existen (§2.2).

No hace falta ningún proceso nocturno: son una consulta.

### 3.3 Seguimiento (línea de tiempo)

**No hace falta guardar un historial aparte.** El flujo tiene como máximo dos transiciones y los estados finales no cambian. La línea de tiempo se arma con los campos de la fila:

1. **Creada:** `created_at` y `created_by`.
2. **Editada** (si `updated_at` es posterior a `created_at` mientras estuvo pendiente): `updated_at` y `updated_by`.
3. **Aprobada o rechazada:** `approval_at`, `reviewed_by` y `review_note`.

`directus_activity` y `directus_revisions` **no se recomiendan** para la UI:
- exigen dar a líderes y comerciales permiso de lectura sobre colecciones de sistema que mezclan todo AppKancan;
- su formato no es estable.

Si más adelante se necesita el detalle de cada edición (minutos antes y después), se leen las revisiones solo de `com_over_time` desde Admin.

### 3.4 Quién edita una `pendiente`

Puede editarla **cualquier líder de la tienda**, no solo quien la creó: si un líder se va, otro la retoma. Solo puede cambiar los minutos y la observación. El comercial **no** edita minutos: si no está de acuerdo, rechaza con un motivo y el líder crea una nueva. Así la cifra aprobada siempre es la que pidió el líder.

---

## 4. Ubicación de las pantallas

**Propuesta: una sección nueva, `/horarios/horas-extras`, con sub-pestañas por rol.** No va dentro de Monitoreo ni de Reporte.

| Sub-pestaña | Ruta | Roles | Contenido |
|---|---|---|---|
| **Solicitudes** | `/horarios/horas-extras/solicitudes` | Area Manager | Lista de sus tiendas (§4.1 de tu documento), botón **Nueva hora extra** (formulario) y, en el futuro, las sugeridas con Solicitar y Descartar |
| **Aprobación** | `/horarios/horas-extras/aprobacion` | Comercial | Tabla de pendientes, con las rezagadas primero. Aprobar y rechazar por fila y en lote |
| **Histórico** | `/horarios/horas-extras/historico` | Area Manager, Comercial, Report, Admin | Todas las filas con estado, periodo y seguimiento. Exportación a Excel |

**Por qué no en Monitoreo** (tu idea inicial):
- `MonitoreoPage.tsx` tiene unas 2.800 líneas, y sus pestañas son índices fijos (`subTab === 5`, `subTab === 6` para Control de Horas y Editar registros). Una pestaña más sube ese acoplamiento, y la pestaña del líder tendría que convivir con lógica que no usa.
- El comercial necesita una sección propia de todos modos. Con una sola sección, líder, comercial e histórico comparten tipos, consultas, filtros y tabla, y cada rol ve solo su sub-pestaña.
- Es el primer uso real de `subsecciones` + `SubSeccionLayout` como rutas, que es la dirección que ya marca `MonitoreoSeccion.tsx` ("pasarán a sub-rutas con SubSeccionLayout"). La pestaña aparece en la URL y se puede compartir.

**Por qué no el histórico en Reporte:** Reporte tiene su propio selector y pestañas internas. Duplicarlo ahí obliga a mantener dos tablas. En su lugar, las horas extras **se agregan a la exportación unificada** de Reporte, para que Report y el Area Manager las tengan junto al resto.

Si prefieres tu ubicación, el plan sigue sirviendo: la lista del líder sería la pestaña 7 de Monitoreo y el histórico, la pestaña 6 de Reporte. Las piezas de §5 son las mismas; solo cambia dónde se montan.

**Selector de tienda:** "Una o todas" (`tienda: 'una-o-todas'`) en el header, con la tienda en `?tienda=`. "Todas" significa las tiendas permitidas del usuario. Siempre se excluyen la tienda 5 y la 90 (pruebas), con un interruptor opcional para incluir la 90, como en las exportaciones.

---

## 5. Frontend: qué se crea y qué se reutiliza

### 5.1 Navegación y rol Comercial

| Archivo | Cambio |
|---|---|
| `hooks/useHorariosPolicies.ts` | Agregar `esComercial`: una política que contenga "comercial" **y** cumpla `MODULO_REGEX` (time_log/horario). Exigir las dos cosas evita que se cuele una política "comercial" de otro módulo |
| `navigation/secciones.ts` | Agregar `'comercial'` a `Rol`, la sección `horas-extras` con sus tres subsecciones y `INICIO_POR_ROL.comercial = 'horas-extras'`. Prioridad: **admin, areaManager, comercial, tienda, report** (por encima de report, porque su trabajo diario es aprobar) |
| `hooks/useHorariosAcceso.ts` | Agregar el rol `comercial` y sus `tiendasPermitidas`: todas, o las de `core_user_stores` (P2) |
| `routes.tsx` | `HorasExtrasSeccion` con carga diferida y rutas hijas por subsección. Cada hija lleva su `RequireRole` con los roles de su subsección |
| `layouts/SubSeccionLayout.tsx` | Reutilizar. Comprobar que funciona como ruta padre; es la primera vez que se usa así |

### 5.2 Dominio (funciones puras y con tests)

`domain/horasExtras/`:

- `estados.ts`: catálogo de estados (valor, texto, color, si es final).
- `transiciones.ts`: qué rol puede pasar de qué estado a cuál (§3.1).
- `reglas.ts`: validaciones del formulario:
  - fecha no futura;
  - minutos > 0 y con un máximo diario (P1);
  - empleado activo y de una tienda permitida;
  - posible duplicado.
- `periodo.ts`: elegir el periodo al aprobar y decidir si una fila es rezagada (§3.2).

Todo con tests unitarios, como `domain/registro`.

### 5.3 Tipos y API

| Archivo | Contenido |
|---|---|
| `interfaces/api/overTime.ts` *(nuevo)* | `OverTimeDto`, `CreateOverTimeDto`, `UpdateOverTimeDto`, `EstadoHoraExtra`. `store_id` es **texto** |
| `interfaces/api/period.ts` *(nuevo)* | `PeriodDto` |
| `interfaces/horasExtras.ts` *(nuevo)* | Modelo de UI (`HoraExtraFila`, `FiltrosHorasExtras`) |
| `api/directus/horasExtras.ts` *(nuevo)* | `listarHorasExtras(filtros)`, `crearHoraExtra`, `actualizarHoraExtra`, `revisarHorasExtras(ids, decisión, nota)` (una sola llamada `updateItems` en lote), `listarPeriodos`, `periodoVigente`. Mismo patrón que `reports.ts`: `withAutoRefresh`, `FiltroDirectus` y `errorDeApi` |
| `hooks/useHorasExtras.ts` *(nuevo)* | Consultas y mutaciones con React Query. Claves en `horariosKeys.horasExtras`. Invalida la lista al guardar y avisa con `useAvisos` |
| `interfaces/api/timeRecordStore.ts` | De paso: `store` llega con id **texto**, pero el tipo dice `number` |

### 5.4 Componentes

| Pieza | Nueva o reutilizada |
|---|---|
| Filtros: tienda, empleado, rango, estado, periodo | **Nueva** `HorasExtrasFiltros`. Reutiliza `DateRangeFilter` y el selector de tienda del header |
| Tabla con paginación | **Nueva** `HorasExtrasTabla`, con la misma estructura que `com_time_record_store/ReporteTiendasTable` + `ReporteTiendasPagination`. Selección múltiple solo en Aprobación |
| Chip de estado | **Nuevo** `HoraExtraEstadoChip`, como `ReporteTiendasStatusChip`, con los colores del catálogo |
| Formulario Nueva o Editar hora extra | **Nuevo** `HoraExtraFormModal`: tienda, empleado (Autocomplete de los activos de la tienda), `work_date` (máximo hoy), horas y minutos, observación. Validación con yup, como `novedadSchema` |
| Apoyo en el formulario | Debajo del formulario: **jornada del empleado ese día** (`getEmployeeTimeRecords`, que ya existe) y **apertura y cierre de la tienda** (`fetchTimeRecordStore`; solo hay datos de días pasados, §8.2). Muestra los minutos trabajados con `calcularMinutosDia` como referencia, sin decidir nada |
| Aviso de duplicado | En el formulario: "Este empleado ya tiene X h Y min en estado Pendiente ese día". No bloquea si el estado es final descartado |
| Rechazar | **Nuevo** `RechazoHoraExtraModal`, con motivo obligatorio. Sirve para una fila o para un lote |
| Aprobar en lote | Confirmación con un resumen: número de filas, minutos totales y a qué periodo va cada grupo |
| Seguimiento | **Nuevo** `HoraExtraTimeline` en un modal de detalle. Se puede inspirar en `historial/HistorialTimelineView`, aunque los datos son otros |
| Exportación | **Nuevo** `utils/exportarHorasExtras.ts`, como `exportarNovedades`, y una opción más en `ExportUnificadoDialog` |
| Avisos | `useAvisos` (verde si sale bien, rojo con `mensajeDeError` si falla) |
| Tour | Pasos para Solicitudes y Aprobación con datos simulados, como `monitoreoTourSteps`. **Última fase** |

---

## 6. Orden de implementación

| Fase | Entregable | Criterio de aceptación |
|---|---|---|
| **F0: Decisiones y esquema** | Respuestas a P1–P6. Un administrador aplica el §2 en Directus: campos, estados, validación, políticas, filtro por tiendas y periodos creados | Con un usuario líder de prueba, leer una fila de otra tienda por la API devuelve vacío o 403 |
| **F1: Dominio, tipos y API** | §5.2 y §5.3. Rol `comercial` en políticas y acceso | Tests en verde: transiciones, reglas, periodo y rezagadas. `tsc` sin errores nuevos |
| **F2: Líder** | Sección y subsección Solicitudes: lista, filtros, formulario y editar pendientes | El líder crea una hora extra y la ve como Pendiente. No ve tiendas que no son suyas |
| **F3: Comercial** | Subsección Aprobación: aprobar y rechazar por fila y en lote, asignación de periodo y rezagadas primero | La aprobada tiene periodo y fecha de decisión. La rechazada tiene motivo. Ninguna de las dos se puede volver a editar |
| **→ Flujo manual completo** | F0–F3 | Prueba en el navegador con los dos roles |
| **F4: Histórico y exportación** | Histórico, línea de tiempo, asignar rezagadas al vigente, Excel y exportación unificada | El Excel cuadra con la tabla filtrada |
| **F5: Tour y documentación** | Tours, actualización de `context.md` y tipos del ETL (§7) | Tour sin escrituras en Directus |
| **Futuro: sugerencias** | El ETL crea filas `sugerida`. El líder las solicita o las descarta en Solicitudes | Depende de la regla de horas extras (`ETL_HORAS_EXTRAS.md` §8.1) |

---

## 7. Impacto en el ETL

| Cambio | Cuándo | Qué |
|---|---|---|
| Tipos | F1 | `src/directus/schema.ts`: `EstadoHoraExtra` con los cinco valores. `HoraExtra` con `work_date`, `observations`, `review_note`, `reviewed_by`, `updated_*`. `Periodo` con `name` y `liquidacion_date` |
| Nombre del periodo | F0/F1 | `asegurarPeriodo` llena `name` al crear la quincena. Sin esto, las filas creadas a mano quedan sin nombre |
| Crear periodos | F0 | Dar a la política del ETL el permiso para crear en `com_period` que falta y rellenar desde octubre con el CLI. **Sin periodos no se puede aprobar** |
| `shortcut` de horas extras | F5 | Actualizar el comentario: las filas futuras van en `sugerida`, con `work_date` y clave (empleado, día). Solo crear filas nuevas o actualizar las que siguen `sugerida` |
| Rezagadas | Ninguno | Es una consulta del frontend (§3.2) |

---

## 8. Riesgos

| Riesgo | Mitigación |
|---|---|
| **8.1 Trabajo sin commitear perdido.** La carpeta `results/` está vacía en el árbol de trabajo: 8 documentos estaban en el índice y 7 en `HEAD`. También desapareció el endpoint `GET /tiendas/jornadas` del ETL y la conexión de Monitoreo de la sesión anterior: `src/consultas/` está vacía y la pestaña vuelve a leer Directus. `context.md` no se había agregado a git, así que no se puede recuperar con git | Confirmar si fue intencional. Los documentos se recuperan con `git restore` (o `git checkout HEAD --`). El endpoint habría que rehacerlo |
| 8.2 Apoyo del día actual | `com_time_record_store` solo tiene días pasados. Para hoy se muestran solo las marcaciones del empleado, o se recupera el endpoint de jornadas (8.1) |
| Permisos solo en la UI | El filtro por tiendas tiene que estar **en Directus** (§2.4), y se prueba en F0 |
| Ids de tienda como texto (`"90"`) | Comparar siempre como texto. Hay un test para la exclusión de las tiendas 5 y 90 |
| Fechas sin zona (DateTime) | Pasar a Timestamp en F0. Si no se hace, escribir siempre la hora de Bogotá con `getRealColombiaTime` |
| Duplicados por concurrencia | Comprobación en la UI y, si hace falta, un Flow de Directus (§2.1) |
| Que se cuele un rol Comercial | Exigir "comercial" + time_log/horario (§5.1) |
| Monitoreo sigue creciendo | La sección nueva no lo toca |

---

## 9. Preguntas abiertas

| # | Pregunta | Propuesta |
|---|---|---|
| **P1** | ¿Se guardan minutos enteros (ya es así) en lugar de `hours` int? ¿Se capturan en bloques de 15 o 30 minutos? ¿Hay un máximo por día? | Minutos, bloques de 15 y un máximo de 4 h al día, salvo que RR. HH. diga otra cosa |
| **P2** | El comercial ¿ve todas las tiendas o solo las suyas (`core_user_stores`)? | Las suyas, si los comerciales tienen tiendas asignadas. Si no, todas |
| **P3** | ¿Quién llena `liquidacion_date` y cuándo? ¿Un periodo liquidado bloquea aprobar horas de ese periodo? | La llena el comercial o RR. HH. (pantalla pequeña en F4, o a mano en Directus al principio). Sí bloquea: va al vigente (§3.2) |
| **P4** | `store_id`: ¿siempre la tienda donde se trabajó, aunque el empleado tenga tienda? ¿Pueden los líderes crear horas a empleados de otra tienda que trabajaron en la suya (préstamos)? | Siempre la tienda trabajada. Préstamos: no en F2 |
| **P5** | ¿`approval_at` guarda también la fecha del rechazo, o se agrega `reviewed_at`? | Usar `approval_at` para la decisión, apruebe o rechace. Es un campo menos |
| **P6** | ¿El líder puede **retirar** una pendiente antes de que la revisen? ¿Con qué estado queda? | Sí, queda `descartada_lider` |
| P7 | ¿El usuario de tienda ve sus horas extras? | No en esta etapa |
| P8 | ¿Hacen falta notificaciones (por ejemplo, avisar al comercial de que hay pendientes)? | No en esta etapa. El contador está en la pestaña |
