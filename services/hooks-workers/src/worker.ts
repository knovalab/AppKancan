import { directus } from './directus.ts';
import { baseLogger } from './logger.ts';
import { getHandler, listHandlers } from './registry.ts';
import type {
	JobRecord,
	LogLevel,
	WorkerContext,
	WorkerLogger,
} from './types/index.ts';

// Bounded in-memory job tracker (stores the last MAX_HISTORY jobs)
const MAX_HISTORY = 100;
const MAX_LOGS_PER_JOB = 100;
const MAX_CONCURRENT_JOBS =
	Number(process.env.MAX_CONCURRENT_JOBS) > 0
		? Number(process.env.MAX_CONCURRENT_JOBS)
		: 5;

const jobsMap = new Map<string, JobRecord>();
const pendingQueue: string[] = [];
const runningJobIds = new Set<string>();
const keyLocks = new Map<string, Promise<void>>();

let activeJobCount = 0;
let isShuttingDown = false;

/**
 * Prunes the oldest jobs if the history exceeds MAX_HISTORY.
 */
function pruneHistory(): void {
	while (jobsMap.size > MAX_HISTORY) {
		const oldestKey = jobsMap.keys().next().value;
		if (oldestKey) {
			jobsMap.delete(oldestKey);
		}
	}
}

/**
 * Creates a unique job identifier.
 */
function generateJobId(): string {
	return `job_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

/**
 * Acquires a sequential lock for a given resource key (e.g. store ID).
 */
async function acquireKeyLock(key: string): Promise<() => void> {
	while (keyLocks.has(key)) {
		try {
			await keyLocks.get(key);
		} catch {
			// Continue if previous lock holder failed
		}
	}
	let release!: () => void;
	const lockPromise = new Promise<void>((resolve) => {
		release = resolve;
	});
	keyLocks.set(key, lockPromise);

	return () => {
		keyLocks.delete(key);
		release();
	};
}

/**
 * Extracts a concurrency key (such as store_id) from the job payload if present.
 */
function extractConcurrencyKey(payload: unknown): string | null {
	if (!payload || typeof payload !== 'object') return null;
	const p = payload as Record<string, unknown>;
	const rawStore = p.store_id ?? p.storeId ?? p.store;
	if (rawStore) {
		const storeId =
			typeof rawStore === 'object' && rawStore !== null && 'id' in rawStore
				? String((rawStore as { id: unknown }).id)
				: String(rawStore);
		return `store:${storeId}`;
	}
	return null;
}

/**
 * Worker execution engine with retries, timeout with AbortSignal, and resource locking.
 */
async function processJob(jobId: string): Promise<void> {
	const job = jobsMap.get(jobId);
	if (!job) return;

	const handler = getHandler(job.name);
	if (!handler) {
		job.status = 'failed';
		job.error = `Handler "${job.name}" not found in registry`;
		job.finishedAt = new Date().toISOString();
		baseLogger.error(
			{ jobId, hook: job.name },
			'Handler not found in registry',
		);
		return;
	}

	job.status = 'running';
	job.startedAt = new Date().toISOString();
	const startTime = Date.now();

	const child = baseLogger.child({ jobId, hook: job.name });

	const appendLog = (level: LogLevel, a: unknown, b?: unknown) => {
		let message = '';
		let data: unknown;

		if (typeof a === 'string') {
			message = a;
			data = b;
		} else if (typeof a === 'object' && a !== null) {
			data = a;
			message = typeof b === 'string' ? b : JSON.stringify(a);
		} else {
			message = String(a);
		}

		if (job.logs.length < MAX_LOGS_PER_JOB) {
			job.logs.push({
				timestamp: new Date().toISOString(),
				level,
				message,
				data,
			});
		}
	};

	function logWithChild(
		level: LogLevel,
		a: string | object,
		b?: unknown,
	): void {
		if (typeof a === 'string') {
			if (b !== undefined && typeof b === 'object' && b !== null) {
				child[level](b, a);
			} else if (b !== undefined) {
				child[level]({ data: b }, a);
			} else {
				child[level](a);
			}
		} else {
			child[level](a, typeof b === 'string' ? b : undefined);
		}
		appendLog(level, a, b);
	}

	const logger: WorkerLogger = {
		debug: (a: string | object, b?: unknown) => logWithChild('debug', a, b),
		info: (a: string | object, b?: unknown) => logWithChild('info', a, b),
		warn: (a: string | object, b?: unknown) => logWithChild('warn', a, b),
		error: (a: string | object, b?: unknown) => logWithChild('error', a, b),
	};

	const timeoutMs = handler.options?.timeoutMs ?? 60000;
	const maxRetries = handler.options?.maxRetries ?? 0;
	job.maxRetries = maxRetries;
	job.retriesAttempted = 0;

	logger.info({ payload: job.payload }, 'Job execution started');

	// Resource-level serialization if a concurrency key exists
	const concurrencyKey = extractConcurrencyKey(job.payload);
	let releaseLock: (() => void) | null = null;
	if (concurrencyKey) {
		releaseLock = await acquireKeyLock(concurrencyKey);
	}

	try {
		let attempt = 0;
		let lastError: Error | unknown = null;
		let successResult: unknown;
		let succeeded = false;

		while (attempt <= maxRetries && !succeeded) {
			if (attempt > 0) {
				const backoffMs = Math.min(1000 * 2 ** (attempt - 1), 10000);
				logger.warn(
					{ attempt, maxRetries, backoffMs },
					`Retrying failed job after ${backoffMs}ms backoff`,
				);
				await new Promise((res) => setTimeout(res, backoffMs));
			}

			const abortController = new AbortController();
			const timeoutTimer = setTimeout(() => {
				abortController.abort(
					new Error(`Execution timed out after ${timeoutMs}ms`),
				);
			}, timeoutMs);

			const context: WorkerContext = {
				jobId,
				hookName: job.name,
				directus,
				logger,
				signal: abortController.signal,
				log: (...args: unknown[]) => logger.info(args.map(String).join(' ')),
				warn: (...args: unknown[]) => logger.warn(args.map(String).join(' ')),
				error: (...args: unknown[]) => logger.error(args.map(String).join(' ')),
			};

			try {
				const runPromise = handler.run(job.payload, context);
				const abortPromise = new Promise<never>((_, reject) => {
					abortController.signal.addEventListener('abort', () => {
						reject(abortController.signal.reason);
					});
				});

				successResult = await Promise.race([runPromise, abortPromise]);
				succeeded = true;
			} catch (err) {
				lastError = err;
				attempt++;
				job.retriesAttempted = attempt;
			} finally {
				clearTimeout(timeoutTimer);
			}
		}

		const durationMs = Date.now() - startTime;
		job.durationMs = durationMs;
		job.finishedAt = new Date().toISOString();

		if (succeeded) {
			job.status = 'completed';
			job.result = successResult !== undefined ? successResult : null;
			logger.info(
				{ durationMs },
				`Job completed successfully in ${durationMs}ms`,
			);
		} else {
			const errorMsg =
				lastError instanceof Error ? lastError.message : String(lastError);
			job.status = 'failed';
			job.error = errorMsg;
			logger.error(
				{ durationMs, error: errorMsg, retriesAttempted: job.retriesAttempted },
				`Job failed after ${durationMs}ms`,
			);
		}
	} finally {
		if (releaseLock) {
			releaseLock();
		}
	}
}

/**
 * Pump the pending queue respecting the concurrency limit.
 */
function pumpQueue(): void {
	if (isShuttingDown) return;

	while (activeJobCount < MAX_CONCURRENT_JOBS && pendingQueue.length > 0) {
		const nextJobId = pendingQueue.shift();
		if (!nextJobId) break;

		activeJobCount++;
		runningJobIds.add(nextJobId);

		processJob(nextJobId)
			.catch((err) => {
				baseLogger.error(
					{ jobId: nextJobId, err },
					'Uncaught error during background execution',
				);
			})
			.finally(() => {
				activeJobCount--;
				runningJobIds.delete(nextJobId);
				pumpQueue();
			});
	}
}

export interface EnqueueResult {
	jobId: string;
	name: string;
	status: 'queued';
}

/**
 * Enqueues a job for background processing with concurrency throttling.
 */
export function enqueue(name: string, payload: unknown = {}): EnqueueResult {
	if (isShuttingDown) {
		const error = new Error('Service is shutting down') as Error & {
			statusCode?: number;
		};
		error.statusCode = 503;
		throw error;
	}

	const handler = getHandler(name);
	if (!handler) {
		const available = listHandlers().map((h) => h.name);
		const error = new Error(
			`Hook "${name}" is not registered. Available hooks: ${available.join(', ') || 'none'}`,
		) as Error & { statusCode?: number };
		error.statusCode = 404;
		throw error;
	}

	const jobId = generateJobId();
	const jobRecord: JobRecord = {
		id: jobId,
		name,
		status: 'queued',
		enqueuedAt: new Date().toISOString(),
		startedAt: null,
		finishedAt: null,
		durationMs: null,
		payload,
		result: null,
		error: null,
		logs: [],
	};

	jobsMap.set(jobId, jobRecord);
	pruneHistory();

	pendingQueue.push(jobId);
	setImmediate(pumpQueue);

	return {
		jobId,
		name,
		status: 'queued',
	};
}

/**
 * Retrieves the status and result of a job.
 */
export function getJob(jobId: string): JobRecord | null {
	return jobsMap.get(jobId) ?? null;
}

/**
 * Lists the most recent tracked jobs (up to MAX_HISTORY).
 */
export function listRecentJobs(): JobRecord[] {
	return Array.from(jobsMap.values()).reverse();
}

/**
 * Returns queue health and concurrency metrics.
 */
export function getQueueStats() {
	return {
		activeJobs: activeJobCount,
		queuedJobs: pendingQueue.length,
		maxConcurrentJobs: MAX_CONCURRENT_JOBS,
		totalTracked: jobsMap.size,
		isShuttingDown,
	};
}

/**
 * Drains all in-flight jobs for graceful shutdown.
 */
export async function drainInFlightJobs(timeoutMs = 10000): Promise<void> {
	isShuttingDown = true;
	baseLogger.info(
		{ running: runningJobIds.size, queued: pendingQueue.length },
		'Draining in-flight jobs for graceful shutdown',
	);

	const start = Date.now();
	while (runningJobIds.size > 0 && Date.now() - start < timeoutMs) {
		await new Promise((res) => setTimeout(res, 100));
	}

	if (runningJobIds.size > 0) {
		baseLogger.warn(
			{ remaining: runningJobIds.size },
			'Graceful drain timed out before all jobs completed',
		);
	} else {
		baseLogger.info('All in-flight jobs completed cleanly');
	}
}

export { getHandler, listHandlers };
