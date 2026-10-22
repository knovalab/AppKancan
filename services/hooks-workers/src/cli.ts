#!/usr/bin/env node

/**
 * CLI Tool for Testing Worker Hooks Locally
 *
 * Usage:
 *   npm run cli -- <hook-name> '[optional-json-payload]'
 *
 * Example:
 *   npm run cli -- dummy-task '{"test": 123}'
 */

import 'dotenv/config';
import { directus } from './directus.ts';
import { baseLogger } from './logger.ts';
import { getHandler, listHandlers } from './registry.ts';
import type { WorkerContext, WorkerLogger } from './types.ts';

async function main(): Promise<void> {
	const args = process.argv.slice(2);
	const hookName = args[0];
	const rawPayload = args[1];

	if (!hookName || hookName === '--help' || hookName === '-h') {
		process.stdout.write(
			"Usage: npm run cli -- <hook-name> '[json-payload]'\n\n",
		);
		process.stdout.write('Available registered hooks:\n');
		const list = listHandlers();
		if (list.length === 0) {
			process.stdout.write('  (No hooks registered in registry.ts)\n');
		} else {
			for (const h of list) {
				process.stdout.write(`  - ${h.name.padEnd(20)} : ${h.description}\n`);
			}
		}
		process.exit(0);
	}

	const handler = getHandler(hookName);
	if (!handler) {
		const available =
			listHandlers()
				.map((h) => h.name)
				.join(', ') || 'none';
		baseLogger.error(
			{ hookName, available },
			`Hook "${hookName}" not found in registry`,
		);
		process.exit(1);
	}

	let payload: unknown = {};
	if (rawPayload) {
		try {
			payload = JSON.parse(rawPayload);
		} catch (e: unknown) {
			const msg = e instanceof Error ? e.message : String(e);
			baseLogger.error({ error: msg }, 'Failed to parse JSON payload');
			process.exit(1);
		}
	}

	const cliLogger = baseLogger.child({
		jobId: `cli_${Date.now()}`,
		hook: hookName,
	});
	cliLogger.info(
		{ payload, description: handler.description },
		'Executing hook locally via CLI',
	);

	const logger: WorkerLogger = {
		debug: (a: any, b?: any) =>
			typeof a === 'string' ? cliLogger.debug(b, a) : cliLogger.debug(a, b),
		info: (a: any, b?: any) =>
			typeof a === 'string' ? cliLogger.info(b, a) : cliLogger.info(a, b),
		warn: (a: any, b?: any) =>
			typeof a === 'string' ? cliLogger.warn(b, a) : cliLogger.warn(a, b),
		error: (a: any, b?: any) =>
			typeof a === 'string' ? cliLogger.error(b, a) : cliLogger.error(a, b),
	};

	const mockContext: WorkerContext = {
		jobId: `cli_${Date.now()}`,
		hookName,
		directus,
		logger,
		log: (...msg: unknown[]) => logger.info(msg.map(String).join(' ')),
		warn: (...msg: unknown[]) => logger.warn(msg.map(String).join(' ')),
		error: (...msg: unknown[]) => logger.error(msg.map(String).join(' ')),
	};

	const startTime = Date.now();
	try {
		const result = await handler.run(payload, mockContext);
		const durationMs = Date.now() - startTime;
		cliLogger.info(
			{ durationMs, result },
			`Hook completed successfully in ${durationMs}ms`,
		);
	} catch (err: unknown) {
		const durationMs = Date.now() - startTime;
		const errorMsg = err instanceof Error ? err.message : String(err);
		cliLogger.error(
			{ durationMs, error: errorMsg },
			`Hook execution failed after ${durationMs}ms`,
		);
		process.exit(1);
	}
}

main().catch((err: unknown) => {
	baseLogger.fatal({ err }, 'Fatal error during CLI execution');
	process.exit(1);
});
