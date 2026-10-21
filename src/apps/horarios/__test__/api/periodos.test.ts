import { beforeEach, describe, expect, it, vi } from 'vitest';

const request = vi.fn();
vi.mock('@/services/directus/directus', () => ({ default: { request: (q: unknown) => request(q) } }));
vi.mock('@/auth/services/directusInterceptor', () => ({ withAutoRefresh: (fn: () => unknown) => fn() }));
vi.mock('@directus/sdk', () => ({
	createItem: (c: string, d: unknown) => ({ op: 'create', c, d }),
	readItems: (c: string, q: unknown) => ({ op: 'read', c, q }),
	updateItem: (c: string, id: number, d: unknown) => ({ op: 'update', c, id, d }),
	updateItems: (c: string, ids: number[], d: unknown) => ({ op: 'updateMany', c, ids, d }),
}));

import { filtroHorasExtras } from '@/apps/horarios/api/directus/horasExtras';
import { crearPeriodo, liquidarPeriodo } from '@/apps/horarios/api/directus/periodos';
import { filtrosDePeriodo } from '@/apps/horarios/hooks/usePeriodos';

beforeEach(() => request.mockReset().mockResolvedValue({}));

describe('crearPeriodo', () => {
	it('relee los periodos y crea en preliquidado si es consecutivo', async () => {
		request.mockResolvedValueOnce([{ id: 1, start_date: '2026-10-01', end_date: '2026-10-10', status: 'liquidado' }]);
		await crearPeriodo({ start_date: '2026-10-11', end_date: '2026-10-20' });
		expect(request.mock.calls[0][0]).toMatchObject({ op: 'read', c: 'com_period' });
		expect(request.mock.calls[1][0]).toEqual({
			op: 'create',
			c: 'com_period',
			d: { start_date: '2026-10-11', end_date: '2026-10-20', status: 'preliquidado' },
		});
	});

	it('no crea si deja un hueco', async () => {
		request.mockResolvedValueOnce([{ id: 1, start_date: '2026-10-01', end_date: '2026-10-10', status: 'liquidado' }]);
		await expect(crearPeriodo({ start_date: '2026-10-15', end_date: '2026-10-20' })).rejects.toThrow(/2026-10-11/);
		expect(request).toHaveBeenCalledTimes(1);
	});
});

describe('liquidarPeriodo', () => {
	it('vincula en una petición y luego cierra con fecha y hora', async () => {
		await liquidarPeriodo(4, [1, 2, 3]);
		expect(request.mock.calls[0][0]).toEqual({ op: 'updateMany', c: 'com_over_time', ids: [1, 2, 3], d: { period_id: 4 } });
		const { op, c, id, d } = request.mock.calls[1][0];
		expect({ op, c, id, status: d.status }).toEqual({ op: 'update', c: 'com_period', id: 4, status: 'liquidado' });
		expect(Number.isNaN(Date.parse(d.liquidacion_at))).toBe(false);
	});

	it('sin horas solo cierra el periodo', async () => {
		await liquidarPeriodo(4, []);
		expect(request).toHaveBeenCalledTimes(1);
		expect(request.mock.calls[0][0]).toMatchObject({ op: 'update', c: 'com_period' });
	});
});

describe('filtros de periodo', () => {
	it('filtroHorasExtras: vinculadas a un periodo o sin periodo', () => {
		expect(filtroHorasExtras({ periodo: 4, incluirPruebas: true })).toEqual({ _and: [{ period_id: { _eq: 4 } }] });
		expect(filtroHorasExtras({ sinPeriodo: true, incluirPruebas: true })).toEqual({ _and: [{ period_id: { _null: true } }] });
	});

	it('filtrosDePeriodo: el más antiguo pide también lo anterior (rezagadas)', () => {
		const antiguo = { id: 1, start_date: '2026-10-01', end_date: '2026-10-10', status: 'preliquidado' as const };
		const nuevo = { id: 2, start_date: '2026-10-11', end_date: '2026-10-20', status: 'preliquidado' as const };
		const todos = [antiguo, nuevo];
		expect(filtrosDePeriodo(antiguo, todos)).toEqual({ estados: ['aprobada'], sinPeriodo: true, desde: undefined, hasta: '2026-10-10' });
		expect(filtrosDePeriodo(nuevo, todos)).toMatchObject({ desde: '2026-10-11', hasta: '2026-10-20' });
		expect(filtrosDePeriodo({ ...antiguo, status: 'liquidado' }, todos)).toEqual({ periodo: 1 });
	});
});
