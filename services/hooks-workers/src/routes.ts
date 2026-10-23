import { Hono } from 'hono';
import { listHandlers } from './registry.ts';
import * as worker from './worker.ts';

const routes = new Hono();

/**
 * GET /api/hooks
 * Lists all registered hooks.
 */
routes.get('/', (c) => {
	return c.json({
		success: true,
		count: listHandlers().length,
		hooks: listHandlers(),
	});
});

/**
 * GET /api/hooks/jobs
 * Lists the most recent background jobs with optional limit and status filtering.
 */
routes.get('/jobs', (c) => {
	const limit = Math.max(1, Math.min(100, Number(c.req.query('limit')) || 20));
	const statusFilter = c.req.query('status');

	let jobs = worker.listRecentJobs();
	if (statusFilter) {
		jobs = jobs.filter((j) => j.status === statusFilter);
	}

	const paginated = jobs.slice(0, limit).map((j) => ({
		jobId: j.id,
		name: j.name,
		status: j.status,
		enqueuedAt: j.enqueuedAt,
		startedAt: j.startedAt,
		finishedAt: j.finishedAt,
		durationMs: j.durationMs,
		retriesAttempted: j.retriesAttempted ?? 0,
		error: j.error,
	}));

	return c.json({
		success: true,
		count: paginated.length,
		jobs: paginated,
	});
});

/**
 * GET /api/hooks/jobs/:jobId
 * Returns the status, execution duration, and output of a specific job.
 */
routes.get('/jobs/:jobId', (c) => {
	const jobId = c.req.param('jobId');
	const job = worker.getJob(jobId);

	if (!job) {
		return c.json(
			{
				success: false,
				error: 'Not Found',
				message: `Job "${jobId}" not found in recent execution history`,
			},
			404,
		);
	}

	return c.json({
		success: true,
		job: {
			id: job.id,
			name: job.name,
			status: job.status,
			enqueuedAt: job.enqueuedAt,
			startedAt: job.startedAt,
			finishedAt: job.finishedAt,
			durationMs: job.durationMs,
			retriesAttempted: job.retriesAttempted ?? 0,
			maxRetries: job.maxRetries ?? 0,
			result: job.result,
			error: job.error,
			logs: job.logs,
		},
	});
});

/**
 * POST /api/hooks/:name
 * Webhook trigger endpoint.
 * Enqueues the job and immediately responds with 202 Accepted.
 */
routes.post('/:name', async (c) => {
	const name = c.req.param('name');
	let payload: unknown = {};

	const rawBody = await c.req.text();
	if (rawBody && rawBody.trim().length > 0) {
		try {
			payload = JSON.parse(rawBody);
		} catch {
			return c.json(
				{
					success: false,
					error: 'Bad Request',
					message: 'Malformed request body; expected valid JSON',
				},
				400,
			);
		}
	}

	try {
		const job = worker.enqueue(name, payload);

		return c.json(
			{
				success: true,
				message: 'Hook accepted and queued for background processing',
				jobId: job.jobId,
				name: job.name,
				status: job.status,
			},
			202,
		);
	} catch (err: unknown) {
		const error = err as Error & { statusCode?: number };

		if (error.statusCode === 404) {
			return c.json(
				{
					success: false,
					error: 'Hook not found',
					message: error.message,
				},
				404,
			);
		}

		if (error.statusCode === 503) {
			return c.json(
				{
					success: false,
					error: 'Service Unavailable',
					message: error.message,
				},
				503,
			);
		}

		return c.json(
			{
				success: false,
				error: 'Internal Server Error',
				message: 'Failed to enqueue background job',
			},
			500,
		);
	}
});

export default routes;
