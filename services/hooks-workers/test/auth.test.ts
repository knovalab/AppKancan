import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.ts';

describe('Auth Middleware (verifyStaticToken)', () => {
	const TEST_TOKEN = 'test-secret-token-12345';
	let app: ReturnType<typeof createApp>;

	beforeEach(() => {
		process.env.STATIC_HOOK_TOKEN = TEST_TOKEN;
		app = createApp();
	});

	it('returns 401 if no auth header or x-hook-token is provided', async () => {
		const res = await app.request('/api/hooks');
		expect(res.status).toBe(401);
		const body = (await res.json()) as Record<string, any>;
		expect(body.error).toBe('Unauthorized');
	});

	it('returns 401 if wrong token is provided via Authorization Bearer', async () => {
		const res = await app.request('/api/hooks', {
			headers: {
				Authorization: 'Bearer wrong-token',
			},
		});
		expect(res.status).toBe(401);
	});

	it('returns 401 if wrong token is provided via x-hook-token', async () => {
		const res = await app.request('/api/hooks', {
			headers: {
				'x-hook-token': 'wrong-token',
			},
		});
		expect(res.status).toBe(401);
	});

	it('allows access with valid Authorization Bearer header', async () => {
		const res = await app.request('/api/hooks', {
			headers: {
				Authorization: `Bearer ${TEST_TOKEN}`,
			},
		});
		expect(res.status).toBe(200);
		const body = (await res.json()) as Record<string, any>;
		expect(body.success).toBe(true);
		expect(Array.isArray(body.hooks)).toBe(true);
	});

	it('allows access with valid x-hook-token header', async () => {
		const res = await app.request('/api/hooks', {
			headers: {
				'x-hook-token': TEST_TOKEN,
			},
		});
		expect(res.status).toBe(200);
		const body = (await res.json()) as Record<string, any>;
		expect(body.success).toBe(true);
	});

	it('returns 500 when STATIC_HOOK_TOKEN is unset in environment', async () => {
		delete process.env.STATIC_HOOK_TOKEN;
		const res = await app.request('/api/hooks', {
			headers: {
				Authorization: `Bearer ${TEST_TOKEN}`,
			},
		});
		expect(res.status).toBe(500);
		const body = (await res.json()) as Record<string, any>;
		expect(body.error).toBe('Server configuration error');
	});
});
