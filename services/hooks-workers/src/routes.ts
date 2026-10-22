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
 * Lists the most recent background jobs.
 */
routes.get('/jobs', (c) => {
	const jobs = worker
		.listRecentJobs()
		.slice(0, 20)
		.map((j) => ({
			jobId: j.id,
			name: j.name,
			status: j.status,
			enqueuedAt: j.enqueuedAt,
			startedAt: j.startedAt,
			finishedAt: j.finishedAt,
			durationMs: j.durationMs,
			error: j.error,
		}));

	return c.json({
		success: true,
		count: jobs.length,
		jobs,
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

	try {
		payload = await c.req.json();
	} catch {
		try {
			const text = await c.req.text();
			payload = text ? JSON.parse(text) : {};
		} catch {
			payload = {};
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
