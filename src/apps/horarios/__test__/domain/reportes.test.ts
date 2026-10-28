import { describe, expect, it } from 'vitest';
import {
	periodoActual,
	periodosVencidos,
	type RangoPeriodo,
	rangoAnterior,
	reporteZona,
	reporteGerencia,
	resumenPorPeriodo,
	tendenciaPorPeriodo,
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

	it('detalle por tienda: suma lo mismo que el total y ordena por horas', () => {
		const [rAbierto, rLiq] = resumenPorPeriodo(periodos, vinculadas, porPagar, tiendaDe, () => true);
		expect(rLiq.tiendas).toEqual([
			{ storeId: 26, delPeriodo: { registros: 2, minutos: 120 }, rezagadas: { registros: 1, minutos: 30 }, total: { registros: 3, minutos: 150 } },
			{ storeId: 30, delPeriodo: { registros: 1, minutos: 60 }, rezagadas: { registros: 0, minutos: 0 }, total: { registros: 1, minutos: 60 } },
		]);
		expect(rAbierto.tiendas.map((t) => [t.storeId, t.total.minutos])).toEqual([[30, 90], [26, 60]]);
		for (const r of [rAbierto, rLiq])
			expect(r.tiendas.reduce((s, t) => s + t.total.minutos, 0)).toBe(r.total.minutos);
	});

	it('filtra por empresa (tiendas incluidas)', () => {
		const soloA = (id: number | null) => id === 26;
		const [rAbierto, rLiq] = resumenPorPeriodo(periodos, vinculadas, porPagar, tiendaDe, soloA);
		expect(rLiq.total).toEqual({ registros: 3, minutos: 150 });
		expect(rAbierto.total).toEqual({ registros: 1, minutos: 60 });
	});
});

describe('resumenPorPeriodo con filas agregadas', () => {
	it('preliquidado: cada fila suma sus registros', () => {
		const agregadas = [{ work_date: '2026-10-12', status: 'aprobada' as const, period_id: null, minutes: 150, store_id: 26, registros: 3 }];
		const [rAbierto] = resumenPorPeriodo(periodos, [], agregadas, tiendaDe, () => true);
		expect(rAbierto.total).toEqual({ registros: 3, minutos: 150 });
	});
});

describe('reporteGerencia (sin personas)', () => {
	// 20/10/2026 es martes.
	const filas = [
		{ storeId: 26, fecha: '2026-10-20', registros: 2, minutos: 120 },
		{ storeId: 30, fecha: '2026-10-20', registros: 1, minutos: 60 },
		{ storeId: 15, fecha: '2026-10-21', registros: 1, minutos: 60 },
		{ storeId: 99, fecha: '2026-10-21', registros: 1, minutos: 60 }, // sin zona
	];
	const zonas: Record<number, string> = { 26: 'Narino', 30: 'Narino', 15: 'Sur', 40: 'Sur' };
	// La 40 tuvo horas antes y ahora no: cuenta en la variación de su zona.
	const previas = new Map([[26, 60], [40, 120]]);
	const r = reporteGerencia(filas, previas, (id) => zonas[id] ?? null);

	it('total con variación frente al rango anterior', () => {
		expect(r.total).toEqual({ registros: 5, minutos: 300, variacion: (300 - 180) / 180 });
	});

	it('zonas: horas, %, nº de tiendas y variación (incluye lo previo de tiendas sin horas ahora)', () => {
		expect(r.zonas.map((z) => [z.zona, z.minutos, z.tiendas])).toEqual([
			['Narino', 180, 2],
			['Sur', 60, 1],
			[null, 60, 1],
		]);
		expect(r.zonas[0]).toMatchObject({ porcentaje: 180 / 300, variacion: 2 });
		expect(r.zonas[1].variacion).toBe(-0.5);
		expect(r.zonas[2].variacion).toBeNull();
	});

	it('mapa de calor: minutos por día de la semana de cada zona', () => {
		expect(r.zonas.find((z) => z.zona === 'Narino')?.porDiaSemana).toEqual([0, 180, 0, 0, 0, 0, 0]);
		expect(r.zonas.find((z) => z.zona === 'Sur')?.porDiaSemana).toEqual([0, 0, 60, 0, 0, 0, 0]);
	});

	it('tiendas con zona, % y variación; día de la semana', () => {
		expect(r.tiendas[0]).toMatchObject({ storeId: 26, zona: 'Narino', minutos: 120, porcentaje: 0.4, variacion: 1 });
		expect(r.tiendas.find((t) => t.storeId === 30)?.variacion).toBeNull();
		expect(r.porDiaSemana).toEqual([0, 180, 120, 0, 0, 0, 0]);
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

describe('reporteZona (R2 + R4)', () => {
	// 20/10/2026 es martes; 25/10/2026, domingo.
	const filas = [
		{ storeId: 26, empleadoId: 7, fecha: '2026-10-20', registros: 1, minutos: 60 },
		{ storeId: 26, empleadoId: 7, fecha: '2026-10-25', registros: 1, minutos: 120 },
		{ storeId: 26, empleadoId: 8, fecha: '2026-10-20', registros: 1, minutos: 30 },
		{ storeId: 30, empleadoId: 7, fecha: '2026-10-21', registros: 2, minutos: 90 }, // rotación
		{ storeId: 30, empleadoId: 9, fecha: '2026-10-21', registros: 1, minutos: 60 },
	];
	const r = reporteZona(filas, new Map([[26, 10], [30, 5]]));

	it('totales de la zona: horas, registros, personas distintas y por persona de plantilla', () => {
		expect(r.total).toEqual({ registros: 6, minutos: 360, personas: 3, minutosPorPersona: 360 / 15 });
	});

	it('ranking de tiendas con % y por persona de plantilla', () => {
		const [t26, t30] = r.tiendas;
		expect(t26).toMatchObject({ storeId: 26, minutos: 210, registros: 3, minutosPorPersona: 21 });
		expect(t26.porcentaje).toBeCloseTo(210 / 360);
		expect(t30).toMatchObject({ storeId: 30, minutos: 150 });
		expect(t30).not.toHaveProperty('variacion');
	});

	it('detalle: personas por tienda (más horas primero) y sus días ordenados', () => {
		const [ana, beto] = r.tiendas[0].personas;
		expect(ana).toMatchObject({ empleadoId: 7, minutos: 180 });
		expect(ana.dias.map((d) => `${d.fecha}:${d.minutos}`)).toEqual(['2026-10-20:60', '2026-10-25:120']);
		expect(beto).toMatchObject({ empleadoId: 8, minutos: 30 });
	});

	it('día de la semana (lunes primero) y top personas de toda la zona', () => {
		expect(r.porDiaSemana).toEqual([0, 90, 150, 0, 0, 0, 120]);
		expect(r.topPersonas[0]).toEqual({ empleadoId: 7, registros: 4, minutos: 270, tiendas: [26, 30] });
	});

	it('rango anterior de la misma duración', () => {
		expect(rangoAnterior('2026-10-01', '2026-10-31')).toEqual({ desde: '2026-08-31', hasta: '2026-09-30' });
		expect(rangoAnterior('2026-10-20', '2026-10-20')).toEqual({ desde: '2026-10-19', hasta: '2026-10-19' });
	});
});

describe('tendenciaPorPeriodo', () => {
	it('del más antiguo al más reciente, con el reparto por zona', () => {
		const resumen = resumenPorPeriodo(
			periodos,
			[
				{ periodoId: 1, storeId: 26, fecha: '2026-10-05', registros: 1, minutos: 60 },
				{ periodoId: 1, storeId: 15, fecha: '2026-10-06', registros: 1, minutos: 30 },
			],
			[{ work_date: '2026-10-12', status: 'aprobada' as const, minutes: 45, store_id: 26 }],
			tiendaDe,
			() => true,
		);
		const t = tendenciaPorPeriodo(resumen, (id) => (id === 15 ? 'Sur' : 'Narino'));
		expect(t.map((p) => [p.periodo.id, p.minutos])).toEqual([[1, 90], [2, 45]]);
		expect([...t[0].porZona]).toEqual([['Narino', 60], ['Sur', 30]]);
		expect(tendenciaPorPeriodo(resumen, () => null, 1).map((p) => p.periodo.id)).toEqual([2]);
	});
});
