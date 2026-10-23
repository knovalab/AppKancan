import crypto from 'node:crypto';
import type { Context, Next } from 'hono';

/**
 * Constant-time string equality check to prevent timing side-channel attacks.
 */
function safeCompare(a: string, b: string): boolean {
	if (typeof a !== 'string' || typeof b !== 'string') return false;
	const hashA = crypto.createHash('sha256').update(a).digest();
	const hashB = crypto.createHash('sha256').update(b).digest();
	return crypto.timingSafeEqual(hashA, hashB);
}

/**
 * Hono middleware to authenticate webhook requests using a static secret token.
 * Reads token from:
 *   1. "Authorization: Bearer <TOKEN>"
 *   2. "x-hook-token: <TOKEN>"
 */
export async function verifyStaticToken(
	c: Context,
	next: Next,
): Promise<Response | undefined> {
	const expectedToken = process.env.STATIC_HOOK_TOKEN;

	if (!expectedToken) {
		return c.json(
			{
				error: 'Server configuration error',
				message: 'STATIC_HOOK_TOKEN is not configured on the worker service',
			},
			500,
		);
	}

	let receivedToken: string | null = null;

	const authHeader = c.req.header('authorization');
	if (authHeader?.startsWith('Bearer ')) {
		receivedToken = authHeader.substring(7).trim();
	}

	if (!receivedToken) {
		const customHeader = c.req.header('x-hook-token');
		if (customHeader) {
			receivedToken = customHeader.trim();
		}
	}

	if (!receivedToken || !safeCompare(receivedToken, expectedToken)) {
		return c.json(
			{
				error: 'Unauthorized',
				message: 'Invalid or missing static hook authentication token',
			},
			401,
		);
	}

	await next();
}
