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

import {
	crearHoraExtra,
	filtroHorasExtras,
	revisarHorasExtras,
} from '@/apps/horarios/api/directus/horasExtras';

beforeEach(() => request.mockReset().mockResolvedValue({}));

describe('filtroHorasExtras', () => {
	it('sin filtros solo excluye la tienda de pruebas', () => {
		expect(filtroHorasExtras({})).toEqual({ _and: [{ store_id: { _neq: 90 } }] });
		expect(filtroHorasExtras({ incluirPruebas: true })).toEqual({});
	});

	it('tiendas: la trabajada o la del empleado (rotación)', () => {
		const f = filtroHorasExtras({ tiendas: [1, 2], incluirPruebas: true });
		expect(f).toEqual({
			_and: [
				{ _or: [{ store_id: { _in: [1, 2] } }, { employee_id: { store_id: { _in: [1, 2] } } }] },
			],
		});
	});

	it('combina empleado, rango, estados y periodo', () => {
		const f = filtroHorasExtras({
			empleadoId: 7,
			desde: '2026-10-01',
			hasta: '2026-10-15',
			estados: ['pendiente'],
			periodoId: 3,
			incluirPruebas: true,
		});
		expect(f._and).toEqual([
			{ employee_id: { _eq: 7 } },
			{ work_date: { _gte: '2026-10-01' } },
			{ work_date: { _lte: '2026-10-15' } },
			{ status: { _in: ['pendiente'] } },
			{ period_id: { _eq: 3 } },
		]);
	});
});

describe('crearHoraExtra', () => {
	it('siempre crea en pendiente', async () => {
		await crearHoraExtra({ employee_id: 5, store_id: 26, work_date: '2026-10-19', minutes: 60 });
		expect(request.mock.calls[0][0]).toMatchObject({
			op: 'create',
			c: 'com_over_time',
			d: { employee_id: 5, store_id: 26, minutes: 60, status: 'pendiente' },
		});
	});
});

describe('revisarHorasExtras', () => {
	it('aprobar asigna el periodo y la revisión, sin nota', async () => {
		await revisarHorasExtras([1, 2], { decision: 'aprobada', periodId: 4, revisor: 'u-1' });
		const { op, ids, d } = request.mock.calls[0][0];
		expect(op).toBe('updateMany');
		expect(ids).toEqual([1, 2]);
		expect(d).toMatchObject({ status: 'aprobada', period_id: 4, reviewed_by: 'u-1', review_note: null });
		expect(Number.isNaN(Date.parse(d.reviewed_at))).toBe(false);
	});

	it('rechazar guarda el motivo y no toca el periodo', async () => {
		await revisarHorasExtras([3], { decision: 'descartada_comercial', nota: ' sin soporte ', revisor: 'u-1' });
		const { d } = request.mock.calls[0][0];
		expect(d).toMatchObject({ status: 'descartada_comercial', review_note: 'sin soporte' });
		expect(d).not.toHaveProperty('period_id');
	});

	it('no llama a Directus sin periodo al aprobar ni sin motivo al rechazar', async () => {
		await expect(revisarHorasExtras([1], { decision: 'aprobada', revisor: 'u' })).rejects.toThrow(/periodo/);
		await expect(revisarHorasExtras([1], { decision: 'descartada_comercial', nota: '  ', revisor: 'u' })).rejects.toThrow(/motivo/);
		expect(await revisarHorasExtras([], { decision: 'aprobada', revisor: 'u' })).toEqual([]);
		expect(request).not.toHaveBeenCalled();
	});
});
