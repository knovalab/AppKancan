import { readItems, readMe, serverPing } from '@directus/sdk';
import { Hono } from 'hono';
import { type Config, directusConfigurado } from '../config.ts';
import type { ClienteDirectus } from '../directus/client.ts';
import { describirError } from '../directus/errors.ts';

const inicio = Date.now();

/**
 * `GET /health`: el proceso está vivo (lo usa el HEALTHCHECK de Docker; no consulta Directus).
 * `GET /health/ready`: puede trabajar: Directus responde, el token vale y hay permiso de lectura.
 */
export function rutasHealth(config: Config, directus: ClienteDirectus | null) {
	const app = new Hono();
	app.get('/', (c) =>
		c.json({
			status: 'ok',
			service: 'horarios-etl',
			timestamp: new Date().toISOString(),
			uptimeSeconds: Math.round((Date.now() - inicio) / 1000),
			timezone: config.timezone,
			directus: { configured: directusConfigurado(config) },
		}),
	);

	app.get('/ready', async (c) => {
		if (!directus)
			return c.json({ ready: false, motivo: 'Directus no configurado' }, 503);
		const t0 = Date.now();
		try {
			await directus.request(serverPing());
			const yo = await directus.request(readMe({ fields: ['id'] }));
			await directus.request(
				readItems('com_time_records', { fields: ['id'], limit: 1 }),
			);
			return c.json({
				ready: true,
				usuario: yo.id,
				latenciaMs: Date.now() - t0,
			});
		} catch (err) {
			return c.json({ ready: false, motivo: describirError(err) }, 503);
		}
	});
	return app;
}
