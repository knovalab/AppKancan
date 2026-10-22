import { resolve } from 'node:path';
import { serve } from '@hono/node-server';
import { createApp } from './app.ts';
import { baseLogger } from './logger.ts';

// Load .env
const envPath = resolve(process.cwd(), '../../.env');
try {
	if (typeof process.loadEnvFile === 'function') {
		process.loadEnvFile(envPath);
	}
} catch {
	// Continue if .env is already loaded
}

const PORT = Number(process.env.PORT) || 3020;
const app = createApp();

baseLogger.info({}, 'Starting Hooks Worker Service');

serve(
	{
		fetch: app.fetch,
		port: PORT,
	},
	(info) => {
		baseLogger.info(
			{
				port: info.port,
				healthUrl: `http://localhost:${info.port}/health`,
				hooksUrl: `http://localhost:${info.port}/api/hooks`,
			},
			'Hooks Worker Service is online',
		);
	},
);
