import { describe, expect, it } from 'vitest';
import { diasDelRango, lineasDeCeldas, validarLineas, validarRangoGrilla } from '@/apps/horarios/domain/horasExtras';

describe('diasDelRango', () => {
	it('incluye ambos extremos y cruza meses', () => {
		expect(diasDelRango('2026-10-30', '2026-11-02')).toEqual(['2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02']);
		expect(diasDelRango('2026-10-20', '2026-10-20')).toEqual(['2026-10-20']);
	});

	it('vacío si el rango es inválido o al revés', () => {
		expect(diasDelRango('2026-10-21', '2026-10-20')).toEqual([]);
		expect(diasDelRango('', '2026-10-20')).toEqual([]);
	});
});

describe('validarRangoGrilla', () => {
	const hoy = '2026-10-22';
	it('acepta hasta 5 días no futuros', () => {
		expect(validarRangoGrilla('2026-10-18', '2026-10-22', hoy)).toBeNull();
		expect(validarRangoGrilla('2026-10-22', '2026-10-22', hoy)).toBeNull();
	});
	it('rechaza más de 5 días, al revés, futuro o vacío', () => {
		expect(validarRangoGrilla('2026-10-17', '2026-10-22', hoy)).toMatch(/máximo 5/);
		expect(validarRangoGrilla('2026-10-21', '2026-10-20', hoy)).toMatch(/anterior/);
		expect(validarRangoGrilla('2026-10-22', '2026-10-23', hoy)).toMatch(/futuros/);
		expect(validarRangoGrilla('', '2026-10-22', hoy)).toMatch(/rango/);
	});
});

describe('lineasDeCeldas', () => {
	it('solo celdas con valor, del rango y de las personas indicadas, por persona y día', () => {
		const celdas = new Map([
			['7|2026-10-20', 60],
			['7|2026-10-21', 0],
			['8|2026-10-21', 90],
			['8|2026-10-15', 60], // fuera del rango
			['9|2026-10-20', 60], // persona no incluida
		]);
		const l = lineasDeCeldas(celdas, ['2026-10-20', '2026-10-21'], ['7', '8']);
		expect(l.map((x) => `${x.clave}:${x.minutos}`)).toEqual(['7|2026-10-20:60', '8|2026-10-21:90']);
	});
});

describe('validarLineas', () => {
	const hoy = '2026-10-20';
	const linea = (clave: string, empleadoId: string, fecha: string, minutos = 60) => ({ clave, empleadoId, fecha, minutos });

	it('válidas: sin errores', () => {
		expect(validarLineas([linea('a', '7', '2026-10-19'), linea('b', '8', '2026-10-19', 30)], hoy).size).toBe(0);
	});

	it('marca fecha futura, horas fuera de bloque y la misma persona + día repetida', () => {
		const e = validarLineas(
			[
				linea('a', '7', '2026-10-21'),
				linea('b', '8', '2026-10-19', 45),
				linea('c', '9', '2026-10-18'),
				linea('d', '9', '2026-10-18'), // editada a la misma fecha que c
			],
			hoy,
		);
		expect(e.get('a')).toEqual({ campo: 'fecha', mensaje: expect.stringMatching(/futuros/) });
		expect(e.get('b')).toEqual({ campo: 'minutos', mensaje: expect.stringMatching(/media hora/) });
		expect(e.get('c')?.mensaje).toMatch(/Repetida/);
		expect(e.get('d')?.mensaje).toMatch(/Repetida/);
	});
});
