import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.ts';

process.env.STATIC_HOOK_TOKEN = 'test_secret_token_123';

describe('Hooks Worker Service Integration Tests', () => {
	const app = createApp();

	it('GET /health should return 200 OK publicly', async () => {
		const res = await app.request('/health');
		expect(res.status).toBe(200);
		const json = (await res.json()) as { status: string; service: string };
		expect(json.status).toBe('ok');
		expect(json.service).toBe('hooks-workers');
	});

	it('GET /api/hooks without token should return 401 Unauthorized', async () => {
		const res = await app.request('/api/hooks');
		expect(res.status).toBe(401);
		const json = (await res.json()) as { error: string };
		expect(json.error).toBe('Unauthorized');
	});

	it('POST /api/hooks/dummy-task with wrong token should return 401', async () => {
		const res = await app.request('/api/hooks/dummy-task', {
			method: 'POST',
			headers: {
				Authorization: 'Bearer wrong_token',
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({ hello: 'world' }),
		});
		expect(res.status).toBe(401);
	});

	it('GET /api/hooks with valid token should list registered hooks', async () => {
		const res = await app.request('/api/hooks', {
			headers: {
				Authorization: 'Bearer test_secret_token_123',
			},
		});
		expect(res.status).toBe(200);
		const json = (await res.json()) as {
			success: boolean;
			hooks: Array<{ name: string }>;
		};
		expect(json.success).toBe(true);
		expect(json.hooks.some((h) => h.name === 'dummy-task')).toBe(true);
	});

	it('POST /api/hooks/unknown-hook should return 404', async () => {
		const res = await app.request('/api/hooks/unknown-hook', {
			method: 'POST',
			headers: {
				Authorization: 'Bearer test_secret_token_123',
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({}),
		});
		expect(res.status).toBe(404);
		const json = (await res.json()) as { error: string };
		expect(json.error).toBe('Hook not found');
	});

	it('POST /api/hooks/dummy-task returns 202 Accepted and executes in background', async () => {
		const res = await app.request('/api/hooks/dummy-task', {
			method: 'POST',
			headers: {
				Authorization: 'Bearer test_secret_token_123',
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				event: { collection: 'ventas', key: 'REC-123' },
				action: 'sync',
			}),
		});

		expect(res.status).toBe(202);
		const json = (await res.json()) as {
			success: boolean;
			jobId: string;
			name: string;
			status: string;
		};
		expect(json.success).toBe(true);
		expect(json.name).toBe('dummy-task');
		expect(json.status).toBe('queued');
		expect(json.jobId).toBeDefined();

		// Poll status
		let finished = false;
		for (let i = 0; i < 20; i++) {
			await new Promise((r) => setTimeout(r, 50));
			const pollRes = await app.request(`/api/hooks/jobs/${json.jobId}`, {
				headers: { Authorization: 'Bearer test_secret_token_123' },
			});
			const pollJson = (await pollRes.json()) as {
				job: {
					status: string;
					result: { status: string; processedRecord: string };
					logs: Array<{ level: string; message: string }>;
				};
			};
			if (pollJson.job.status === 'completed') {
				finished = true;
				expect(pollJson.job.result.status).toBe('success');
				expect(pollJson.job.result.processedRecord).toBe('REC-123');
				expect(Array.isArray(pollJson.job.logs)).toBe(true);
				expect(pollJson.job.logs.length).toBeGreaterThan(0);
				break;
			}
		}

		expect(finished).toBe(true);
	});
});
