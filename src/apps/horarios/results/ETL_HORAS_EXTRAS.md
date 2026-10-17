# ETL de horas extras (Fase 2) — Análisis y propuesta

> **Fecha:** 2026-10-16, sobre `setup` @ `d751023`.
> **Fuentes:** el esquema de `src/apps/horarios/temp/Screenshot From 2026-10-16 09-38-17.png` ("FASE 2: ETL"), `docs/` (sobre todo `POLITICAS_BASE_DATOS.md`, `DOCUMENTACION_HORARIOS.md`, `CONFIGURACION_DESPLIEGUE.md` y `GUIA_API_DIRECTUS.md`), el backend actual (`server/`) y el despliegue (`Dockerfile`, `docker-compose.yml`).
> **Pregunta:** ¿se puede hacer con **Bun + Hono** en este proyecto, o mejor **Node.js + Hono**? ¿Cómo se monta un "service worker" de tipo ETL que procese las horas extras, las guarde en Directus y el frontend las muestre?

---

## 0. Respuesta corta

- **Sí se puede hacer con Bun + Hono**, y también con Node + Hono. Hono funciona igual en los dos; lo que cambia es la imagen de Docker y cómo se ejecuta TypeScript.
- **Recomendación: un servicio aparte (`services/horarios-etl/`) con Hono y código independiente del runtime, desplegado con Node 22** (como el resto del proyecto). Bun queda como opción para desarrollo local o si el equipo lo prefiere en producción: el cambio es una línea en el `Dockerfile` y el archivo de arranque.
  - Motivo: el ETL está limitado por la red (leer y escribir en Directus), no por la CPU, así que la velocidad de Bun no aporta casi nada.
  - Node evita una segunda toolchain en Docker y en CI. Hoy **Bun no está instalado** ni en el contenedor de desarrollo ni en las imágenes.
- **No es un "service worker" del navegador.** Es un **worker de backend**: un proceso que se ejecuta por cron (y bajo demanda), lee las marcaciones de Directus, calcula y escribe el resultado en Directus. El frontend **solo lee** lo calculado y gestiona las aprobaciones.
- **Antes de construir hay que cerrar 4 decisiones de negocio** (§8). La principal: **qué cuenta como hora extra**. El esquema define dónde se guarda, pero no cómo se calcula.

---

## 1. Lo que define el esquema (Fase 2)

### 1.1 Tablas

| Esquema | Campos | Observaciones |
|---|---|---|
| **Registro de tienda** (`time_record_store`) | `store_id`, `work_day` (fecha), `open_time` (datetime), `close_time` (datetime), `operative_time` (number) | Una fila por **tienda y día** |
| **Horas extras** (`extra_time`) | `user_id`, `store_id` *(si el usuario no tiene tienda)*, `hours` (int), `status` (`Gen` \| `Req` \| `Aprov` \| `Decl`), `approval_at` (null \| time), `created_at`, `created_by`, `period_id` | `Req` = la solicita el **líder de zona** |
| **Periodo** (`period`) | `created_at`, `created_by`, `start_date`, `end_date` | Ventana de liquidación |

### 1.2 Reglas que fija el esquema

- **Apertura** de la tienda = el **primer** registro de la tienda en el día.
- **Cierre** = el **último** registro de la tienda, tomando como referencia **los empleados asociados con la marcación completa**.
- **Tiempo operativo** = cierre − apertura (por deducción).

### 1.3 Colecciones y campos (convención actual de producción)

> **No se aplica `POLITICAS_BASE_DATOS.md`.** En producción, Horarios no usa esa nomenclatura (`hr_`, plural, `date_created`…). Las colecciones del módulo están en la carpeta **Commerce → Time Tracking** con prefijo **`com_`**, y `com_time_record_store` **ya existe**. Las nuevas siguen esa misma convención y **tus nombres** de campo.

#### 1.3.1 Lo que hay hoy en Directus (captura `temp/schema-directus actual.png`)

| Nombre visible en Directus | Colección (key) | Uso en la app |
|---|---|---|
| Com Newness | `com_newness` | Tipos de novedad |
| Com Reasons | `com_reasons` | Motivos de edición de hora |
| Com Newness Reports | `com_newness_reports` | Novedades reportadas |
| Com Store Closed Days | `com_store_closed_days` | Días de tienda cerrada |
| Motivos de los registros | `com_records_reasons` | Motivo asignado a una marcación |
| Com Event Reports | `com_event_reports` | Pausas activas |
| Com Time Records | `com_time_records` | Marcaciones (lo que lee el ETL) |
| **Com Time Record Store** | **`com_time_record_store`** | **Nueva (ya creada):** día operativo de la tienda |

#### 1.3.2 Tabla de equivalencias

| Tu nombre (esquema) | Tipo / esquema (TypeScript) | Colección en Directus | Nombre visible en Directus | Estado |
|---|---|---|---|---|
| `time_record_store` | `TimeRecordStoreDto` | `com_time_record_store` | Com Time Record Store | ✅ Ya existe |
| `extra_time` | `ExtraTimeDto` | `com_over_time` | Com Over Time | Colección creada, **sin campos** (2026-10-17) |
| `period` | `PeriodDto` | `com_period` | Com Period | Colección creada, **sin campos** (2026-10-17) |
| — *(opcional)* | `EtlRunDto` | `com_etl_runs` | Com Etl Runs | Por crear si se quiere el registro de ejecuciones |

Las tres se crean dentro de la carpeta **Commerce → Time Tracking**. Los tipos van en `src/apps/horarios/interfaces/api/` (`timeRecordStore.ts`, `extraTime.ts`, `period.ts`, `etlRuns.ts`).

#### 1.3.3 Campos

Los nombres de campo son **los de tu esquema**. En TypeScript, cada propiedad se llama igual que el campo de Directus.

| Colección | Campo | Tipo en Directus | Tipo en TypeScript | Nota |
|---|---|---|---|---|
| `com_time_record_store` | `id` | Integer (auto) | `number` | |
| | `store` | M2O → `core_stores` (id texto) | `Relacion` | En Directus se llama `store`, no `store_id` |
| | `work_day` | Date | `string` (YYYY-MM-DD) | Ej. `2026-10-15` |
| | `open_time` | DateTime | `string \| null` (ISO) | Primer registro de la tienda en el día |
| | `close_time` | DateTime | `string \| null` (ISO) | Último registro de los empleados con la marcación completa |
| | `operative_time` | Integer | `number \| null` | Recomendado: **minutos** |
| `com_over_time` | `id` | Integer (auto) | `number` | |
| | `employee_id` | M2O → `adm_employees` | `Relacion` | El **empleado** (mismo nombre que en `com_time_records`). *En tu esquema original: `user_id`* |
| | `store_id` | M2O → `core_stores` | `Relacion` | Si el empleado no tiene tienda |
| | `minutes` | Integer | `number` | Minutos. *En tu esquema original: `hours`*; con horas enteras se perdían 30 o 45 min |
| | `status` | String (dropdown) | `'Gen' \| 'Req' \| 'Aprov' \| 'Decl'` | Generada · Solicitada (líder de zona) · Aprobada · Rechazada |
| | `approval_at` | Timestamp (interfaz *Datetime*) | `string \| null` (ISO con zona, UTC) | Instante de aprobación o rechazo; nulo mientras esté en `Gen`/`Req`. Timestamp y no DateTime: guarda la zona, como `date_created`. No `time`: una hora sin fecha no sirve de auditoría |
| | `created_at` | DateTime | `string \| null` | Al crear la colección: *Date Created* |
| | `created_by` | M2O → `directus_users` | `Relacion` | Al crear la colección: *User Created* |
| | `period_id` | M2O → `com_period` | `Relacion` | |
| `com_period` | `id` | Integer (auto) | `number` | |
| | `start_date` | Date | `string` | |
| | `end_date` | Date | `string` | |
| | `created_at` | DateTime | `string \| null` | *Date Created* |
| | `created_by` | M2O → `directus_users` | `Relacion` | *User Created* |

**Campos sugeridos (no están en tu esquema, opcionales):**
- `com_time_record_store`: `is_complete` (Boolean), para saber si se pudo determinar el cierre.
- `com_over_time`: `approved_by` (M2O → `directus_users`), para saber quién aprobó o rechazó, y `work_day` (Date), si se guarda una fila por día (decisión 8.4).
- `com_period`: `name` (String), para mostrarlo en la UI.

**Claves únicas** (las garantiza el ETL; el Data Studio no permite índices de varios campos):
- `com_time_record_store`: (`store_id`, `work_day`).
- `com_over_time`: (`employee_id`, `period_id`[, `work_day`]).

#### 1.3.4 Políticas de acceso

| Política | Permisos | Para quién |
|---|---|---|
| `crud_overtime_etl` | Lectura de `com_time_records`, `adm_employees`, `core_stores`, `com_store_closed_days`, `com_newness_reports`, `com_period`; crear, leer y actualizar `com_time_record_store`, `com_over_time` y `com_etl_runs` | Usuario de servicio del ETL (§4.5) |
| `read_overtimes` | Lectura de `com_period`, `com_time_record_store`, `com_over_time` | Líderes de zona y administradores de Horarios |
| `update_overtimes_request` | Actualizar `com_over_time.status` de `Gen` a `Req` | Líderes de zona |
| `update_overtimes_review` | Actualizar `com_over_time.status` a `Aprov`/`Decl` y `approval_at` | Gestión Humana y administradores |
| `crud_periods` | CRUD de `com_period` | Gestión Humana |

#### 1.3.5 Cómo crearlas en Directus

1. **Settings → Data Model**, dentro de la carpeta **Commerce → Time Tracking**: **Create Collection** (`+`).
2. **Name:** `com_over_time` (después `com_period` y, si se quiere, `com_etl_runs`). Clave primaria `id`, autoincremental.
3. Pestaña **Optional System Fields:** marca *Date Created* y *User Created*, y cámbiales la key a **`created_at`** y **`created_by`** para respetar tu esquema.
4. **Create Field**, con la interfaz de la columna "Tipo en Directus" del §1.3.3:
   - **Many to One** para `store_id`, `employee_id`, `period_id`;
   - **Datetime** para las fechas;
   - **Dropdown** para `status`, con las opciones `Gen`, `Req`, `Aprov` y `Decl`, y `Gen` por defecto.
     - **Type:** String. **Choices:** una fila por estado; *Text* es lo que ve la persona y *Value* lo que se guarda (y lo que usan la API y el código): `Generada`→`Gen`, `Solicitada`→`Req`, `Aprobada`→`Aprov`, `Rechazada`→`Decl`.
     - **Default Value:** `Gen`. **Required:** sí.
     - **Validation** (pestaña del campo): `{ "status": { "_in": ["Gen", "Req", "Aprov", "Decl"] } }`. Sin esta regla, el dropdown solo limita el formulario del Data Studio: la API aceptaría cualquier texto.
     - *(Opcional)* **Display → Labels**, con un color por valor, para verlo como etiqueta en las listas.
5. En `com_time_record_store`, que ya existe, revisa que los campos coincidan con el §1.3.3, sobre todo que `open_time` y `close_time` sean **DateTime** y no solo hora.

## 2. ¿Dónde se ejecuta el ETL? Opciones

| | **A. Directus Flows** | **B. Extensión de Directus** (hook con `schedule`) | **C. Servicio aparte con Hono** *(recomendada)* | **D. Dentro del Express actual** (`server/`) |
|---|---|---|---|---|
| **Qué es** | Flujo con disparador *Schedule (CRON)* y operación *Run Script* | Código Node desplegado **dentro** del servidor Directus (`extensions/`) | Proceso propio (`services/horarios-etl/`) con cron + API HTTP | Una ruta y un cron dentro de `server/index.js` |
| **Lenguaje** | JS en un sandbox (sin dependencias npm) | TS/JS con dependencias | TS con dependencias | JS (CommonJS) |
| **Acceso a datos** | Operaciones de Flow | `ItemsService` interno (sin HTTP) | Directus SDK por HTTP + token de servicio | Igual que C |
| **Pruebas** | Difíciles (UI de Directus) | Medias | **Fáciles** (vitest, funciones puras) | Medias |
| **Despliegue** | Ninguno | **Requiere acceso al servidor de Directus** | Un contenedor más en `docker-compose` | Ninguno extra |
| **Ejecución manual / recálculo** | Disparador manual del Flow | Endpoint de la extensión | `POST /etl/run` | Ruta Express |
| **Riesgo** | Lógica compleja en un sandbox, difícil de versionar | Acopla el ETL a las actualizaciones de Directus | Un servicio más que operar | Un cron largo dentro del servidor web: un fallo o reinicio afecta al frontend; mezcla CommonJS con TS |
| **Encaja si…** | La regla es simple y no se quiere código | Hay control del servidor de Directus | **Lógica de negocio, pruebas y recálculos** | Es un prototipo rápido |

**Por qué C:**
- La regla de horas extras (jornada máxima, festivos, dominicales, días cerrados, novedades, turnos que cruzan la medianoche) es **lógica de negocio que hay que probar**.
- El frontend ya tiene parte de esa lógica en TS puro (`domain/registro`, `utils/horasTrabajadas.ts`), que se puede **compartir**.
- Además, C no depende de tener acceso al servidor de Directus (B) ni ensucia el servidor web (D).

---

## 3. Bun frente a Node con Hono

| Aspecto | **Bun + Hono** | **Node 22 + Hono** |
|---|---|---|
| Hono | Nativo (`export default app`) | Con `@hono/node-server` (`serve({ fetch: app.fetch })`) |
| TypeScript | Lo ejecuta directamente | Node 22.18+ ejecuta TS por *type stripping*; en producción, mejor compilar con `tsup` o `tsc` |
| Directus SDK (`@directus/sdk`) | Funciona (usa `fetch`) | Funciona (es lo que ya usa el frontend) |
| Cron | Librería `croner` (funciona en los dos) | `croner` |
| Tests | `bun test` o vitest | **vitest** (el mismo que ya usa el proyecto) |
| Imagen Docker | `oven/bun:1` (nueva en el proyecto) | `node:22-alpine` (**ya se usa**) |
| Instalado hoy | ❌ No está en el devcontainer ni en las imágenes | ✅ `v22.23.3` |
| Rendimiento | Arranque y E/S más rápidos | Suficiente: el ETL espera a la red casi todo el tiempo |
| Riesgo | Alguna incompatibilidad puntual con librerías de Node | Ninguno nuevo |

**Cómo no tener que decidir ahora:** escribir el servicio **independiente del runtime**.
- Solo Hono, `fetch`, el Directus SDK y `croner`. Sin `Bun.*` ni APIs exclusivas de Node.
- Dos puntos de entrada pequeños:

```ts
// src/server.node.ts                         // src/server.bun.ts
import { serve } from '@hono/node-server';    import { app } from './app';
import { app } from './app';                  import { iniciarCron } from './cron';
import { iniciarCron } from './cron';         iniciarCron();
iniciarCron();                                export default { port: Number(process.env.PORT ?? 3010), fetch: app.fetch };
serve({ fetch: app.fetch, port: Number(process.env.PORT ?? 3010) });
```

Cambiar de runtime = cambiar la imagen base y el `CMD`.

---

## 4. Arquitectura propuesta

```
                ┌────────────────────── Directus · Commerce → Time Tracking ──────────────────────┐
                │ Origen (lee el ETL):  com_time_records · com_store_closed_days ·                │
                │                       com_newness_reports · adm_employees · core_stores         │
                │ Destino (escribe el ETL): com_time_record_store · com_over_time · com_period   │
                └──────▲───────────────────────────▲─────────────────────────────────▲──────────┘
                       │ lee (E)                   │ escribe (L)                     │ lee / aprueba
                       │                           │                                 │ (status, approval_at)
        ┌──────────────┴───────────────────────────┴────────────┐        ┌───────────┴─────────┐
        │  services/horarios-etl  (Hono · Node o Bun)           │        │ Frontend (Horarios) │
        │                                                       │        │ - Horas extras      │
        │  cron 02:00 America/Bogota ─► etl.diario(ayer)        │        │   por periodo       │
        │  cron cierre de periodo     ─► etl.periodo(id)        │        │ - Solicitar /       │
        │  POST /etl/run   (admin, recálculo manual)  ◄─────────┼────────┤   aprobar /         │
        │  GET  /etl/runs  (estado de las ejecuciones)          │        │   rechazar          │
        │  GET  /health                                         │        └─────────────────────┘
        └───────────────────────────────────────────────────────┘
```

### 4.1 Pasos

| Paso | Qué hace | Cuándo |
|---|---|---|
| **E — Extraer** | Del día o periodo: `com_time_records` (con `employee_id` y `store_id`), empleados activos por tienda, días cerrados, novedades y festivos | Por cron o manual |
| **T1 — Día de tienda** | Por tienda y día: `open_time` = primera marcación; `close_time` = última **Terminar Jornada** de los empleados de la tienda con la **jornada completa**; `operative_time` = cierre − apertura | Diario |
| **T2 — Horas extras** | Por empleado y periodo: minutos trabajados (misma regla que `calcularMinutosDia`, ver §5.2) contra el límite acordado (§8.1) → minutos extra | Diario (acumulado) o al cerrar el periodo |
| **L — Cargar** | *Upsert* idempotente en `com_time_record_store` y `com_over_time`. **Nunca** se pisa una fila en `Req`, `Aprov` o `Decl` | Tras T1 y T2 |

### 4.2 Estados de una hora extra

```
Gen ──(líder de zona solicita)──► Req ──(aprobador)──► Aprov
     ▲                                 └──────(aprobador)──► Decl
     └── el ETL solo crea o recalcula filas en `Gen`
```

- **El ETL** escribe solo `Gen`. Si al recalcular cambia el valor de una fila que **ya no** está en `Gen`, no la toca: registra la diferencia en el log de la ejecución para revisarla.
- **El frontend** (líder de zona o aprobador) cambia `status` (`Gen → Req` para solicitar; `Aprov`/`Decl` para revisar) y `approval_at`, con permisos de Directus por política (§1.3.4).

### 4.3 Idempotencia y concurrencia

- **Claves únicas en Directus:** `com_time_record_store (store_id, work_day)` y `com_over_time (employee_id, period_id[, work_day])`. Con eso, repetir el ETL no duplica nada.
- **Una ejecución a la vez:** un *lock* en memoria y, si hay varias réplicas, una fila en `com_etl_runs` con estado `running`.
- **`com_etl_runs`** (opcional, recomendado): `started_at`, `finished_at`, `scope`, `status`, `stats` (JSON) y `error`. Sirve para la vista de estado y para auditar.

### 4.4 Seguridad

- **Usuario de servicio en Directus** (`svc_horarios_etl`) con un **token estático** y una política propia (`crud_overtime_etl`, §1.3.4):
  - lectura de las colecciones de origen;
  - escritura **solo** en `com_time_record_store`, `com_over_time`, `com_etl_runs`.
- **El token va en variables de entorno del contenedor**, nunca en el frontend: `DIRECTUS_URL`, `DIRECTUS_ETL_TOKEN`, `TZ=America/Bogota`.
- **`POST /etl/run`:** valida el token del usuario contra `/users/me`, igual que `server/middleware/auth.js`, y exige una política de administración. Así, quien lo llama desde el frontend no necesita el token de servicio.

### 4.5 Cómo obtiene el ETL acceso a Directus (políticas + usuario de servicio)

**Respuesta corta:** mediante **políticas**, que son el mecanismo de permisos de Directus 11. El ETL se conecta como un **usuario de servicio** con un **token estático**, y ese usuario solo tiene **una** política con los permisos justos. Directus no ofrece un flujo tipo *client credentials* para servidores; el token estático es la forma prevista.

```
horarios-etl ──Authorization: Bearer <token estático>──► Directus
                                                         │
          usuario svc_horarios_etl ──► rol service_horarios_etl ──► política crud_overtime_etl
                                                                    (solo lo que necesita el ETL)
```

#### Paso 1 — Crear la política `crud_overtime_etl`

**Settings → Access Policies → Create**

| Campo | Valor |
|---|---|
| **Name** | `crud_overtime_etl` |
| **Description** | *Permite al proceso ETL calcular y registrar horas extras. Asignada al usuario de servicio svc_horarios_etl.* |
| **Admin Access** | ❌ No |
| **App Access** | ❌ No (no entra al Data Studio, solo usa la API) |
| **IP Access** | *(Recomendado)* la IP o red desde la que corre el contenedor del ETL. Si el token se filtra, no sirve desde otro sitio |
| **Enforce TFA** | ❌ No (un servicio no puede usar 2FA) |

**Permissions** de la política:

| Colección | Create | Read | Update | Delete |
|---|:-:|:-:|:-:|:-:|
| `com_time_records` | — | ✅ | — | — |
| `adm_employees` | — | ✅ | — | — |
| `core_stores` | — | ✅ | — | — |
| `com_store_closed_days` | — | ✅ | — | — |
| `com_newness_reports` | — | ✅ | — | — |
| `com_period` | — | ✅ | — | — |
| `com_time_record_store` | ✅ | ✅ | ✅ | — |
| `com_over_time` | ✅ | ✅ | ✅ **con regla** | — |
| `com_etl_runs` | ✅ | ✅ | ✅ | — |

**Regla clave**, en *Update* de `com_over_time`:
- **Item Permissions** (filtro): `{ "status": { "_eq": "Gen" } }`. Así el ETL **no puede** modificar una hora extra solicitada, aprobada o rechazada aunque tenga un fallo: lo impide Directus, no solo el código (§4.2).
- **Field Permissions:** solo `minutes`, `store_id` y `period_id` (y `work_day` si se guarda por día). Quedan fuera `status` y `approval_at` (y `approved_by` si se añade), que son del flujo de aprobación.

Sin permiso de *Delete* en ninguna colección, el ETL no puede borrar nada.

#### Paso 2 — Crear el rol `service_horarios_etl`

**Settings → User Roles → Create**: name `service_horarios_etl` (en inglés y `snake_case`, §2.1 de la política). Se le asigna **solo** la política `crud_overtime_etl`.

#### Paso 3 — Crear el usuario de servicio y su token

**User Directory → Create User**:

| Campo | Valor |
|---|---|
| **First Name** | `svc_horarios_etl` |
| **Email** | Identificable, por ejemplo `svc_horarios_etl@kancan.local` |
| **Password** | Vacío: no necesita iniciar sesión |
| **Role** | `service_horarios_etl` |
| **Token** | Pulsar **Generate**, **copiar el valor** (Directus no lo vuelve a mostrar) y **guardar** el usuario. El token solo queda activo al guardar |

#### Paso 4 — Dárselo al servicio

| Entorno | Dónde |
|---|---|
| **Local / devcontainer** | `services/horarios-etl/.env` (está en `.gitignore`; el contenedor `etl` lo lee con `--env-file-if-exists`), a partir de `.env.example` |
| **Producción** | Variables `DIRECTUS_URL` y `DIRECTUS_ETL_TOKEN` del contenedor `horarios-etl` (el `docker-compose.yml` ya las pasa) o *secrets* del servidor |

```bash
DIRECTUS_URL=https://tu-directus
DIRECTUS_ETL_TOKEN=el_token_generado
```

**Nunca en el frontend:** ninguna variable `VITE_*` debe llevar este token. Con las dos variables configuradas, `GET /health` devuelve `"directus": { "configured": true }`, sin mostrar el token.

#### Paso 5 — Usarlo en el código (fase F3)

> Guía completa de conexión y consultas (esquema tipado, cliente, `/health/ready`, lecturas, upserts, errores y red): [`ETL_HORAS_DIRECTUS.md`](ETL_HORAS_DIRECTUS.md).

```ts
// services/horarios-etl/src/directus.ts
import { createDirectus, rest, staticToken } from '@directus/sdk';

export const crearClienteDirectus = (url: string, token: string) =>
	createDirectus(url).with(staticToken(token)).with(rest());
```

- **Sin renovación:** el token estático no caduca, a diferencia del de inicio de sesión que usa el frontend.
- **Comprobación (pendiente):** un `GET /health/ready` hará una lectura mínima, por ejemplo `readMe()` o una fila de `com_period`, para confirmar que el token funciona.

#### Buenas prácticas

| Práctica | Por qué |
|---|---|
| **Un usuario por servicio** | Si mañana hay otro proceso, que tenga su propio usuario y su propia política: se puede revocar uno sin tocar el otro |
| **Rotar el token** | Se genera uno nuevo en el usuario, se actualiza la variable y se reinicia el contenedor; el anterior deja de valer al guardar |
| **Auditoría** | Todo lo que escribe el ETL queda en `user_created`/`user_updated` como `svc_horarios_etl` y se distingue de los cambios hechos por personas |
| **Nunca un token de administrador** | Funcionaría, pero un fallo o una fuga tendría acceso a todo Directus |
| **`POST /etl/run` con el token del usuario, no con el de servicio** | Quien pulsa "Recalcular" en el frontend se autentica con su sesión; el ETL valida ese token contra `/users/me` (§4.4) y luego trabaja con su propio token de servicio |

---

## 5. Estructura del servicio

```
services/horarios-etl/
├── package.json            hono, @directus/sdk, croner, dayjs (+ @hono/node-server si es Node)
├── tsconfig.json
├── Dockerfile              node:22-alpine (o oven/bun:1)
├── src/
│   ├── app.ts              rutas Hono: /health, /etl/run, /etl/runs
│   ├── server.node.ts      arranque con Node
│   ├── server.bun.ts       arranque con Bun
│   ├── cron.ts             programación (croner, America/Bogota)
│   ├── directus.ts         cliente con token de servicio (rest + staticToken)
│   ├── extract/            lecturas tipadas (reutilizan los DTO de interfaces/api)
│   ├── transform/          FUNCIONES PURAS: diaTienda(), minutosTrabajados(), horasExtra()
│   ├── load/               upserts idempotentes
│   └── jobs/               etlDiario(fecha), etlPeriodo(periodId)
└── test/                   vitest sobre transform/ (casos reales y bordes)
```

### 5.1 `docker-compose.yml`

```yaml
services:
  appkancan:            # sin cambios
    ...
  horarios-etl:
    build: ./services/horarios-etl
    environment:
      DIRECTUS_URL: ${DIRECTUS_URL}
      DIRECTUS_ETL_TOKEN: ${DIRECTUS_ETL_TOKEN}
      TZ: America/Bogota
    restart: unless-stopped
```

El frontend llama al ETL por el proxy existente: se añade una ruta `/api/etl/*` en `vite.config.ts` y en Express, o se expone en su propio puerto detrás del proxy de despliegue.

### 5.2 Compartir la lógica con el frontend

Hoy el cálculo de minutos vive en el frontend (`utils/horasTrabajadas.ts`, `domain/registro`). Para que la app y el ETL **no calculen distinto**:

| Opción | Cómo | Coste |
|---|---|---|
| **a) Paquete compartido** *(recomendado a medio plazo)* | `packages/horarios-domain` con las funciones puras y npm workspaces | Hay que configurar workspaces |
| b) Importar por ruta | El ETL importa `../../src/apps/horarios/domain/...` al compilar | Rápido, pero acopla los builds |
| c) Copiar | Duplicar las funciones en el ETL | Riesgo de divergencia |

> **Atención:** `calcularMinutosDia` tiene hoy **8 `any`** y una línea con `noAssignInExpressions` (ver `ERRORES_CAMINO_A_APLICADO.md` §5). Conviene tiparla y cubrirla con tests **antes** de convertirla en la fuente de verdad del ETL.

---

## 6. Algoritmo propuesto (borrador, a validar en §8)

### 6.1 Día operativo de una tienda (`com_time_record_store`)

```
para cada (tienda, día):
  marcaciones = com_time_records del día en la tienda (no anuladas)
  si no hay marcaciones o el día está cerrado (com_store_closed_days) → no se genera fila
  open_time  = min(record_time de todas las marcaciones)
  completos  = empleados de la tienda con 'Comenzar Jornada' Y 'Terminar Jornada' ese día
  close_time = max(record_time de 'Terminar Jornada' de los completos)
               (si nadie completó: null y estado "incompleto" en las estadísticas de la ejecución)
  operative_time = close_time − open_time (si close < open: cruza medianoche → +24 h)
  upsert por (store_id, work_day)
```

### 6.2 Horas extras de un empleado (`com_over_time`)

```
para cada empleado con marcaciones en el periodo:
  por día: minutos = (fin − inicio) − (fin almuerzo − inicio almuerzo)   ← misma regla que calcularMinutosDia
  se excluyen los días con novedad que no cuenta (vacaciones, incapacidad…)   ← decisión 8.2
  extra = f(minutos por día/semana, límite legal o contractual)              ← decisión 8.1
  store_id = tienda de las marcaciones (o la del empleado si no tiene)        ← "en caso de que el usuario no tenga tienda"
  upsert solo si la fila no existe o sigue en 'generated'
```

### 6.3 Casos borde que hay que cubrir con tests

| Caso | Tratamiento propuesto |
|---|---|
| Falta `Terminar Jornada` | El día no cuenta para las horas extras; se registra en las estadísticas |
| Turno que cruza la medianoche | Se suman 24 h si `fin < inicio` (como ya hace `DOCUMENTACION_HORARIOS.md` §8.1) |
| Hora editada (`original_record_time`) | Se usa `record_time` (la editada); conviene guardar si hubo edición, para auditar |
| "Sin almuerzo" (las dos marcaciones con la misma hora) | 0 minutos de almuerzo |
| Festivos y domingos | Según la decisión 8.3 (recargo aparte o solo informativo) |
| Día de tienda cerrada | No se genera el día de tienda |
| Empleado que cambia de tienda en el periodo | `store_id` por día; la agregación del periodo, por empleado |
| Zona horaria | Todo en `America/Bogota` (`TZ` del contenedor + dayjs tz) |

---

## 7. El frontend

| Pieza | Dónde | Qué hace |
|---|---|---|
| Sección o subsección **"Horas extras"** | Monitoreo o Reporte (según el rol) | Lista por periodo, tienda y empleado, con filtros y totales |
| Acciones | Tabla | Líder de zona: **Solicitar** (`Gen → Req`). Aprobador: **Aprobar** / **Rechazar** (`status`, `approval_at`) |
| Estado del ETL | Admin | Última ejecución, errores y botón **Recalcular** (llama a `POST /etl/run`) |
| Datos | `api/directus/extraTime.ts` + `interfaces/api/` (`ExtraTimeDto`, `TimeRecordStoreDto`, `PeriodDto`) | Mismo patrón que el resto: DTO, `FiltroDirectus`, `mensajeDeError` |

**Roles:**
- **Tienda:** solo ve sus horas, o nada (decisión 8.4).
- **Líder de zona (area manager):** solicita.
- **Admin / RR. HH.:** aprueba o rechaza.

Las políticas están en el §1.3.4 (`read_overtimes`, `update_overtimes_request`, `update_overtimes_review`, `crud_periods`).

---

## 8. Decisiones necesarias antes de construir

### 8.1 ¿Qué es una hora extra? *(bloqueante)*

| Opción | Regla | Comentario |
|---|---|---|
| **a. Por semana legal** | Minutos de la semana por encima de la jornada máxima legal | En Colombia, la Ley 2101 de 2021 reduce la jornada por tramos; **confirmar con RR. HH. el valor vigente para el periodo** |
| b. Por día contratado | Minutos del día por encima del turno del empleado | Requiere el turno por empleado (la Malla horaria está pendiente en la app) |
| c. Fuera del horario de la tienda | Minutos antes de `open_time` o después de `close_time` | Usa directamente `com_time_record_store`; no es la definición legal |

¿Redondeo? (por ejemplo, solo bloques de 15 o 30 minutos). ¿Mínimo para generar una fila?

### 8.2 Novedades

¿Qué tipos de novedad excluyen el día o el periodo (vacaciones, incapacidad, permiso)?

### 8.3 Recargos

¿Se separan las horas **nocturnas**, **dominicales** y **festivas** (recargos distintos) o es un solo total? Si se separan, `com_over_time` necesita un campo `type` (`daytime`, `night`, `sunday`, `holiday`).

### 8.4 Modelo y permisos

- ~~¿Prefijo `hr_` o `com_`?~~ **Resuelto:** `com_`, como las colecciones actuales de producción (§1.3).
- ¿Una fila de `com_over_time` por **empleado y periodo** o por **empleado y día**? La de día da más detalle y permite aprobar parcialmente.
- ¿Quién crea los periodos (RR. HH. a mano o el ETL por calendario, p. ej. quincenas)?
- ¿Qué ve un usuario de tienda?

### 8.5 Infraestructura

- ¿Node o Bun en producción? Con el diseño del §3 no bloquea.
- ¿Hay acceso al servidor de Directus? Solo importa si se prefiere la opción B.
- ¿Dónde se despliega el contenedor (mismo `docker-compose`) y qué proxy expone `/api/etl`?

---

## 9. Plan por fases

| Fase | Entregable | Criterio de aceptación |
|---|---|---|
| **F0** | Decisiones del §8 + colecciones en Directus (`com_period`, `com_time_record_store`, `com_over_time`, `com_etl_runs`), claves únicas, usuario de servicio, rol y políticas (§4.5) | Esquema creado en un entorno de pruebas |
| **F1** ✅ (2026-10-16, solo Node) | Esqueleto `services/horarios-etl` (Hono, `/health`, Dockerfile, compose, devcontainer). Ver `services/horarios-etl/README.md` | `GET /health` responde; 3 tests en verde |
| **F2** | `transform/` puro + tests con casos reales (§6.3); `calcularMinutosDia` tipado y compartido | Tests en verde; mismas horas que el Reporte semanal actual en un mes de muestra |
| **F3** | `etlDiario`: día de tienda + cron 02:00 + `com_etl_runs` | Repetirlo 2 veces no duplica filas; los días cerrados se omiten |
| **F4** | `etlPeriodo`: horas extras + reglas de estado (no pisar `Req`/`Aprov`/`Decl`) | Recalcular un periodo con filas aprobadas no las modifica |
| **F5** | Frontend: listado, solicitar, aprobar y rechazar, estado del ETL y "Recalcular" | Pruebas en el navegador por rol |
| **F6** | Observabilidad: logs estructurados, alerta si una ejecución falla y reintentos | Una ejecución fallida queda en `com_etl_runs` y se ve en Admin |

---

## 10. Riesgos

| Riesgo | Mitigación |
|---|---|
| Calcular distinto que el frontend | Lógica compartida (§5.2) y test de equivalencia contra el Reporte semanal |
| Recalcular pisa aprobaciones | Regla de estados (§4.2) + test específico |
| Marcaciones incompletas o editadas | Casos borde (§6.3) + estadísticas por ejecución |
| El token de servicio se filtra | Solo en las variables del contenedor; política mínima; rotación |
| Zona horaria | `TZ=America/Bogota` y dayjs tz en todos los cálculos |
| Cron duplicado con varias réplicas | Lock en `com_etl_runs` |
| Dos runtimes que mantener | Código independiente del runtime; producción en uno solo |
