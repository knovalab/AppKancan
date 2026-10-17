import { describe, expect, it } from 'vitest';
import { msHastaProxima, rangoFechas, sumarDias } from '../src/fecha.ts';
import {
	calcularDiasTienda,
	type MarcacionDia,
} from '../src/transform/diaTienda.ts';
import { periodoDe } from '../src/transform/periodo.ts';

const m = (
	store: string,
	log_type: string,
	record_time: string,
): MarcacionDia => ({
	store_id: store,
	log_type,
	record_time,
});
const INI = 'Comenzar Jornada';
const FIN = 'Terminar Jornada';
const ALM = 'Iniciar Almuerzo';

describe('calcularDiasTienda', () => {
	it('apertura = primera marcación, cierre = última Terminar Jornada', () => {
		const filas = calcularDiasTienda('2026-10-16', [
			m('90', INI, '10:01:00'),
			m('90', INI, '09:55:30'),
			m('90', ALM, '13:00:00'),
			m('90', FIN, '20:00:00'),
			m('90', FIN, '21:01:00'),
		]);
		expect(filas).toEqual([
			{
				store: '90',
				work_day: '2026-10-16',
				open_time: '2026-10-16T09:55:30',
				close_time: '2026-10-16T21:01:00',
				operative_time: 665,
			},
		]);
	});

	it('sin Terminar Jornada: cierre y tiempo operativo en null', () => {
		const [f] = calcularDiasTienda('2026-10-16', [
			m('5', INI, '08:00'),
			m('5', ALM, '12:00'),
		]);
		expect(f).toMatchObject({
			open_time: '2026-10-16T08:00:00',
			close_time: null,
			operative_time: null,
		});
	});

	it('cruza la medianoche: +24 h y cierre al día siguiente', () => {
		const [f] = calcularDiasTienda('2026-10-16', [
			m('5', INI, '18:00:00'),
			m('5', FIN, '01:30:00'),
		]);
		expect(f).toMatchObject({
			close_time: '2026-10-17T01:30:00',
			operative_time: 450,
		});
	});

	it('omite tiendas cerradas, marcaciones sin tienda u hora inválida, y separa tiendas', () => {
		const filas = calcularDiasTienda(
			'2026-10-16',
			[
				m('10', INI, '08:00'),
				m('10', FIN, '17:00'),
				m('2', INI, '09:00'),
				m('7', INI, '09:00'),
				{ store_id: null, log_type: INI, record_time: '07:00' },
				m('2', FIN, 'xx'),
				{ store_id: { id: '2' }, log_type: FIN, record_time: '18:00:00' },
			],
			new Set(['7']),
		);
		expect(filas.map((f) => [f.store, f.operative_time])).toEqual([
			['2', 540],
			['10', 540],
		]);
	});

	it('una tienda con solo salidas no genera fila', () => {
		expect(calcularDiasTienda('2026-10-16', [m('5', FIN, '17:00')])).toEqual(
			[],
		);
	});

	it('sin marcaciones no genera filas', () => {
		expect(calcularDiasTienda('2026-10-16', [])).toEqual([]);
	});
});

describe('periodoDe (quincenas)', () => {
	it.each([
		['2026-10-01', '2026-10-01', '2026-10-15'],
		['2026-10-15', '2026-10-01', '2026-10-15'],
		['2026-10-16', '2026-10-16', '2026-10-31'],
		['2026-11-30', '2026-11-16', '2026-11-30'],
		['2026-02-20', '2026-02-16', '2026-02-28'],
		['2028-02-29', '2028-02-16', '2028-02-29'],
		['2026-12-31', '2026-12-16', '2026-12-31'],
	])('%s → %s / %s', (fecha, start_date, end_date) => {
		expect(periodoDe(fecha)).toEqual({ start_date, end_date });
	});
});

describe('fecha', () => {
	it('sumarDias y rangoFechas cruzan meses y años', () => {
		expect(sumarDias('2026-12-31', 1)).toBe('2027-01-01');
		expect(rangoFechas('2026-02-27', '2026-03-01')).toEqual([
			'2026-02-27',
			'2026-02-28',
			'2026-03-01',
		]);
	});

	it('msHastaProxima calcula en hora de Bogotá (UTC−5)', () => {
		// 01:00 Bogotá = 06:00 UTC → faltan 60 min para las 02:00
		expect(msHastaProxima(2, new Date('2026-10-17T06:00:00Z'))).toBe(3_600_000);
		// 03:00 Bogotá → la próxima es mañana: 23 h
		expect(msHastaProxima(2, new Date('2026-10-17T08:00:00Z'))).toBe(
			23 * 3_600_000,
		);
	});
});
