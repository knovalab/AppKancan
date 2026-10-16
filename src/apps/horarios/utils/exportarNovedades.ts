import dayjs from 'dayjs';
import type { NewnessReport } from '../api/directus/read';
import type { Tienda } from '../interfaces/horarios.interface';

const DELIM = ';';

const nombreEmpleado = (emp: NewnessReport['employee_id']): string =>
	emp
		? [emp.first_name, emp.middle_name, emp.last_name, emp.second_last_name]
				.filter((n) => n && String(n).trim())
				.join(' ')
		: 'Sin nombre';

const fechaDayjs = (nov: NewnessReport) => {
	const raw = nov.report_date || nov.date_created;
	if (!raw) return null;
	const d = dayjs(raw);
	return d.isValid() ? d : null;
};

interface FilaExport {
	tienda: string;
	cc: string;
	empleado: string;
	fecha: string;
	fechaOrden: string;
	tipo: string;
	observacion: string;
}

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
	reports: NewnessReport[];
	stores: Tienda[];
}

export const exportarNovedadesExcel = async ({
	reports,
	stores,
}: ExportarParams): Promise<{ ok: boolean; mensaje?: string }> => {
	const storesMap = new Map<number, string>(
		stores.map((s) => [Number(s.id), s.name]),
	);

	const filas: FilaExport[] = reports.map((nov) => {
		const d = fechaDayjs(nov);
		return {
			tienda: storesMap.get(Number(nov.store_id)) || String(nov.store_id ?? ''),
			cc: String(nov.employee_id?.document_number ?? ''),
			empleado: nombreEmpleado(nov.employee_id),
			fecha: d ? d.format('DD-MM-YYYY') : '',
			fechaOrden: d ? d.format('YYYY-MM-DD') : '',
			tipo: nov.newness_id?.name || '',
			observacion: nov.observations || '',
		};
	});

	if (filas.length === 0) {
		return {
			ok: false,
			mensaje: 'No hay datos para exportar con los filtros seleccionados',
		};
	}

	filas.sort(
		(a, b) =>
			a.tienda.localeCompare(b.tienda) ||
			a.fechaOrden.localeCompare(b.fechaOrden) ||
			a.empleado.localeCompare(b.empleado),
	);

	const columnas: { key: keyof FilaExport; header: string }[] = [
		{ key: 'tienda', header: 'Tienda' },
		{ key: 'cc', header: 'Número CC' },
		{ key: 'empleado', header: 'Nombre empleado' },
		{ key: 'fecha', header: 'Fecha' },
		{ key: 'tipo', header: 'Tipo de novedad' },
		{ key: 'observacion', header: 'Observacion' },
	];

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
		`Reporte_Novedades_Horarios_${dayjs().format('YYYYMMDD-HHmmss')}.csv`,
	);

	return { ok: true };
};
