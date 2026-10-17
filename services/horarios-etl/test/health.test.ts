import { describe, expect, it } from 'vitest';
import { crearApp } from '../src/app.ts';
import { leerConfig } from '../src/config.ts';

describe('GET /health', () => {
	const app = crearApp(leerConfig({ TZ: 'America/Bogota' }));

	it('responde 200 con el estado del servicio', async () => {
		const res = await app.request('/health');
		expect(res.status).toBe(200);
		const body = (await res.json()) as { uptimeSeconds: unknown };
		expect(body).toMatchObject({
			status: 'ok',
			service: 'horarios-etl',
			timezone: 'America/Bogota',
			directus: { configured: false },
		});
		expect(typeof body.uptimeSeconds).toBe('number');
	});

	it('no expone el token de Directus', async () => {
		const conToken = crearApp(
			leerConfig({
				DIRECTUS_URL: 'http://directus',
				DIRECTUS_ETL_TOKEN: 'secreto',
			}),
		);
		const texto = await (await conToken.request('/health')).text();
		expect(texto).not.toContain('secreto');
		expect(JSON.parse(texto).directus.configured).toBe(true);
	});

	it('devuelve 404 en JSON para rutas desconocidas', async () => {
		const res = await app.request('/nada');
		expect(res.status).toBe(404);
		expect(await res.json()).toEqual({ error: 'Endpoint no encontrado' });
	});
});
