import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { verifyStaticToken } from './auth.ts';
import hookRoutes from './routes.ts';

export function createApp() {
	const app = new Hono();

	// Logger
	app.use('*', logger());

	// Public health check
	app.get('/health', (c) => {
		return c.json({
			status: 'ok',
			service: 'hooks-workers',
			timestamp: new Date().toISOString(),
		});
	});

	// Protected hooks API
	app.use('/api/hooks/*', verifyStaticToken);
	app.route('/api/hooks', hookRoutes);

	// 404 & Error boundaries
	app.notFound((c) => c.json({ error: 'Endpoint no encontrado' }, 404));
	app.onError((err, c) => {
		return c.json(
			{ error: 'Error interno del servidor', message: err.message },
			500,
		);
	});

	return app;
}
