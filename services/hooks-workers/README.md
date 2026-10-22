# Hooks Workers Service

Dedicated, standalone background worker and webhook processing service for Directus.
Built with **Node 22 (Native Type Stripping) + Hono + TypeScript**.

Runs completely isolated from the legacy frontend/server, providing zero regression risk to existing code.

---

## 1. Quickstart

Navigate to the service directory:
```bash
cd services/hooks-workers
```

### Install Dependencies
```bash
npm install
```

### Configure Environment Variables
Copy `.env.example` to `.env` in this directory:
```bash
cp .env.example .env
```
Key variables:
- `STATIC_HOOK_TOKEN`: Shared secret token for webhook authentication.
- `DIRECTUS_URL`: Directus instance URL (default: `https://directus.kancan.knovalab.com`).
- `DIRECTUS_SERVICE_TOKEN`: Directus static service token for SDK requests.
- `PORT`: Service port (default: `3020`).
- `LOG_LEVEL`: Pino logger severity level (`debug`, `info`, `warn`, `error`).

### Start Dev Server (with hot reloading on port 3020)
```bash
npm run dev
```

### Typecheck (Pure TypeScript)
```bash
npm run typecheck
```

### Run Tests (Vitest)
```bash
npm test
```

---

## 2. Testing Hooks Locally via CLI

You can execute and test any hook directly in your terminal **without starting the server or touching Directus**:

```bash
# List all registered hooks
npm run cli

# Run a specific hook with payload
npm run cli -- dummy-task '{"id": 10, "action": "test"}'
```

---

## 3. How to Add Your 5 Hooks (Plug-and-Play)

Adding a new hook is a simple 2-step process:

### Step 1: Create your handler in `src/handlers/<hookName>.ts`
```typescript
// src/handlers/syncVentas.ts
import type { HookHandler, WorkerContext } from '../types.ts';

export interface SyncPayload {
	storeId?: number;
}

export interface SyncResult {
	success: boolean;
	storeId: number;
}

const syncVentas: HookHandler<SyncPayload, SyncResult> = {
	name: 'sync-ventas',
	description: 'Synchronizes sales records with Directus',
	options: { timeoutMs: 30000 },

	async run(payload: SyncPayload, context: WorkerContext): Promise<SyncResult> {
		const { logger, directus } = context;

		logger.info({ storeId: payload.storeId }, 'Starting sync for store');
		logger.debug('Executing query...');

		// Directus SDK is pre-injected:
		// await directus.request(...)

		return {
			success: true,
			storeId: payload.storeId ?? 1,
		};
	},
};

export default syncVentas;
```

---

## 4. Structured Logging with Pino

The service uses **Pino** for high-performance structured logging:
- In **development** (`NODE_ENV != production`), logs are colorized and formatted with `pino-pretty`.
- In **production**, logs are emitted as single-line JSON for log aggregators (CloudWatch, Loki, Datadog).
- **Automatic Child Context**: Every log message automatically includes `jobId` and `hook` name.

```typescript
// Inside any handler:
context.logger.info({ invoiceId: 100 }, 'Invoice validated');
context.logger.warn({ remaining: 2 }, 'Low inventory remaining');
context.logger.error({ error: err.message }, 'MySQL query failed');
context.logger.debug('Detailed debug traces');
```

### In-Memory Trace Capture
All logs are captured into the job record. When querying `GET /api/hooks/jobs/:jobId`, the response includes:
```json
{
  "success": true,
  "job": {
    "id": "job_1792640911558_94p5fe",
    "status": "completed",
    "durationMs": 300,
    "logs": [
      { "timestamp": "2026-10-22T03:48:31.559Z", "level": "info", "message": "Received hook payload" },
      { "timestamp": "2026-10-22T03:48:31.859Z", "level": "info", "message": "Processed hook task successfully" }
    ]
  }
}
```

---

## 5. Triggering from Directus

In your Directus Flow or Webhook:
- **URL**: `http://localhost:3020/api/hooks/<hook-name>`
- **Method**: `POST`
- **Headers**:
  - `Content-Type: application/json`
  - `Authorization: Bearer <STATIC_HOOK_TOKEN>` (or `x-hook-token: <STATIC_HOOK_TOKEN>`)
- **Body**: JSON payload

The service returns **`202 Accepted`** in ~2ms, immediately releasing Directus, while the task executes safely in the background.

