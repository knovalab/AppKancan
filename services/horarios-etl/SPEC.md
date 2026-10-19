# Spec: ETL de Horarios (`services/horarios-etl`)

> **Estado:** borrador para aprobación · **Fecha:** 2026-10-17 · **Rama:** `setup`
> **Relacionado:** [`ETL_HORAS_EXTRAS.md`](../../src/apps/horarios/results/ETL_HORAS_EXTRAS.md) (diseño original), [`ETL_DIRECTUS_ESQUEMA_ANALISIS.md`](../../src/apps/horarios/results/ETL_DIRECTUS_ESQUEMA_ANALISIS.md) (esquema real), [`ETL_DIA_TIENDA_APLICADO.md`](../../src/apps/horarios/results/ETL_DIA_TIENDA_APLICADO.md) (lo ya implementado).
> Esta spec **sustituye** la idea de que el ETL calcula horas extras: eso pasa a ser un proceso manual (§1.3).

---

## 1. Objetivo

### 1.1 Para qué existe

Las tiendas y los empleados **no tienen horario definido**. La única fuente fiable de cuándo se trabaja son las **marcaciones** (`com_time_records`). El ETL convierte esas marcaciones crudas en **datos de negocio por tienda y por periodo**, para que los **líderes de zona** y **RR. HH.** los consulten en **Monitoreo** y **Reportes** sin calcular a mano.

### 1.2 Qué hace el ETL (dentro del alcance)

| Id | Capacidad | Escribe en | Lo consume |
|---|---|---|---|
| `dia-tienda` | Determinar cada día **cuándo abrió y cerró cada tienda** y cuánto tiempo estuvo operativa | `com_time_record_store` | Reporte → Tiendas, Monitoreo → Operación, exportaciones (ya existen y solo leen) |
| `periodos` | Mantener los **periodos** (quincenas) en los que se agrupan las horas extras | `com_period` | El flujo manual de horas extras (§1.3) y los reportes por periodo |

### 1.3 Qué NO hace el ETL (fuera del alcance, para dejar claro el límite)

**Horas extras: proceso manual**, sin cálculo ni detección automática:

```
Líder de zona (UI)                      RR. HH. (UI)
  crea la fila en com_over_time   ──►     aprueba  → Aprov  (+ approval_at)
  estado Gen (minutes, empleado,          rechaza  → Decl   (+ approval_at)
  tienda, periodo)
  └─ solicita autorización → Req
```

- El ETL **nunca crea, lee para decidir ni modifica** `com_over_time`. Las funciones vacías de `transform/horasExtras.ts` y `load/horasExtras.ts` se **eliminan** (o pasan a `legacy/`): ya no hay "regla pendiente", la decisión es que sea manual.
- La UI de horas extras (crear, solicitar, aprobar, rechazar) es **frontend**, con su propia spec más adelante. Esta spec solo fija el **contrato de datos** que el ETL respeta: `com_over_time` y sus estados `Gen → Req → Aprov | Decl` son de las personas.
- Tampoco: detectar "marcó fuera de horario" (no hay horario contra el que comparar), recargos nocturnos/festivos, novedades.

### 1.4 Usuarios

| Usuario | Qué obtiene del ETL |
|---|---|
| Líder de zona | Apertura, cierre y tiempo operativo de sus tiendas por día; contexto para decidir horas extras a mano |
| RR. HH. | Lo mismo, de todas las tiendas, y los periodos ya creados para aprobar por periodo |
| Administrador de Horarios | Que el proceso corre solo cada noche y se puede recalcular un día o un rango |

---

## 2. Reglas de negocio

### 2.1 `dia-tienda` — día operativo de una tienda

Para cada **tienda** y **día** (`work_day`, fecha de Bogotá):

| # | Regla |
|---|---|
| R1 | **Apertura** (`open_time`) = la **primera marcación del día que no sea `Terminar Jornada`** (una salida no abre la tienda) |
| R2 | **Cierre** (`close_time`) = la **última `Terminar Jornada`** del día, de cualquier empleado |
| R3 | **Tiempo operativo** (`operative_time`) = minutos enteros entre apertura y cierre |
| R4 | Sin ninguna `Terminar Jornada` → `close_time` y `operative_time` en **null** (día incompleto, visible en el reporte) |
| R5 | Si el cierre es anterior a la apertura, el turno **cruzó la medianoche**: +24 h y `close_time` con la fecha del día siguiente |
| R6 | **No se genera fila** si la tienda está marcada como cerrada ese día (`com_store_closed_days.status = true`), si no tiene marcaciones o si solo tiene salidas |
| R7 | Fechas como **DateTime local de Bogotá sin zona** (`2026-10-16T10:07:32`) |
| R8 | **Idempotente:** una fila por (`store`, `work_day`). Recalcular un día **actualiza** la fila, nunca duplica |
| R9 | `open_user` / `close_user` **no se tocan** (son usuarios de Directus; ver Preguntas abiertas) |
| R10 | Se usa `record_time` (la hora vigente, editada o no), no `original_record_time` |

### 2.2 `periodos`

| # | Regla |
|---|---|
| P1 | Periodo = **quincena**: del 1 al 15 y del 16 al último día del mes (febrero y bisiestos incluidos) |
| P2 | Cada noche se **asegura** que existe el periodo que contiene **hoy**: si no existe, se crea; si existe, no se toca |
| P3 | Identidad del periodo = (`start_date`, `end_date`). Nunca se crean dos con el mismo rango |
| P4 | El ETL **no borra ni modifica** periodos existentes (RR. HH. puede crearlos o ajustarlos a mano) |

### 2.3 Ejecución

| # | Regla |
|---|---|
| E1 | **Cron interno a las 02:00 (Bogotá):** `periodos` (hoy) y `dia-tienda` (ayer), **independientes**: si uno falla, el otro se ejecuta igual |
| E2 | **CLI** para recalcular un día o un rango (`--fecha`, `--hasta`) y para probar sin escribir (`--dry-run`) |
| E3 | Lecturas con **reintentos** solo ante red, timeout, 429 y 5xx; **escrituras sin reintento** (un reintento tras timeout podría duplicar) |
| E4 | Si el proceso estaba caído a las 02:00, ese día **no** se recupera solo: se recalcula con el CLI |

---

## 3. Tech stack

Node **≥ 22.18** (ejecuta `.ts` con *type stripping*, sin compilar) · **Hono 4** + `@hono/node-server` · **`@directus/sdk` 20.x** con esquema tipado y token estático · **vitest 2** · TypeScript 5.9 `strict` + `erasableSyntaxOnly` · Docker `node:22-alpine`. Sin más dependencias: fechas con `Intl` (Bogotá = UTC−5 fijo) y cron con `setTimeout`.

---

## 4. Comandos

```bash
cd services/horarios-etl
npm install
npm run dev                                   # node --watch src/server.ts → http://localhost:3010
npm test                                      # vitest run
npm run typecheck                             # tsc --noEmit
npx biome format --write src test             # desde la raíz del repo: services/horarios-etl/{src,test}
npm run etl -- --fecha=2026-10-16 --dry-run   # calcula e imprime, no escribe
npm run etl -- --fecha=2026-10-01 --hasta=2026-10-15   # recalcula un rango (escribe)
npm run etl -- --nocturno --dry-run           # lo mismo que el cron
curl -s localhost:3010/health                 # proceso vivo (HEALTHCHECK de Docker)
curl -s localhost:3010/health/ready           # Directus responde, token válido, permiso de lectura
```

---

## 5. Estructura

```
services/horarios-etl/
├── SPEC.md            ← este documento
├── src/
│   ├── server.ts      arranque Node + cron (único archivo atado al runtime)
│   ├── app.ts         app Hono (rutas, 404, errores); cliente Directus inyectado
│   ├── config.ts      variables de entorno (el token nunca se serializa)
│   ├── fecha.ts       fechas en hora de Bogotá
│   ├── directus/      schema.ts (nombres y tipos reales) · client.ts · errors.ts
│   ├── routes/        health.ts (/health, /health/ready)
│   ├── extract/       lecturas de Directus (reciben el cliente)
│   ├── transform/     funciones PURAS: diaTienda.ts, periodo.ts
│   ├── load/          escrituras idempotentes: registroTienda.ts, periodo.ts
│   └── jobs/          etlDiario.ts · cron.ts · cli.ts
└── test/              vitest: transform.test.ts, load.test.ts, health.test.ts
```

Documentos de análisis y resultados: `src/apps/horarios/results/`.

---

## 6. Estilo de código

Español en nombres de dominio, tabuladores y comillas simples (Biome), imports relativos con `.ts`, sin `enum`/`namespace`. Lógica de negocio **pura** en `transform/`, Directus solo en `extract/` y `load/`, cliente siempre **inyectado**:

```ts
/** Devuelve el id del periodo con ese rango; si no existe, lo crea. */
export async function asegurarPeriodo(
	directus: ClienteDirectus,
	rango: RangoPeriodo,
): Promise<{ id: number; creado: boolean }> {
	const [existente] = await directus.request(
		readItems('com_period', {
			fields: ['id'],
			filter: { start_date: { _eq: rango.start_date }, end_date: { _eq: rango.end_date } },
			limit: 1,
		}),
	);
	if (existente) return { id: existente.id, creado: false };
	const nuevo = await directus.request(createItem('com_period', rango, { fields: ['id'] }));
	return { id: nuevo.id, creado: true };
}
```

- Nombres de campos y colecciones **exactos** de Directus, tipados en `directus/schema.ts` (un nombre mal escrito es error de compilación).
- Ids de tienda como **texto** (`'90'`).
- Atajos con límite conocido: comentario `shortcut: <límite>, <cuándo mejorarlo>`.

---

## 7. Estrategia de pruebas

| Nivel | Qué | Dónde |
|---|---|---|
| Unitarias (la mayoría) | Reglas R1–R7 y P1 en funciones puras, con casos borde: sin cierre, medianoche, tienda cerrada, solo salidas, varias tiendas, horas mal formadas, fin de mes y bisiesto | `test/transform.test.ts` |
| Con cliente falso | Upsert R8 (crea/actualiza, lotes de 100), P2–P3, E1 (pasos independientes), E3 (reintentos), `/health/ready` sin exponer el token | `test/load.test.ts`, `test/health.test.ts` |
| Contra Directus real | **Solo `--dry-run`** (lectura). Escritura real únicamente con aprobación (§8) | Manual, CLI |

Toda regla nueva de §2 entra con su test. `npm test` y `npm run typecheck` en verde antes de cada commit.

---

## 8. Límites

**Siempre**
- Ejecutar `npm test` y `npm run typecheck` antes de dar algo por terminado.
- Probar contra Directus real primero con `--dry-run`.
- Usar el token del usuario de servicio `svc_horarios_etl` solo desde variables de entorno o `services/horarios-etl/.env`.
- Mantener `schema.ts` alineado con Directus cuando cambie un campo.

**Preguntar antes**
- Cualquier **escritura real** en Directus de producción (el ETL no puede borrar; los errores se corrigen sobrescribiendo o con un administrador).
- Cambiar una regla de §2, el horario del cron o el corte de los periodos.
- Cambios en el esquema o en las políticas de Directus.
- Añadir dependencias.
- Tocar el frontend.

**Nunca**
- Leer o escribir `com_over_time` desde el ETL.
- Usar un token de administrador, ponerlo en el frontend (`VITE_*`), en logs, en commits o en el chat.
- Borrar filas en Directus.
- Desactivar o borrar tests que fallan sin aprobación.

---

## 9. Criterios de éxito

1. Cada noche, sin intervención, existe una fila en `com_time_record_store` por cada tienda que tuvo marcaciones el día anterior (salvo cerradas), con apertura, cierre y minutos según R1–R7.
2. Para un mes de muestra, `operative_time` coincide con lo que calcularía una persona a mano a partir de las marcaciones (verificado en ≥ 3 tiendas y ≥ 5 días), y lo muestran correctamente Reporte → Tiendas y Monitoreo → Operación.
3. Recalcular el mismo día dos veces deja el mismo resultado y el mismo número de filas.
4. El periodo que contiene hoy existe siempre a partir de las 02:00, sin duplicados.
5. Un fallo en `periodos` no impide `dia-tienda`, y al revés; el log de la ejecución dice qué falló.
6. El ETL no tiene ningún acceso a `com_over_time` (código y política).
7. `npm test` y `npm run typecheck` en verde.

---

## 10. Preguntas abiertas

| # | Pregunta | Supuesto si no se responde |
|---|---|---|
| Q1 | ¿El criterio de éxito 2 es el adecuado o hay otra forma de validar (por ejemplo, el reporte que hoy hace alguien a mano)? | Criterio 2 tal cual |
| Q2 | **Periodo quincenal** (1–15, 16–fin): ¿correcto? ¿RR. HH. también crea periodos a mano? | Quincenal; el ETL los crea y RR. HH. puede crear otros |
| Q3 | ¿Recalcular solo **ayer** cada noche, o los **últimos N días** por si alguien corrige una marcación después? | Solo ayer + CLI |
| Q4 | `open_user` / `close_user`: ¿deben rellenarse? Apuntan a usuarios de Directus y las marcaciones son de empleados | No se tocan |
| Q5 | La fila creada a mano (tienda 90, 2026-10-16) se sobrescribirá al recalcular ese día: ¿aceptable? | Sí |
| Q6 | **Permisos de la política `crud_overtime_etl`:** añadir **Crear** en `com_period` y **quitar** todo acceso a `com_over_time` (ya no lo necesita) | Se pide el cambio en Directus |
| Q7 | ¿Hace falta el registro de ejecuciones (`com_etl_runs`) para verlo desde Admin, o bastan los logs del contenedor? | Bastan los logs |
