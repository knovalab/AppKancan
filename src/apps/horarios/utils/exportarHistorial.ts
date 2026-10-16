import dayjs from 'dayjs';
import type { TimeRecord } from '../api/directus/read';
import { LOG_TYPE } from '../domain/registro';
import type { Tienda } from '../interfaces/horarios.interface';

const EVENTOS = [
	{ tipo: LOG_TYPE.inicioJornada, etiqueta: 'Inicio turno' },
	{ tipo: LOG_TYPE.inicioAlmuerzo, etiqueta: 'Inicio almuerzo' },
	{ tipo: LOG_TYPE.finAlmuerzo, etiqueta: 'Fin almuerzo' },
	{ tipo: LOG_TYPE.finJornada, etiqueta: 'Fin turno' },
] as const;

const DELIM = ';';

const hhmm = (hora: string | null | undefined): string =>
	hora ? String(hora).slice(0, 5) : '';

const nombreEmpleado = (emp: TimeRecord['employee_id']): string =>
	emp
		? [emp.first_name, emp.middle_name, emp.last_name, emp.second_last_name]
				.filter((n) => n && String(n).trim())
				.join(' ')
		: 'Sin nombre';

const calcularHorasLaboradas = (
	inicioTurno: string | null,
	finTurno: string | null,
	inicioAlmuerzo: string | null,
	finAlmuerzo: string | null,
): string => {
	if (!inicioTurno || !finTurno) return '--';
	const base = '2000-01-01';
	let minutos = dayjs(`${base} ${finTurno}`).diff(
		dayjs(`${base} ${inicioTurno}`),
		'minute',
	);
	if (inicioAlmuerzo && finAlmuerzo) {
		let almuerzoMinutos = dayjs(`${base} ${finAlmuerzo}`).diff(
			dayjs(`${base} ${inicioAlmuerzo}`),
			'minute',
		);
		if (almuerzoMinutos <= 1) {
			almuerzoMinutos = 0;
		}
		if (almuerzoMinutos > 0) {
			minutos -= almuerzoMinutos;
		}
	}
	if (minutos <= 0) return '--';
	const hours = Math.floor(minutos / 60);
	const mins = minutos % 60;
	const hh = String(hours).padStart(2, '0');
	const mm = String(mins).padStart(2, '0');
	return `${hh}:${mm}`;
};

const calcularDuracionAlmuerzo = (
	inicioAlmuerzo: string | null,
	finAlmuerzo: string | null,
): string => {
	if (!inicioAlmuerzo || !finAlmuerzo) return '--';
	const base = '2000-01-01';
	let minutos = dayjs(`${base} ${finAlmuerzo}`).diff(
		dayjs(`${base} ${inicioAlmuerzo}`),
		'minute',
	);
	if (minutos <= 1) {
		minutos = 0;
	}
	if (minutos < 0) return '--';
	return `${minutos} min`;
};

interface FilaExport {
	tienda: string;
	cc: string;
	empleado: string;
	fecha: string;
	inicioTurno: string;
	inicioAlmuerzo: string;
	finAlmuerzo: string;
	finTurno: string;
	horasLaboradas: string;
	duracionAlmuerzo: string;
	motivo: string;
	observacion: string;
	horaInicial: string;
}

const agruparParaExport = (
	records: TimeRecord[],
	storesMap: Map<number, string>,
	reasonsMap: Map<number, string>,
): FilaExport[] => {
	const grupos: Record<string, TimeRecord[]> = {};

	records.forEach((r) => {
		const cc = r.employee_id?.document_number ?? nombreEmpleado(r.employee_id);
		const sId =
			r.store_id && typeof r.store_id === 'object' ? r.store_id.id : r.store_id;
		const clave = `${sId}|${cc}|${r.record_date}`;
		if (!grupos[clave]) grupos[clave] = [];
		grupos[clave].push(r);
	});

	const filas = Object.values(grupos).map((regs) => {
		const porTipo = (tipo: string) =>
			regs.find((r) => r.log_type === tipo) || null;

		const inicioTurno = porTipo(LOG_TYPE.inicioJornada)?.record_time ?? null;
		const inicioAlmuerzo =
			porTipo(LOG_TYPE.inicioAlmuerzo)?.record_time ?? null;
		const finAlmuerzo = porTipo(LOG_TYPE.finAlmuerzo)?.record_time ?? null;
		const finTurno = porTipo(LOG_TYPE.finJornada)?.record_time ?? null;
		const lineasMotivo: string[] = [];
		const lineasObs: string[] = [];
		const lineasHoraInicial: string[] = [];
		EVENTOS.forEach(({ tipo, etiqueta }) => {
			const reg = porTipo(tipo);
			if (!reg) return;
			const motivo = reasonsMap.get(Number(reg.id));
			if (motivo) lineasMotivo.push(`${etiqueta} — ${motivo}`);
			if (reg.observations?.trim()) {
				lineasObs.push(`${etiqueta} — ${reg.observations.trim()}`);
			}
			if (reg.original_record_time) {
				lineasHoraInicial.push(
					`${etiqueta} — ${hhmm(reg.original_record_time)}`,
				);
			}
		});

		const storeId = regs[0].store_id;
		const storeIdNum =
			storeId && typeof storeId === 'object'
				? Number(storeId.id)
				: Number(storeId);
		return {
			tienda:
				(storeId && typeof storeId === 'object' ? storeId.name : null) ||
				storesMap.get(storeIdNum) ||
				String(storeId ?? ''),
			cc: String(regs[0].employee_id?.document_number ?? ''),
			empleado: nombreEmpleado(regs[0].employee_id),
			fecha: regs[0].record_date
				? dayjs(regs[0].record_date).format('DD-MM-YYYY')
				: '',
			inicioTurno: hhmm(inicioTurno),
			inicioAlmuerzo: hhmm(inicioAlmuerzo),
			finAlmuerzo: hhmm(finAlmuerzo),
			finTurno: hhmm(finTurno),
			horasLaboradas: calcularHorasLaboradas(
				inicioTurno,
				finTurno,
				inicioAlmuerzo,
				finAlmuerzo,
			),
			duracionAlmuerzo: calcularDuracionAlmuerzo(inicioAlmuerzo, finAlmuerzo),
			motivo: lineasMotivo.join('  |  '),
			observacion: lineasObs.join('  |  '),
			horaInicial: lineasHoraInicial.join('  |  '),
		};
	});

	return filas.sort(
		(a, b) =>
			a.tienda.localeCompare(b.tienda) ||
			a.fecha.localeCompare(b.fecha) ||
			a.empleado.localeCompare(b.empleado),
	);
};

const csvCampo = (valor: string): string => {
	const v = valor ?? '';
	if (
		v.includes(DELIM) ||
		v.includes('"') ||
		v.includes('\n') ||
		v.includes('\r')
	) {
		return `"${v.replace(/"/g, '""')}"`;
	}
	return v;
};

interface ExportarParams {
	records: TimeRecord[];
	stores: Tienda[];
	reasonsMap: Map<number, string>;
	detallada: boolean;
}

export const exportarHistorialExcel = async ({
	records,
	stores,
	reasonsMap,
	detallada,
}: ExportarParams): Promise<{ ok: boolean; mensaje?: string }> => {
	const storesMap = new Map<number, string>(
		stores.map((s) => [Number(s.id), s.name]),
	);
	const filas = agruparParaExport(records, storesMap, reasonsMap);

	if (filas.length === 0) {
		return {
			ok: false,
			mensaje: 'No hay datos para exportar con los filtros seleccionados',
		};
	}

	const columnas: { key: keyof FilaExport; header: string }[] = [
		{ key: 'tienda', header: 'Tienda' },
		{ key: 'cc', header: 'Número CC' },
		{ key: 'empleado', header: 'Nombre empleado' },
		{ key: 'fecha', header: 'Fecha' },
		{ key: 'inicioTurno', header: 'Hora inicio turno' },
		{ key: 'inicioAlmuerzo', header: 'Hora almuerzo inicio' },
		{ key: 'finAlmuerzo', header: 'Hora fin almuerzo' },
		{ key: 'finTurno', header: 'Hora fin de turno' },
		{ key: 'horasLaboradas', header: 'Horas laboradas' },
		{ key: 'duracionAlmuerzo', header: 'Tiempo de almuerzo' },
	];

	if (detallada) {
		columnas.push(
			{ key: 'motivo', header: 'Motivo de edición' },
			{ key: 'observacion', header: 'Observación / nota' },
			{ key: 'horaInicial', header: 'Hora inicial' },
		);
	}

	const lineas: string[] = [];
	lineas.push(columnas.map((c) => csvCampo(c.header)).join(DELIM));
	filas.forEach((fila) => {
		lineas.push(
			columnas.map((c) => csvCampo(String(fila[c.key] ?? ''))).join(DELIM),
		);
	});

	const contenido = `﻿${lineas.join('\r\n')}`;
	const blob = new Blob([contenido], { type: 'text/csv;charset=utf-8;' });
	const { saveAs } = await import('file-saver');
	saveAs(
		blob,
		`Reporte_Historial_Horarios_${dayjs().format('YYYYMMDD-HHmmss')}.csv`,
	);

	return { ok: true };
};
