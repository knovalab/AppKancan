import { beforeEach, describe, expect, it, vi } from 'vitest';

const request = vi.fn();
vi.mock('@/services/directus/directus', () => ({ default: { request: (q: unknown) => request(q) } }));
vi.mock('@/auth/services/directusInterceptor', () => ({ withAutoRefresh: (fn: () => unknown) => fn() }));
vi.mock('@directus/sdk', () => ({
	aggregate: (c: string, o: unknown) => ({ op: 'aggregate', c, o }),
	readItems: (c: string, q: unknown) => ({ op: 'read', c, q }),
}));

import {
	agregadoHorasExtras,
	filtroAgregado,
	listarZonas,
	nombreZona,
	JEFES_ZONA,
} from '@/apps/horarios/api/directus/reportesHorasExtras';

beforeEach(() => request.mockReset());

describe('filtroAgregado', () => {
	it('siempre sin la tienda de pruebas; estados, rango y periodo', () => {
		expect(filtroAgregado({ estados: ['aprobada'], desde: '2026-10-01', hasta: '2026-10-15', conPeriodo: true })).toEqual({
			_and: [
				{ store_id: { _neq: 90 } },
				{ status: { _in: ['aprobada'] } },
				{ work_date: { _gte: '2026-10-01' } },
				{ work_date: { _lte: '2026-10-15' } },
				{ period_id: { _nnull: true } },
			],
		});
		expect(filtroAgregado({ estados: ['pendiente'], conPeriodo: false })._and).toContainEqual({ period_id: { _null: true } });
		// Zona: solo la tienda trabajada (no la del empleado).
		expect(filtroAgregado({ estados: ['aprobada'], tiendas: [26, 30] })._and).toContainEqual({ store_id: { _in: [26, 30] } });
	});
});

describe('agregadoHorasExtras', () => {
	it('agrupa en Directus y convierte los agregados de texto', async () => {
		request.mockResolvedValueOnce([
			{ store_id: 26, work_date: '2026-10-05T00:00:00', period_id: '4', count: { id: '3' }, sum: { minutes: '180' } },
		]);
		const r = await agregadoHorasExtras({ estados: ['aprobada'] }, ['period_id', 'store_id', 'work_date']);
		expect(r).toEqual([{ storeId: 26, empleadoId: null, fecha: '2026-10-05', periodoId: 4, estado: null, registros: 3, minutos: 180 }]);
		expect(request.mock.calls[0][0]).toMatchObject({
			op: 'aggregate',
			c: 'com_over_time',
			o: { aggregate: { count: ['id'], sum: ['minutes'] }, groupBy: ['period_id', 'store_id', 'work_date'] },
		});
	});
});

describe('zonas (jefes de zona)', () => {
	it('nombre de la zona sin el prefijo "Jefe Zona"', () => {
		expect(nombreZona('Jefe Zona Cafetera')).toBe('Cafetera');
		expect(nombreZona('Jefe de zona Sur')).toBe('Sur');
		expect(nombreZona('Ana Pérez')).toBe('Ana Pérez');
	});

	it('zonas = los usuarios de JEFES_ZONA (los 4 de la captura) con sus tiendas, sin la de pruebas', async () => {
		expect(JEFES_ZONA).toHaveLength(4);
		const [cafetera, narino] = JEFES_ZONA;
		request.mockResolvedValueOnce([
			{ store_id: 26, user_id: { id: narino, first_name: 'Jefe Zona', last_name: 'Narino' } },
			{ store_id: { id: 30 }, user_id: { id: narino, first_name: 'Jefe Zona', last_name: 'Narino' } },
			{ store_id: 90, user_id: { id: narino, first_name: 'Jefe Zona', last_name: 'Narino' } },
			// Sin permiso para leer el nombre: "Zona N" según su posición.
			{ store_id: 40, user_id: { id: cafetera } },
		]);
		expect(await listarZonas()).toEqual([
			{ id: narino, nombre: 'Narino', tiendas: [26, 30] },
			{ id: cafetera, nombre: 'Zona 1', tiendas: [40] },
		]);
		const filtro = request.mock.calls[0][0].q.filter._and;
		expect(filtro).toContainEqual({ user_id: { _in: JEFES_ZONA } });
		expect(filtro).toContainEqual({ status: { _eq: 'Activo' } });
	});
});
