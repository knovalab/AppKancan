import dayjs, { type Dayjs } from 'dayjs';
import { idRelacion } from '../api/directus/relacion';
import type { TimeRecordBulkDto } from '../interfaces/api/timeRecords';
import { formatDocumentNumber, formatNombrePropio } from './format';
import { calcularMinutosDia } from './horasTrabajadas';

/** Primer día de la semana que contiene `fecha`, si la semana empieza en `diaInicio` (0 = domingo). */
export const inicioSemana = (fecha: Dayjs, diaInicio = 1): Dayjs =>
	fecha.subtract((fecha.day() - diaInicio + 7) % 7, 'day').startOf('day');

/** Días de una semana de `diaInicio` a `diaFin`; el mismo día en ambos = 7 (como el reporte semanal). */
export const diasDeSemana = (diaInicio: number, diaFin: number): number =>
	diaInicio === diaFin ? 7 : ((diaFin - diaInicio + 7) % 7) + 1;

export interface FilaSemana {
	empleadoId: number;
	empleado: string;
	documento: string;
	/** Tiendas donde marcó esa semana. */
	tiendas: number[];
	/** Minutos trabajados por día, desde el inicio de la semana. */
	dias: number[];
	trabajados: number;
}

/**
 * Horas trabajadas por persona y día de los `totalDias` desde `inicio` (marcaciones de
 * inicio/fin menos almuerzo, igual que el reporte semanal). Un día sin fin de jornada cuenta 0.
 */
export function resumenSemanal(
	marcaciones: readonly TimeRecordBulkDto[],
	inicio: string,
	totalDias = 7,
): FilaSemana[] {
	const fechas = Array.from({ length: totalDias }, (_, i) =>
		dayjs(inicio).add(i, 'day').format('YYYY-MM-DD'),
	);
	const filas = new Map<number, FilaSemana>();
	const fila = (id: number, empleado: string, documento: string) => {
		const f = filas.get(id) ?? {
			empleadoId: id,
			empleado,
			documento,
			tiendas: [],
			dias: fechas.map(() => 0),
			trabajados: 0,
		};
		filas.set(id, f);
		return f;
	};
	const conTienda = (f: FilaSemana, tienda: number | null) => {
		if (tienda != null && !f.tiendas.includes(tienda)) f.tiendas.push(tienda);
	};

	const porDia = new Map<string, TimeRecordBulkDto[]>();
	for (const r of marcaciones) {
		const id = idRelacion(r.employee_id);
		const dia = fechas.indexOf(r.record_date);
		if (id == null || dia < 0) continue;
		const e = r.employee_id;
		const nombre = formatNombrePropio(
			[e?.first_name, e?.middle_name, e?.last_name, e?.second_last_name]
				.filter((n) => n && String(n).trim())
				.join(' '),
		);
		const f = fila(
			id,
			nombre || `Empleado ${id}`,
			formatDocumentNumber(e?.document_number),
		);
		conTienda(f, idRelacion(r.store_id));
		const clave = `${id}|${dia}`;
		porDia.set(clave, [...(porDia.get(clave) ?? []), r]);
	}
	for (const [clave, registros] of porDia) {
		const [id, dia] = clave.split('|').map(Number);
		const f = filas.get(id);
		if (!f) continue;
		const minutos = calcularMinutosDia(registros, id);
		f.dias[dia] += minutos;
		f.trabajados += minutos;
	}

	return [...filas.values()].sort((a, b) =>
		a.empleado.localeCompare(b.empleado, 'es'),
	);
}
