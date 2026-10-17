import { describe, expect, it, vi } from 'vitest';
import { crearApp } from '../src/app.ts';
import { leerConfig } from '../src/config.ts';
import type { ClienteDirectus } from '../src/directus/client.ts';
import { conReintentos } from '../src/directus/errors.ts';
import { ejecutarDiaTienda, ejecutarNocturno } from '../src/jobs/etlDiario.ts';
import { asegurarPeriodo } from '../src/load/periodo.ts';
import { guardarDiasTienda } from '../src/load/registroTienda.ts';

/** Cliente falso: cada llamada a request devuelve la siguiente respuesta y registra la petición. */
function clienteFalso(...respuestas: unknown[]) {
	const request = vi.fn();
	for (const r of respuestas) request.mockResolvedValueOnce(r);
	request.mockResolvedValue([]);
	return { directus: { request } as unknown as ClienteDirectus, request };
}
const metodo = (request: ReturnType<typeof vi.fn>, i: number) =>
	request.mock.calls[i][0];

const dia = (store: string) => ({
	store,
	work_day: '2026-10-16',
	open_time: '2026-10-16T08:00:00',
	close_time: null,
	operative_time: null,
});

describe('guardarDiasTienda', () => {
	it('crea las nuevas y actualiza las existentes (upsert por store + work_day)', async () => {
		const { directus, request } = clienteFalso([{ id: 7, store: '5' }]);
		const r = await guardarDiasTienda(directus, '2026-10-16', [
			dia('5'),
			dia('6'),
		]);
		expect(r).toEqual({ creadas: 1, actualizadas: 1 });
		expect(request).toHaveBeenCalledTimes(3);
		expect(metodo(request, 1)).toBeTypeOf('function'); // createItems
		expect(metodo(request, 2)).toBeTypeOf('function'); // updateItemsBatch
	});

	it('sin filas no llama a Directus', async () => {
		const { directus, request } = clienteFalso();
		expect(await guardarDiasTienda(directus, '2026-10-16', [])).toEqual({
			creadas: 0,
			actualizadas: 0,
		});
		expect(request).not.toHaveBeenCalled();
	});

	it('trocea en lotes de 100', async () => {
		const { directus, request } = clienteFalso([]);
		const filas = Array.from({ length: 250 }, (_, i) => dia(String(i)));
		expect(await guardarDiasTienda(directus, '2026-10-16', filas)).toEqual({
			creadas: 250,
			actualizadas: 0,
		});
		expect(request).toHaveBeenCalledTimes(1 + 3);
	});
});

describe('asegurarPeriodo', () => {
	const rango = { start_date: '2026-10-16', end_date: '2026-10-31' };

	it('devuelve el existente sin crear', async () => {
		const { directus, request } = clienteFalso([{ id: 3 }]);
		expect(await asegurarPeriodo(directus, rango)).toEqual({
			id: 3,
			creado: false,
		});
		expect(request).toHaveBeenCalledTimes(1);
	});

	it('lo crea si no existe', async () => {
		const { directus, request } = clienteFalso([], { id: 9 });
		expect(await asegurarPeriodo(directus, rango)).toEqual({
			id: 9,
			creado: true,
		});
		expect(request).toHaveBeenCalledTimes(2);
	});
});

describe('ejecutarDiaTienda', () => {
	it('dry-run calcula sin escribir', async () => {
		const marcaciones = [
			{
				id: 1,
				store_id: '90',
				log_type: 'Comenzar Jornada',
				record_time: '10:01:00',
			},
			{
				id: 2,
				store_id: '90',
				log_type: 'Terminar Jornada',
				record_time: '21:01:00',
			},
		];
		// Las dos lecturas van en paralelo: marcaciones y días cerrados.
		const { directus, request } = clienteFalso(marcaciones, []);
		const r = await ejecutarDiaTienda(directus, '2026-10-16', { dryRun: true });
		expect(r).toMatchObject({
			marcaciones: 2,
			tiendas: 1,
			sinCierre: 0,
			creadas: 0,
			actualizadas: 0,
		});
		expect(r.filas?.[0].operative_time).toBe(660);
		expect(request).toHaveBeenCalledTimes(2);
	});
});

describe('ejecutarNocturno', () => {
	it('si falla el periodo, el día de tienda se calcula igual', async () => {
		const prohibido = {
			errors: [{ message: 'sin permiso', extensions: { code: 'FORBIDDEN' } }],
			response: { status: 403 },
		};
		// Orden de llamadas: periodo (lectura), marcaciones, días cerrados, periodo (createItem).
		const { directus, request } = clienteFalso([], [], []);
		request.mockRejectedValueOnce(prohibido);
		const r = await ejecutarNocturno(directus);
		expect(r.periodo).toEqual({ error: 'Directus 403 FORBIDDEN: sin permiso' });
		expect(r.dia).toMatchObject({ tiendas: 0, creadas: 0 });
	});
});

describe('conReintentos', () => {
	it('reintenta errores de red y no los de permisos', async () => {
		const red = vi
			.fn()
			.mockRejectedValueOnce(new TypeError('fetch failed'))
			.mockResolvedValue('ok');
		expect(await conReintentos(red, 3, 1)).toBe('ok');
		expect(red).toHaveBeenCalledTimes(2);

		const prohibido = {
			errors: [{ message: 'x', extensions: { code: 'FORBIDDEN' } }],
			response: { status: 403 },
		};
		const f = vi.fn().mockRejectedValue(prohibido);
		await expect(conReintentos(f, 3, 1)).rejects.toBe(prohibido);
		expect(f).toHaveBeenCalledTimes(1);
	});
});

describe('GET /health/ready', () => {
	const config = leerConfig({
		DIRECTUS_URL: 'http://directus',
		DIRECTUS_ETL_TOKEN: 'secreto',
	});

	it('503 si Directus no está configurado', async () => {
		const res = await crearApp(leerConfig({})).request('/health/ready');
		expect(res.status).toBe(503);
	});

	it('200 con ping, usuario y lectura correctos', async () => {
		const { directus } = clienteFalso('pong', { id: 'u-1' }, [{ id: 1 }]);
		const res = await crearApp(config, { directus }).request('/health/ready');
		expect(res.status).toBe(200);
		expect(await res.json()).toMatchObject({ ready: true, usuario: 'u-1' });
	});

	it('503 con el motivo si Directus falla, sin exponer el token', async () => {
		const request = vi.fn().mockRejectedValue({
			errors: [
				{
					message: 'Invalid user credentials.',
					extensions: { code: 'INVALID_CREDENTIALS' },
				},
			],
			response: { status: 401 },
		});
		const res = await crearApp(config, {
			directus: { request } as unknown as ClienteDirectus,
		}).request('/health/ready');
		const texto = await res.text();
		expect(res.status).toBe(503);
		expect(texto).toContain('INVALID_CREDENTIALS');
		expect(texto).not.toContain('secreto');
	});
});
