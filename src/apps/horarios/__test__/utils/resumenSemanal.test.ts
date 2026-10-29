import dayjs from 'dayjs';
import { describe, expect, it } from 'vitest';
import type { TimeRecordBulkDto } from '@/apps/horarios/interfaces/api/timeRecords';
import {
	diasDeSemana,
	inicioSemana,
	resumenSemanal,
} from '@/apps/horarios/utils/resumenSemanal';

const marca = (
	emp: number,
	fecha: string,
	log_type: string,
	hora: string,
	tienda = 26,
) =>
	({
		id: Math.random(),
		record_date: fecha,
		record_time: hora,
		log_type,
		store_id: tienda,
		employee_id: {
			id: emp,
			first_name: emp === 7 ? 'ana' : 'beto',
			middle_name: null,
			last_name: 'pérez',
			second_last_name: null,
			document_number: '1107837464',
		},
	}) as unknown as TimeRecordBulkDto;

describe('inicioSemana y diasDeSemana', () => {
	it('lleva cualquier día al inicio de su semana según el día de inicio', () => {
		const f = (d: string, ini?: number) =>
			inicioSemana(dayjs(d), ini).format('YYYY-MM-DD');
		expect(f('2026-10-29')).toBe('2026-10-26'); // jueves → lunes
		expect(f('2026-11-01')).toBe('2026-10-26'); // domingo: último día de lunes a domingo
		expect(f('2026-10-29', 3)).toBe('2026-10-28'); // semana de miércoles
		expect(f('2026-10-27', 3)).toBe('2026-10-21'); // martes: aún la semana del miércoles anterior
		expect(f('2026-10-29', 0)).toBe('2026-10-25'); // semana de domingo
	});

	it('cuenta los días como el reporte semanal: mismo día = 7', () => {
		expect(diasDeSemana(1, 0)).toBe(7); // lunes a domingo
		expect(diasDeSemana(1, 5)).toBe(5); // lunes a viernes
		expect(diasDeSemana(3, 2)).toBe(7); // miércoles a martes
		expect(diasDeSemana(6, 1)).toBe(3); // sábado a lunes
		expect(diasDeSemana(4, 4)).toBe(7);
	});
});

describe('resumenSemanal', () => {
	const filas = resumenSemanal(
		[
			// Ana: lunes 8:00–17:00 con 1 h de almuerzo = 8 h; miércoles en otra tienda 9:00–13:00 = 4 h.
			marca(7, '2026-10-26', 'Comenzar Jornada', '08:00'),
			marca(7, '2026-10-26', 'Iniciar Almuerzo', '12:00'),
			marca(7, '2026-10-26', 'Finalizar Almuerzo', '13:00'),
			marca(7, '2026-10-26', 'Terminar Jornada', '17:00'),
			marca(7, '2026-10-28', 'Comenzar Jornada', '09:00', 30),
			marca(7, '2026-10-28', 'Terminar Jornada', '13:00', 30),
			// Beto: jornada sin terminar (cuenta 0) y una marcación de otra semana (fuera).
			marca(8, '2026-10-27', 'Comenzar Jornada', '08:00'),
			marca(8, '2026-11-02', 'Comenzar Jornada', '08:00'),
		],
		'2026-10-26',
	);

	it('suma minutos trabajados por día y en total, restando el almuerzo', () => {
		const ana = filas[0];
		expect(ana).toMatchObject({
			empleadoId: 7,
			empleado: 'Ana Pérez',
			documento: '1 107 837 464',
			trabajados: 12 * 60,
		});
		expect(ana.dias).toEqual([480, 0, 240, 0, 0, 0, 0]);
		expect(ana.tiendas).toEqual([26, 30]);
	});

	it('una semana más corta solo toma sus días', () => {
		const [ana] = resumenSemanal(
			[
				marca(7, '2026-10-26', 'Comenzar Jornada', '08:00'),
				marca(7, '2026-10-26', 'Terminar Jornada', '10:00'),
				marca(7, '2026-10-28', 'Comenzar Jornada', '08:00'),
				marca(7, '2026-10-28', 'Terminar Jornada', '10:00'),
			],
			'2026-10-26',
			2,
		);
		expect(ana.dias).toEqual([120, 0]);
		expect(ana.trabajados).toBe(120);
	});

	it('una jornada sin terminar cuenta 0; ordena por nombre', () => {
		expect(filas.map((f) => f.empleado)).toEqual(['Ana Pérez', 'Beto Pérez']);
		expect(filas[1].trabajados).toBe(0);
	});
});
