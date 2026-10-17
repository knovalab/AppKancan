import { Hono } from 'hono';
import { logger } from 'hono/logger';
import type { Config } from './config.ts';
import type { ClienteDirectus } from './directus/client.ts';
import { rutasHealth } from './routes/health.ts';

/**
 * App Hono independiente del runtime: no usa APIs de Node ni de Bun.
 * El arranque (server.ts) es el único archivo atado a Node.
 */
export function crearApp(
	config: Config,
	{ directus = null }: { directus?: ClienteDirectus | null } = {},
) {
	const app = new Hono();
	app.use('*', logger());

	app.route('/health', rutasHealth(config, directus));

	app.notFound((c) => c.json({ error: 'Endpoint no encontrado' }, 404));
	app.onError((err, c) => {
		console.error('❌ Error no controlado:', err);
		return c.json({ error: 'Error interno del servidor' }, 500);
	});

	return app;
}
