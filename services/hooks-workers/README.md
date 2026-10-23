# Hooks Workers Service

Dedicated, standalone background worker and webhook processing service for Directus.
Built with **Node 22 (Native TypeScript Support) + Hono + Pino**.

Runs completely isolated from the frontend and legacy services, providing zero regression risk to existing code.

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
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

---

## 2. Generating & Configuring Tokens

The service relies on two tokens for authentication and Directus API communication:

### A. Generate `STATIC_HOOK_TOKEN` (Webhook Authentication)
This is a shared secret token used to verify that incoming requests to `/api/hooks/*` are authorized (from Directus Flows, webhooks, or scheduled crons).

Generate a secure 64-character random hex token directly from your terminal:

```bash
# Option 1: Using OpenSSL (recommended)
openssl rand -hex 32

# Option 2: Using Node.js crypto
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Copy the generated string and set it in your `.env`:
```env
STATIC_HOOK_TOKEN=4f8b9e2c1a3d5f7...your_generated_hex_token...
```

### B. Obtain `DIRECTUS_SERVICE_TOKEN` (Directus SDK Client)
The worker uses the official `@directus/sdk` to query and mutate store records in Directus.

1. Log into your Directus Admin App (e.g. `https://directus.kancan.knovalab.com`).
2. Navigate to **Settings** > **Users** (or open your dedicated service user profile).
3. Under **Token**, generate or copy the static access token.
4. Ensure this user role has read/write permissions for `com_time_records`, `com_time_record_store`, and `core_stores`.
5. Set it in `.env`:
```env
DIRECTUS_SERVICE_TOKEN=your_directus_static_service_token
```

### Full Environment Variables Reference

| Variable | Description | Default |
| :--- | :--- | :--- |
| `PORT` | HTTP port where Hono server listens | `3020` |
| `NODE_ENV` | Environment (`development` uses pretty logs, `production` outputs JSON) | `development` |
| `LOG_LEVEL` | Pino logger severity (`debug`, `info`, `warn`, `error`) | `info` |
| `SERVICE_TIMEZONE` | Canonical operational timezone for dates and store shifts | `America/Bogota` |
| `MAX_CONCURRENT_JOBS` | Maximum number of worker tasks executing simultaneously | `5` |
| `STATIC_HOOK_TOKEN` | Secret static token required to trigger webhooks | *(Required)* |
| `DIRECTUS_URL` | Base URL of the Directus instance | `https://directus.kancan.knovalab.com` |
| `DIRECTUS_SERVICE_TOKEN` | Static access token for Directus SDK operations | *(Required)* |

---

## 3. Running the Service

### Start Development Server (Hot Reloading on port 3020)
```bash
npm run dev
```

### Start Production Server
```bash
npm start
```

### Run Typecheck (TypeScript)
```bash
npm run typecheck
```

### Run Test Suite (Vitest)
```bash
npm run test
```

---

## 4. Registered Hooks Catalog

The service comes pre-configured with 5 background worker hooks:

| Hook Name | Trigger Method | Purpose |
| :--- | :--- | :--- |
| **`sync-store-time-records`** | Scheduled / Manual | Reviews all stores for a date, selects earliest `"Comenzar Jornada"` punch, and creates/updates `open_time` and `open_user`. |
| **`sync-store-close-time-records`** | Scheduled / Manual | Reviews all stores for a date, selects the latest `"Terminar Jornada"` punch, updates `close_time`, `close_user`, and recalculates `operative_time`. |
| **`on-time-record-created`** | Directus Webhook (Action) | Real-time event when an employee logs a time record in Directus (`{ key: number }`). |
| **`on-time-record-updated`** | Directus Webhook (Action) | Real-time event when a time record is edited in Directus (`{ keys: number[] }`). |
| **`dummy-task`** | Manual / Health Verification | Reference task demonstrating asynchronous execution, tracing, and logging. |

---

## 5. Using the Worker

### A. Testing Locally via CLI (No Server or Directus Webhook Required)

You can run and test any hook directly from your terminal:

```bash
# 1. List all registered hooks
npm run cli

# 2. Test opening time synchronization for today
npm run cli -- sync-store-time-records '{"date": "2026-10-22"}'

# 3. Test closing time synchronization for a specific store
npm run cli -- sync-store-close-time-records '{"date": "2026-10-22", "store_id": "1003"}'

# 4. Simulate a real-time Directus time record creation webhook
npm run cli -- on-time-record-created '{"key": 110513}'

# 5. Run the dummy diagnostic task
npm run cli -- dummy-task '{"id": 42, "action": "test"}'
```

---

### B. Triggering from Directus Webhooks or Flows

In your Directus Flow (Operation: **Webhook / Request URL**):

- **Method**: `POST`
- **URL**: `http://localhost:3020/api/hooks/<hook-name>` (or your deployed worker domain)
- **Headers**:
  ```http
  Content-Type: application/json
  Authorization: Bearer <STATIC_HOOK_TOKEN>
  ```
  *(Alternative header: `x-hook-token: <STATIC_HOOK_TOKEN>`)*

#### Example 1: Trigger Daily Store Opening Sync
```bash
curl -X POST http://localhost:3020/api/hooks/sync-store-time-records \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <STATIC_HOOK_TOKEN>" \
  -d '{"date": "2026-10-22"}'
```

#### Example 2: Trigger Daily Store Closing Sync
```bash
curl -X POST http://localhost:3020/api/hooks/sync-store-close-time-records \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <STATIC_HOOK_TOKEN>" \
  -d '{"date": "2026-10-22"}'
```

#### Immediate Response (`202 Accepted`):
The service responds within **~2ms** with an immediate acceptance, freeing Directus while execution continues in the background:
```json
{
  "success": true,
  "message": "Hook accepted and queued for background processing",
  "jobId": "job_1792706590626_cgq5q0",
  "name": "sync-store-close-time-records",
  "status": "queued"
}
```

---

### C. Monitoring & Job Inspection API

#### 1. Public Health Check & Queue Metrics
`GET /health` (No authentication required)
```bash
curl http://localhost:3020/health
```
Response:
```json
{
  "status": "ok",
  "service": "hooks-workers",
  "timezone": "America/Bogota",
  "queue": {
    "activeJobs": 0,
    "queuedJobs": 0,
    "maxConcurrentJobs": 5,
    "totalTracked": 12,
    "isShuttingDown": false
  },
  "timestamp": "2026-10-22T22:15:00.000Z"
}
```

#### 2. List Recent Background Jobs
`GET /api/hooks/jobs?limit=10&status=completed`
```bash
curl http://localhost:3020/api/hooks/jobs \
  -H "Authorization: Bearer <STATIC_HOOK_TOKEN>"
```

#### 3. Inspect Specific Job Result & Execution Logs
`GET /api/hooks/jobs/:jobId`
```bash
curl http://localhost:3020/api/hooks/jobs/job_1792706590626_cgq5q0 \
  -H "Authorization: Bearer <STATIC_HOOK_TOKEN>"
```
Response:
```json
{
  "success": true,
  "job": {
    "id": "job_1792706590626_cgq5q0",
    "name": "sync-store-close-time-records",
    "status": "completed",
    "durationMs": 340,
    "retriesAttempted": 0,
    "result": {
      "date": "2026-10-22",
      "workDay": "2026-10-22",
      "totalStores": 18,
      "created": 0,
      "updated": 2,
      "unchanged": 16
    },
    "logs": [
      {
        "timestamp": "2026-10-22T22:15:01.002Z",
        "level": "info",
        "message": "Job execution started"
      },
      {
        "timestamp": "2026-10-22T22:15:01.342Z",
        "level": "info",
        "message": "Job completed successfully in 340ms"
      }
    ]
  }
}
```

---

## 6. How to Add a New Hook

Adding a new custom hook handler takes 3 simple steps:

### Step 1: Create Handler in `src/handlers/<hookName>.ts`
```typescript
import type { HookHandler, WorkerContext } from '../types/index.ts';

export interface MyPayload {
  orderId: number;
}

export interface MyResult {
  processed: boolean;
}

const myHookHandler: HookHandler<MyPayload, MyResult> = {
  name: 'process-order',
  description: 'Processes store orders in the background',
  options: {
    timeoutMs: 30000,
    maxRetries: 2,
  },

  async run(payload: MyPayload, context: WorkerContext): Promise<MyResult> {
    const { logger, directus, signal } = context;

    logger.info({ orderId: payload.orderId }, 'Processing order...');
    // Directus SDK client is pre-injected:
    // await directus.request(...)

    return { processed: true };
  },
};

export default myHookHandler;
```

### Step 2: Export from `src/handlers/index.ts`
```typescript
import myHookHandler from './my-hook.ts';
export { myHookHandler };
```

### Step 3: Register in `src/registry.ts`
```typescript
export const handlers: Record<string, HookHandler> = {
  // ...
  [myHookHandler.name]: myHookHandler,
};
```

Your new hook will immediately be accessible via:
- HTTP: `POST /api/hooks/process-order`
- CLI: `npm run cli -- process-order '{"orderId": 123}'`
- Auto-documented in `GET /api/hooks`

---

## 7. Architecture & Resilience Features

- **Concurrency Limiting**: Internal queue pools jobs up to `MAX_CONCURRENT_JOBS` (default: 5) to prevent API flooding against Directus.
- **Store-Level Mutex**: Key-based locking (`store:<id>`) serializes operations targeting the same store, eliminating race conditions and duplicate daily store records.
- **Automatic Retries**: Respects `handler.options.maxRetries` with exponential backoff on transient errors.
- **Timeout Cancellation**: Abort signals (`context.signal`) are propagated to cancel pending requests when timeouts elapse.
- **Graceful Shutdown**: Catches `SIGTERM` and `SIGINT`, rejects new traffic, and drains in-flight jobs cleanly before exiting.
- **Timezone Awareness**: Normalizes daily calculations according to `SERVICE_TIMEZONE` (`America/Bogota`), preventing server UTC midnight roll-over issues.

