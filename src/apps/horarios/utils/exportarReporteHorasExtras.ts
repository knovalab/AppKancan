import dayjs from 'dayjs';
import {
	ETIQUETA_ESTADO_PERIODO,
	type ReporteZona,
	type ResumenPeriodo,
} from '../domain/horasExtras';
import type { PeriodDto } from '../interfaces/api/period';

const fecha = (f: string) => dayjs(f).format('DD/MM/YYYY');
const horas = (minutos: number) => minutos / 60;

/** Reporte en tiempo real por periodo a Excel (una hoja). Horas en decimal. */
export async function exportarReporteTiempoRealExcel(
	resumen: ResumenPeriodo<PeriodDto>[],
	empresa: string,
	tienda = '',
) {
	const [excelModule, { saveAs }] = await Promise.all([
		import('exceljs'),
		import('file-saver'),
	]);
	const ExcelJS = (excelModule.default ||
		excelModule) as typeof import('exceljs');
	const workbook = new ExcelJS.Workbook();
	const ws = workbook.addWorksheet('Tiempo real');
	ws.columns = [
		{ width: 28 },
		{ width: 26 },
		{ width: 16 },
		{ width: 16 },
		{ width: 14 },
		{ width: 14 },
		{ width: 20 },
	];
	ws.addRow(['Horas extras por periodo (aprobadas y liquidadas)']).font = {
		bold: true,
		size: 14,
		color: { argb: 'FF004680' },
	};
	ws.addRow([
		`Empresa: ${empresa || 'Todas'}${tienda ? `, tienda: ${tienda}` : ''}`,
		`Generado el ${dayjs().format('DD/MM/YYYY HH:mm')}`,
	]).font = { italic: true, color: { argb: 'FF64748B' } };
	ws.addRow([]);
	const cab = ws.addRow([
		'Periodo',
		'Fechas',
		'Estado',
		'Horas del periodo',
		'Rezagadas',
		'Total horas',
		'Liquidado el',
	]);
	cab.eachCell((c) => {
		c.font = { bold: true, color: { argb: 'FFFFFFFF' } };
		c.fill = {
			type: 'pattern',
			pattern: 'solid',
			fgColor: { argb: 'FF004680' },
		};
	});
	for (const r of resumen) {
		const fila = ws.addRow([
			r.periodo.name || 'Sin nombre',
			`${fecha(r.periodo.start_date)} al ${fecha(r.periodo.end_date)}`,
			ETIQUETA_ESTADO_PERIODO[r.periodo.status] ?? r.periodo.status,
			horas(r.delPeriodo.minutos),
			horas(r.rezagadas.minutos),
			horas(r.total.minutos),
			r.periodo.liquidacion_at
				? dayjs(r.periodo.liquidacion_at).format('DD/MM/YYYY HH:mm')
				: '',
		]);
		for (const i of [4, 5, 6]) fila.getCell(i).numFmt = '0.00';
	}
	const buffer = await workbook.xlsx.writeBuffer();
	saveAs(
		new Blob([buffer], {
			type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
		}),
		`Horas_Extras_Tiempo_Real_${dayjs().format('YYYYMMDD-HHmmss')}.xlsx`,
	);
}

/**
 * Reporte por zona a Excel: hojas **Tiendas** (ranking), **Personas** (por tienda)
 * y **Días** (persona por día). Horas en decimal.
 */
export async function exportarReporteZonaExcel({
	reporte,
	zona,
	desde,
	hasta,
	nombreTienda,
	persona,
}: {
	reporte: ReporteZona;
	zona: string;
	desde: string;
	hasta: string;
	nombreTienda: (id: number) => string;
	persona: (id: number) => { nombre: string; documento: string };
}) {
	const [excelModule, { saveAs }] = await Promise.all([
		import('exceljs'),
		import('file-saver'),
	]);
	const ExcelJS = (excelModule.default ||
		excelModule) as typeof import('exceljs');
	const workbook = new ExcelJS.Workbook();
	const hoja = (nombre: string, columnas: string[], anchos: number[]) => {
		const ws = workbook.addWorksheet(nombre);
		ws.columns = anchos.map((width) => ({ width }));
		ws.addRow([`Horas extras aprobadas · Zona ${zona}`]).font = {
			bold: true,
			size: 14,
			color: { argb: 'FF004680' },
		};
		ws.addRow([`Del ${fecha(desde)} al ${fecha(hasta)}`]).font = {
			italic: true,
			color: { argb: 'FF64748B' },
		};
		ws.addRow([]);
		ws.addRow(columnas).eachCell((c) => {
			c.font = { bold: true, color: { argb: 'FFFFFFFF' } };
			c.fill = {
				type: 'pattern',
				pattern: 'solid',
				fgColor: { argb: 'FF004680' },
			};
		});
		return ws;
	};
	const numero = (
		ws: import('exceljs').Worksheet,
		valores: unknown[],
		cols: number[],
	) => {
		const r = ws.addRow(valores);
		for (const c of cols) r.getCell(c).numFmt = '0.00';
	};

	const tiendas = hoja(
		'Tiendas',
		[
			'Tienda',
			'Total horas',
			'% de la zona',
			'Registros',
			'Personas',
			'Horas por persona (plantilla)',
			'Variación vs. periodo anterior',
		],
		[28, 14, 14, 12, 12, 26, 26],
	);
	for (const t of reporte.tiendas) {
		const r = tiendas.addRow([
			nombreTienda(t.storeId),
			horas(t.minutos),
			t.porcentaje,
			t.registros,
			t.personas.length,
			t.minutosPorPersona == null ? '' : horas(t.minutosPorPersona),
			t.variacion ?? '',
		]);
		r.getCell(2).numFmt = '0.00';
		r.getCell(3).numFmt = '0.0%';
		r.getCell(6).numFmt = '0.00';
		r.getCell(7).numFmt = '+0.0%;-0.0%;0.0%';
	}
	numero(
		tiendas,
		[
			'Total',
			horas(reporte.total.minutos),
			1,
			reporte.total.registros,
			reporte.total.personas,
		],
		[2],
	);

	const personas = hoja(
		'Personas',
		[
			'Tienda',
			'Empleado / asesor',
			'Documento',
			'Total horas',
			'Registros',
			'Días con horas',
		],
		[28, 36, 18, 14, 12, 16],
	);
	const dias = hoja(
		'Días',
		['Tienda', 'Empleado / asesor', 'Documento', 'Fecha', 'Total horas'],
		[28, 36, 18, 14, 14],
	);
	for (const t of reporte.tiendas)
		for (const p of t.personas) {
			const { nombre, documento } = persona(p.empleadoId);
			numero(
				personas,
				[
					nombreTienda(t.storeId),
					nombre,
					documento,
					horas(p.minutos),
					p.registros,
					p.dias.length,
				],
				[4],
			);
			for (const d of p.dias)
				numero(
					dias,
					[
						nombreTienda(t.storeId),
						nombre,
						documento,
						fecha(d.fecha),
						horas(d.minutos),
					],
					[5],
				);
		}

	const buffer = await workbook.xlsx.writeBuffer();
	saveAs(
		new Blob([buffer], {
			type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
		}),
		`Horas_Extras_Zona_${zona.replace(/\s+/g, '_')}_${dayjs().format('YYYYMMDD-HHmmss')}.xlsx`,
	);
}
