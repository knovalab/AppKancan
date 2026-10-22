import 'dotenv/config';
import { serve } from '@hono/node-server';
import { createApp } from './app.ts';
import { baseLogger } from './logger.ts';

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
