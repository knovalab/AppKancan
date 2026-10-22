import type { DirectusService } from './directus.ts';

export type JobStatus = 'queued' | 'running' | 'completed' | 'failed';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
	timestamp: string;
	level: LogLevel;
	message: string;
	data?: unknown;
}

export interface WorkerLogger {
	debug(msg: string, data?: unknown): void;
	debug(data: object, msg?: string): void;
	info(msg: string, data?: unknown): void;
	info(data: object, msg?: string): void;
	warn(msg: string, data?: unknown): void;
	warn(data: object, msg?: string): void;
	error(msg: string, data?: unknown): void;
	error(data: object, msg?: string): void;
}

export interface WorkerContext<TDirectus = DirectusService> {
	jobId: string;
	hookName: string;
	directus: TDirectus;
	logger: WorkerLogger;
	signal?: AbortSignal;
	log: (...args: unknown[]) => void;
	warn: (...args: unknown[]) => void;
	error: (...args: unknown[]) => void;
}

export interface HookOptions {
	timeoutMs?: number;
	maxRetries?: number;
	concurrencyKey?: string;
}

export interface HookHandler<
	TPayload = any,
	TResult = any,
	TDirectus = DirectusService,
> {
	name: string;
	description: string;
	options?: HookOptions;
	run: (
		payload: TPayload,
		context: WorkerContext<TDirectus>,
	) => Promise<TResult>;
}

export interface JobRecord<TPayload = any, TResult = any> {
	id: string;
	name: string;
	status: JobStatus;
	enqueuedAt: string;
	startedAt: string | null;
	finishedAt: string | null;
	durationMs: number | null;
	retriesAttempted?: number;
	maxRetries?: number;
	payload: TPayload;
	result: TResult | null;
	error: string | null;
	logs: LogEntry[];
}
