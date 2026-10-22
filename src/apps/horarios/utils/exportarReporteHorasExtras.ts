import dayjs from 'dayjs';
import {
	ETIQUETA_ESTADO_PERIODO,
	type ResumenPeriodo,
} from '../domain/horasExtras';
import type { PeriodDto } from '../interfaces/api/period';

const fecha = (f: string) => dayjs(f).format('DD/MM/YYYY');
const horas = (minutos: number) => minutos / 60;

/** Reporte en tiempo real por periodo a Excel (una hoja). Horas en decimal. */
export async function exportarReporteTiempoRealExcel(
	resumen: ResumenPeriodo<PeriodDto>[],
	empresa: string,
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
		`Empresa: ${empresa || 'Todas'}`,
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
