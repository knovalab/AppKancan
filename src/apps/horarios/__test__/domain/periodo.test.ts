import { describe, expect, it } from 'vitest';
import {
	clasificarParaPeriodo,
	duracionDias,
	finPorDias,
	preliquidadoMasAntiguo,
	type RangoPeriodo,
	resumenPorEmpleado,
	siguienteInicio,
	validarPeriodo,
} from '@/apps/horarios/domain/horasExtras';

const p = (id: number, start_date: string, end_date: string, status: RangoPeriodo['status'] = 'preliquidado'): RangoPeriodo => ({
	id,
	start_date,
	end_date,
	status,
});

describe('fechas del periodo', () => {
	it('fin por días rápidos, con cambio de mes, febrero y bisiesto', () => {
		expect(finPorDias('2026-10-01', 15)).toBe('2026-10-15');
		expect(finPorDias('2026-10-25', 10)).toBe('2026-11-03');
		expect(finPorDias('2026-02-25', 5)).toBe('2026-03-01');
		expect(finPorDias('2028-02-25', 5)).toBe('2028-02-29');
		expect(finPorDias('2026-12-30', 5)).toBe('2027-01-03');
		expect(duracionDias('2026-10-25', '2026-11-03')).toBe(10);
	});

	it('siguiente inicio: día siguiente al último fin, o libre si no hay periodos', () => {
		expect(siguienteInicio([])).toBeNull();
		expect(siguienteInicio([p(1, '2026-10-01', '2026-10-10'), p(2, '2026-10-11', '2026-10-31')])).toBe('2026-11-01');
	});
});

describe('validarPeriodo', () => {
	const existentes = [p(1, '2026-10-01', '2026-10-10')];

	it('el primero tiene inicio libre; los siguientes, sin huecos ni cruces', () => {
		expect(validarPeriodo({ inicio: '2026-05-03', fin: '2026-05-03' }, [])).toEqual({});
		expect(validarPeriodo({ inicio: '2026-10-11', fin: '2026-10-25' }, existentes)).toEqual({});
		expect(validarPeriodo({ inicio: '2026-10-12', fin: '2026-10-25' }, existentes).inicio).toMatch(/2026-10-11/);
		expect(validarPeriodo({ inicio: '2026-10-10', fin: '2026-10-25' }, existentes).inicio).toBeDefined();
	});

	it('fin obligatorio y no anterior al inicio', () => {
		expect(validarPeriodo({ inicio: '2026-10-11', fin: '' }, existentes).fin).toMatch(/obligatoria/);
		expect(validarPeriodo({ inicio: '2026-10-11', fin: '2026-10-10' }, existentes).fin).toMatch(/anterior/);
	});
});

describe('clasificarParaPeriodo', () => {
	const antiguo = p(1, '2026-10-01', '2026-10-10');
	const nuevo = p(2, '2026-10-11', '2026-10-20');
	const liquidado = p(0, '2026-09-21', '2026-09-30', 'liquidado');
	const todos = [liquidado, antiguo, nuevo];
	const h = (id: number, work_date: string, status = 'aprobada' as const, period_id: number | null = null) => ({
		id,
		work_date,
		status,
		period_id,
	});
	const horas = [
		h(1, '2026-09-25'), // rezagada
		h(2, '2026-10-01'), // borde inicio
		h(3, '2026-10-10'), // borde fin
		h(4, '2026-10-15'), // del periodo nuevo
		h(5, '2026-10-05', 'pendiente' as never),
		h(6, '2026-10-06', 'aprobada', 0), // ya vinculada
	];

	it('solo aprobadas sin periodo; bordes incluidos; rezagadas antes del inicio', () => {
		const r = clasificarParaPeriodo(horas, antiguo, todos);
		expect(r.delPeriodo.map((x) => x.id)).toEqual([2, 3]);
		expect(r.rezagadas.map((x) => x.id)).toEqual([1]);
	});

	it('las rezagadas solo salen en el preliquidado más antiguo', () => {
		expect(preliquidadoMasAntiguo(todos)?.id).toBe(1);
		const r = clasificarParaPeriodo(horas, nuevo, todos);
		expect(r.delPeriodo.map((x) => x.id)).toEqual([4]);
		expect(r.rezagadas).toEqual([]);
	});

	it('un liquidado no tiene horas por vincular', () => {
		expect(clasificarParaPeriodo(horas, liquidado, todos)).toEqual({ delPeriodo: [], rezagadas: [] });
	});
});

describe('resumenPorEmpleado', () => {
	it('suma minutos por empleado, sin repetir tiendas, ordenado por nombre', () => {
		const r = resumenPorEmpleado([
			{ empleadoId: 2, empleado: 'Zoe', documento: '2', tienda: 'A', minutos: 60 },
			{ empleadoId: 1, empleado: 'Ana', documento: '1', tienda: 'A', minutos: 30 },
			{ empleadoId: 2, empleado: 'Zoe', documento: '2', tienda: 'B', minutos: 90 },
			{ empleadoId: 2, empleado: 'Zoe', documento: '2', tienda: 'A', minutos: 30 },
		]);
		expect(r).toEqual([
			{ empleadoId: 1, empleado: 'Ana', documento: '1', tiendas: ['A'], horasExtras: 1, minutos: 30 },
			{ empleadoId: 2, empleado: 'Zoe', documento: '2', tiendas: ['A', 'B'], horasExtras: 3, minutos: 180 },
		]);
	});
});
