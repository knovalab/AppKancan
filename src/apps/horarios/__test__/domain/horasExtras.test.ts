import { describe, expect, it } from 'vitest';
import {
	buscarDuplicado,
	ESTADO_HORA_EXTRA as E,
	esEstadoFinal,
	esEstadoHoraExtra,
	formatoMinutos,
	puedeTransicionar,
	validarHoraExtra,
} from '@/apps/horarios/domain/horasExtras';

const ctx = { hoy: '2026-10-20', empleadoActivo: true, empleadoDelLider: true };
const valida = { workDate: '2026-10-19', minutos: 90 };

describe('validarHoraExtra', () => {
	it('acepta un día pasado o de hoy en bloques de 30 min', () => {
		expect(validarHoraExtra(valida, ctx)).toEqual({});
		expect(validarHoraExtra({ ...valida, workDate: '2026-10-20' }, ctx)).toEqual({});
	});

	it('rechaza fechas futuras o vacías', () => {
		expect(validarHoraExtra({ ...valida, workDate: '2026-10-21' }, ctx).workDate).toMatch(/futuros/);
		expect(validarHoraExtra({ ...valida, workDate: '' }, ctx).workDate).toBeDefined();
	});

	it('exige minutos > 0 y múltiplos de 30', () => {
		expect(validarHoraExtra({ ...valida, minutos: 0 }, ctx).minutos).toMatch(/mayores/);
		expect(validarHoraExtra({ ...valida, minutos: -30 }, ctx).minutos).toMatch(/mayores/);
		expect(validarHoraExtra({ ...valida, minutos: 45 }, ctx).minutos).toMatch(/media hora/);
		expect(validarHoraExtra({ ...valida, minutos: 30.5 }, ctx).minutos).toBeDefined();
	});

	it('exige empleado activo y de las tiendas del líder', () => {
		expect(validarHoraExtra(valida, { ...ctx, empleadoActivo: false }).empleado).toMatch(/activo/);
		expect(validarHoraExtra(valida, { ...ctx, empleadoDelLider: false }).empleado).toMatch(/tiendas/);
	});

	it('limita la observación a 300 caracteres', () => {
		expect(validarHoraExtra({ ...valida, observacion: 'x'.repeat(301) }, ctx).observacion).toBeDefined();
	});
});

describe('transiciones', () => {
	it('el líder crea en pendiente y gestiona sugeridas', () => {
		expect(puedeTransicionar('lider', null, E.pendiente)).toBe(true);
		expect(puedeTransicionar('lider', E.sugerida, E.pendiente)).toBe(true);
		expect(puedeTransicionar('lider', E.sugerida, E.descartadaLider)).toBe(true);
		expect(puedeTransicionar('lider', E.pendiente, E.pendiente)).toBe(true);
	});

	it('el líder no retira pendientes ni aprueba (P6)', () => {
		expect(puedeTransicionar('lider', E.pendiente, E.descartadaLider)).toBe(false);
		expect(puedeTransicionar('lider', E.pendiente, E.aprobada)).toBe(false);
	});

	it('el comercial solo decide sobre pendientes', () => {
		expect(puedeTransicionar('comercial', E.pendiente, E.aprobada)).toBe(true);
		expect(puedeTransicionar('comercial', E.pendiente, E.descartadaComercial)).toBe(true);
		expect(puedeTransicionar('comercial', E.sugerida, E.aprobada)).toBe(false);
		expect(puedeTransicionar('comercial', null, E.pendiente)).toBe(false);
	});

	it('los estados finales no tienen salida', () => {
		for (const final of [E.aprobada, E.descartadaComercial, E.descartadaLider]) {
			expect(esEstadoFinal(final)).toBe(true);
			for (const a of Object.values(E)) {
				expect(puedeTransicionar('lider', final, a)).toBe(false);
				expect(puedeTransicionar('comercial', final, a)).toBe(false);
			}
		}
	});

	it('reconoce solo los valores del catálogo', () => {
		expect(esEstadoHoraExtra('pendiente')).toBe(true);
		expect(esEstadoHoraExtra('Req')).toBe(false);
	});
});

describe('buscarDuplicado y formatoMinutos', () => {
	it('solo cuentan las activas y no la propia fila', () => {
		const filas = [
			{ id: 1, status: E.descartadaComercial },
			{ id: 2, status: E.pendiente },
		];
		expect(buscarDuplicado(filas)?.id).toBe(2);
		expect(buscarDuplicado(filas, 2)).toBeUndefined();
	});

	it('formatea minutos', () => {
		expect(formatoMinutos(30)).toBe('30 min');
		expect(formatoMinutos(120)).toBe('2 h');
		expect(formatoMinutos(90)).toBe('1 h 30 min');
	});
});
