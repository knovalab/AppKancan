import { beforeEach, describe, expect, it, vi } from 'vitest';

const request = vi.fn();
vi.mock('@/services/directus/directus', () => ({ default: { request: (q: unknown) => request(q) } }));
vi.mock('@/auth/services/directusInterceptor', () => ({ withAutoRefresh: (fn: () => unknown) => fn() }));
vi.mock('@directus/sdk', () => ({
	createItems: (c: string, d: unknown[]) => ({ op: 'createMany', c, d }),
	readItems: (c: string, q: unknown) => ({ op: 'read', c, q }),
	updateItem: (c: string, id: number, d: unknown) => ({ op: 'update', c, id, d }),
	updateItems: (c: string, ids: number[], d: unknown) => ({ op: 'updateMany', c, ids, d }),
}));

import {
	crearHorasExtras,
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

	it('combina empleado, rango y estados', () => {
		const f = filtroHorasExtras({
			empleadoId: 7,
			desde: '2026-10-01',
			hasta: '2026-10-15',
			estados: ['pendiente'],
			incluirPruebas: true,
		});
		expect(f._and).toEqual([
			{ employee_id: { _eq: 7 } },
			{ work_date: { _gte: '2026-10-01' } },
			{ work_date: { _lte: '2026-10-15' } },
			{ status: { _in: ['pendiente'] } },
		]);
	});
});

describe('crearHorasExtras', () => {
	const base = { store_id: 26, work_date: '2026-10-19', minutes: 60, created_by: 'uuid-lider' };

	it('siempre crea en pendiente', async () => {
		await crearHorasExtras([{ ...base, employee_id: 5 }]);
		expect(request.mock.calls[0][0]).toMatchObject({
			op: 'createMany',
			c: 'com_over_time',
			d: [{ employee_id: 5, store_id: 26, minutes: 60, status: 'pendiente' }],
		});
	});

	it('varios empleados en una sola petición, con el uuid de quien crea', async () => {
		await crearHorasExtras([
			{ ...base, employee_id: 5 },
			{ ...base, employee_id: 6, observations: 'Inventario' },
		]);
		expect(request).toHaveBeenCalledTimes(1);
		const { d } = request.mock.calls[0][0];
		expect(d.map((x: { employee_id: number }) => x.employee_id)).toEqual([5, 6]);
		expect(d.every((x: { created_by: string }) => x.created_by === 'uuid-lider')).toBe(true);
	});

	it('no llama a Directus sin autor ni con la lista vacía', async () => {
		await expect(crearHorasExtras([{ ...base, employee_id: 5, created_by: ' ' }])).rejects.toThrow(/usuario/);
		expect(await crearHorasExtras([])).toEqual([]);
		expect(request).not.toHaveBeenCalled();
	});
});

describe('revisarHorasExtras', () => {
	it('aprobar guarda la revisión, sin nota', async () => {
		await revisarHorasExtras([1, 2], { decision: 'aprobada' });
		const { op, ids, d } = request.mock.calls[0][0];
		expect(op).toBe('updateMany');
		expect(ids).toEqual([1, 2]);
		expect(d).toMatchObject({ status: 'aprobada', review_note: null });
		// Quién revisó lo pone Directus en updated_by.
		expect(d).not.toHaveProperty('reviewed_by');
		expect(d).not.toHaveProperty('period_id');
		expect(Number.isNaN(Date.parse(d.reviewed_at))).toBe(false);
	});

	it('rechazar guarda el motivo', async () => {
		await revisarHorasExtras([3], { decision: 'descartada_comercial', nota: ' sin soporte ' });
		const { d } = request.mock.calls[0][0];
		expect(d).toMatchObject({ status: 'descartada_comercial', review_note: 'sin soporte' });
	});

	it('no llama a Directus sin motivo al rechazar ni con lote vacío', async () => {
		await expect(revisarHorasExtras([1], { decision: 'descartada_comercial', nota: '  ' })).rejects.toThrow(/motivo/);
		expect(await revisarHorasExtras([], { decision: 'aprobada' })).toEqual([]);
		expect(request).not.toHaveBeenCalled();
	});
});
