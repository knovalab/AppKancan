import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.ts';

describe('App & Routes Endpoints', () => {
	const TEST_TOKEN = 'secret-test-token';
	let app: ReturnType<typeof createApp>;

	beforeEach(() => {
		process.env.STATIC_HOOK_TOKEN = TEST_TOKEN;
		app = createApp();
	});

	it('GET /health returns 200 with status ok and queue statistics', async () => {
		const res = await app.request('/health');
		expect(res.status).toBe(200);
		const body = (await res.json()) as Record<string, any>;
		expect(body.status).toBe('ok');
		expect(body.service).toBe('hooks-workers');
		expect(body.timezone).toBeDefined();
		expect(body.queue).toBeDefined();
		expect(body.queue.activeJobs).toBeDefined();
	});

	it('POST /api/hooks/:name returns 400 when body has malformed JSON', async () => {
		const res = await app.request('/api/hooks/dummy-task', {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${TEST_TOKEN}`,
				'Content-Type': 'application/json',
			},
			body: '{ malformed json: missing quotes }',
		});
		expect(res.status).toBe(400);
		const body = (await res.json()) as Record<string, any>;
		expect(body.error).toBe('Bad Request');
	});

	it('POST /api/hooks/:name returns 404 for an unregistered hook name', async () => {
		const res = await app.request('/api/hooks/non-existent-hook', {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${TEST_TOKEN}`,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({}),
		});
		expect(res.status).toBe(404);
		const body = (await res.json()) as Record<string, any>;
		expect(body.error).toBe('Hook not found');
	});

	it('POST /api/hooks/:name accepts valid payload and returns 202 Accepted', async () => {
		const res = await app.request('/api/hooks/dummy-task', {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${TEST_TOKEN}`,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({ test: 123 }),
		});
		expect(res.status).toBe(202);
		const body = (await res.json()) as Record<string, any>;
		expect(body.success).toBe(true);
		expect(body.status).toBe('queued');
		expect(body.jobId).toMatch(/^job_/);
	});

	it('GET /api/hooks/jobs lists recent jobs', async () => {
		const res = await app.request('/api/hooks/jobs', {
			headers: {
				Authorization: `Bearer ${TEST_TOKEN}`,
			},
		});
		expect(res.status).toBe(200);
		const body = (await res.json()) as Record<string, any>;
		expect(body.success).toBe(true);
		expect(Array.isArray(body.jobs)).toBe(true);
	});
});
