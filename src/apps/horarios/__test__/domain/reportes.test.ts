import { describe, expect, it } from 'vitest';
import {
	periodoActual,
	periodosVencidos,
	type RangoPeriodo,
	resumenPorPeriodo,
} from '@/apps/horarios/domain/horasExtras';

const p = (id: number, start_date: string, end_date: string, status: RangoPeriodo['status']): RangoPeriodo => ({
	id,
	start_date,
	end_date,
	status,
});
const liquidado = p(1, '2026-10-01', '2026-10-10', 'liquidado');
const abierto = p(2, '2026-10-11', '2026-10-25', 'preliquidado');
const periodos = [abierto, liquidado];
const tiendaDe = (h: { store_id: unknown }) => Number(h.store_id);

describe('resumenPorPeriodo', () => {
	const vinculadas = [
		{ periodoId: 1, storeId: 26, fecha: '2026-10-05', registros: 2, minutos: 120 },
		{ periodoId: 1, storeId: 30, fecha: '2026-10-06', registros: 1, minutos: 60 },
		{ periodoId: 1, storeId: 26, fecha: '2026-09-28', registros: 1, minutos: 30 }, // rezagada pagada
	];
	const porPagar = [
		{ work_date: '2026-10-12', status: 'aprobada' as const, minutes: 60, store_id: 26 },
		{ work_date: '2026-10-08', status: 'aprobada' as const, minutes: 90, store_id: 30 }, // rezagada por pagar
		{ work_date: '2026-10-13', status: 'pendiente' as const, minutes: 60, store_id: 26 }, // no cuenta
	];

	it('liquidado: vinculadas; preliquidado: lo que se vincularía; rezagadas aparte; solo aprobadas', () => {
		const r = resumenPorPeriodo(periodos, vinculadas, porPagar, tiendaDe, () => true);
		const [rAbierto, rLiq] = r;
		expect(rLiq.delPeriodo).toEqual({ registros: 3, minutos: 180 });
		expect(rLiq.rezagadas).toEqual({ registros: 1, minutos: 30 });
		expect(rLiq.total).toEqual({ registros: 4, minutos: 210 });
		expect(rAbierto.delPeriodo).toEqual({ registros: 1, minutos: 60 });
		expect(rAbierto.rezagadas).toEqual({ registros: 1, minutos: 90 });
	});

	it('filtra por empresa (tiendas incluidas)', () => {
		const soloA = (id: number | null) => id === 26;
		const [rAbierto, rLiq] = resumenPorPeriodo(periodos, vinculadas, porPagar, tiendaDe, soloA);
		expect(rLiq.total).toEqual({ registros: 3, minutos: 150 });
		expect(rAbierto.total).toEqual({ registros: 1, minutos: 60 });
	});
});

describe('periodoActual y periodosVencidos', () => {
	it('el que contiene hoy; si no, el más reciente', () => {
		expect(periodoActual(periodos, '2026-10-20')?.id).toBe(2);
		expect(periodoActual(periodos, '2026-12-01')?.id).toBe(2);
		expect(periodoActual([], '2026-10-20')).toBeUndefined();
	});
	it('vencidos: preliquidados cuyo fin ya pasó', () => {
		expect(periodosVencidos(periodos, '2026-10-20')).toEqual([]);
		expect(periodosVencidos(periodos, '2026-10-26').map((x) => x.id)).toEqual([2]);
	});
});
