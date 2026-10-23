import 'dotenv/config';
import { serve } from '@hono/node-server';
import { createApp } from './app.ts';
import { baseLogger } from './logger.ts';
import { drainInFlightJobs } from './worker.ts';

const PORT = Number(process.env.PORT) || 3020;
const app = createApp();

baseLogger.info({}, 'Starting Hooks Worker Service');

const server = serve(
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

// Graceful shutdown handling
let isTerminating = false;
async function shutdown(signal: string) {
	if (isTerminating) return;
	isTerminating = true;

	baseLogger.info({ signal }, 'Received termination signal, shutting down');

	server.close(() => {
		baseLogger.info('HTTP server closed, no longer accepting new requests');
	});

	try {
		await drainInFlightJobs(10000);
		baseLogger.info('Worker shutdown completed cleanly');
		process.exit(0);
	} catch (err) {
		baseLogger.error({ err }, 'Error during graceful shutdown drain');
		process.exit(1);
	}
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
