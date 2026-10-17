# horarios-etl

Worker ETL de la app de Horarios: lee las marcaciones de Directus y guarda cada noche el **día operativo
de cada tienda** (`com_time_record_store`: apertura, cierre, minutos) y los **periodos** quincenales
(`com_period`). Las **horas extras** (`com_over_time`) las declaran los líderes de zona; su cálculo
automático queda vacío hasta que se defina la regla.

Diseño completo: [`src/apps/horarios/results/ETL_HORAS_EXTRAS.md`](../../src/apps/horarios/results/ETL_HORAS_EXTRAS.md).

## Estado

| Fase | Contenido | Estado |
|---|---|---|
| F1 | Esqueleto: Hono, `GET /health`, Dockerfile, compose, devcontainer | ✅ |
| F2 | `transform/` puro + tests (día de tienda, periodo) | ✅ |
| F3 | Cliente Directus, `/health/ready`, `extract/`, `load/`, `jobs/etlDiario`, cron 02:00, CLI | ✅ |
| F4 | Horas extras | Funciones vacías: regla sin definir |

## Estructura

```
src/
├── server.ts       arranque con Node (@hono/node-server) — único archivo atado al runtime
├── app.ts          app Hono (rutas, logger, 404, errores)
├── config.ts       variables de entorno
├── fecha.ts        fechas en hora de Bogotá (sin dependencias)
├── directus/       schema.ts (tipos reales), client.ts, errors.ts (reintentos)
├── routes/         health.ts (GET /health, GET /health/ready)
├── extract/        lecturas de Directus
├── transform/      funciones puras de cálculo
├── load/           upserts idempotentes
└── jobs/           etlDiario, cron, cli
test/               vitest
```

## Uso

**Node >= 22.18**: ejecuta los `.ts` directamente (type stripping). Por eso:
- los imports relativos llevan extensión `.ts` (`import { crearApp } from './app.ts'`);
- no se usan `enum`, `namespace` ni *parameter properties* (`erasableSyntaxOnly` lo comprueba).

```bash
cd services/horarios-etl
npm install
npm run dev        # node --watch src/server.ts  → http://localhost:3010/health
npm test           # vitest
npm run typecheck  # tsc --noEmit

# Ejecución manual (lee .env). --dry-run calcula sin escribir.
npm run etl -- --fecha=2026-10-16 --dry-run
npm run etl -- --fecha=2026-10-01 --hasta=2026-10-15     # backfill
npm run etl -- --nocturno --dry-run                      # lo mismo que el cron de las 02:00
```

El cron nocturno (02:00, Bogotá) asegura el periodo de **hoy** y calcula el día de **ayer**. Si el
proceso estaba caído a esa hora, ese día se recupera con `--fecha`.

En el **devcontainer** arranca solo como el servicio `etl` (ver `.devcontainer/docker-compose.yml`).
En **producción**, servicio `horarios-etl` del `docker-compose.yml` de la raíz.

## Variables de entorno

Ver `.env.example`. `DIRECTUS_ETL_TOKEN` es el token del usuario de servicio: **nunca** va al frontend
y `/health` solo informa si está configurado, sin exponerlo.
