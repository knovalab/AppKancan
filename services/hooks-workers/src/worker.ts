import { directus } from './directus.ts';
import { baseLogger } from './logger.ts';
import { getHandler, listHandlers } from './registry.ts';
import type {
	JobRecord,
	LogLevel,
	WorkerContext,
	WorkerLogger,
} from './types.ts';

// Bounded in-memory job tracker (stores the last MAX_HISTORY jobs)
const MAX_HISTORY = 100;
const MAX_LOGS_PER_JOB = 100;
const jobsMap = new Map<string, JobRecord>();

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
 * Executes a promise with a timeout limit.
 */
function withTimeout<T>(
	promise: Promise<T>,
	timeoutMs: number,
	jobLabel: string,
): Promise<T> {
	return Promise.race([
		promise,
		new Promise<never>((_, reject) =>
			setTimeout(
				() =>
					reject(
						new Error(
							`Execution timed out after ${timeoutMs}ms for ${jobLabel}`,
						),
					),
				timeoutMs,
			),
		),
	]);
}

/**
 * Worker execution engine.
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
		let data: unknown = undefined;

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

	const logger: WorkerLogger = {
		debug: (a: any, b?: any) => {
			if (typeof a === 'string') child.debug(b, a);
			else child.debug(a, b);
			appendLog('debug', a, b);
		},
		info: (a: any, b?: any) => {
			if (typeof a === 'string') child.info(b, a);
			else child.info(a, b);
			appendLog('info', a, b);
		},
		warn: (a: any, b?: any) => {
			if (typeof a === 'string') child.warn(b, a);
			else child.warn(a, b);
			appendLog('warn', a, b);
		},
		error: (a: any, b?: any) => {
			if (typeof a === 'string') child.error(b, a);
			else child.error(a, b);
			appendLog('error', a, b);
		},
	};

	const context: WorkerContext = {
		jobId,
		hookName: job.name,
		directus,
		logger,
		log: (...args: unknown[]) => logger.info(args.map(String).join(' ')),
		warn: (...args: unknown[]) => logger.warn(args.map(String).join(' ')),
		error: (...args: unknown[]) => logger.error(args.map(String).join(' ')),
	};

	logger.info({ payload: job.payload }, 'Job execution started');

	const timeoutMs = handler.options?.timeoutMs ?? 60000;

	try {
		const result = await withTimeout(
			handler.run(job.payload, context),
			timeoutMs,
			`[${jobId}] [${job.name}]`,
		);

		const durationMs = Date.now() - startTime;
		job.status = 'completed';
		job.result = result !== undefined ? result : null;
		job.finishedAt = new Date().toISOString();
		job.durationMs = durationMs;

		logger.info(
			{ durationMs },
			`Job completed successfully in ${durationMs}ms`,
		);
	} catch (err: unknown) {
		const durationMs = Date.now() - startTime;
		const errorMsg = err instanceof Error ? err.message : String(err);

		job.status = 'failed';
		job.error = errorMsg;
		job.finishedAt = new Date().toISOString();
		job.durationMs = durationMs;

		logger.error(
			{ durationMs, error: errorMsg },
			`Job failed after ${durationMs}ms`,
		);
	}
}

export interface EnqueueResult {
	jobId: string;
	name: string;
	status: 'queued';
}

/**
 * Enqueues a job for background processing.
 */
export function enqueue(name: string, payload: unknown = {}): EnqueueResult {
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

	// Asynchronously execute in the background on the next tick
	setImmediate(() => {
		processJob(jobId).catch((err) => {
			baseLogger.error(
				{ jobId, err },
				'Uncaught error during background execution',
			);
		});
	});

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

export { getHandler, listHandlers };
