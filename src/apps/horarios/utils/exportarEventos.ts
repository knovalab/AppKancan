import dayjs from 'dayjs';
import type { EventReportExport } from '../api/directus/read';
import type { Tienda } from '../interfaces/horarios.interface';

const nombreEmpleado = (emp: EventReportExport['employee_id']): string =>
	emp
		? [emp.first_name, emp.middle_name, emp.last_name, emp.second_last_name]
				.filter((n) => n && String(n).trim())
				.join(' ')
		: 'Sin nombre';

interface FilaExport {
	tienda: string;
	cc: string;
	empleado: string;
	fecha: string;
	fechaOrden: string;
	hora: string;
	evento: string;
	observacion: string;
}

interface ExportarParams {
	reports: EventReportExport[];
	stores: Tienda[];
}

export const exportarEventosExcel = async ({
	reports,
	stores,
}: ExportarParams): Promise<{ ok: boolean; mensaje?: string }> => {
	const storesMap = new Map<number, string>(
		stores.map((s) => [Number(s.id), s.name]),
	);

	const filas: FilaExport[] = reports.map((ev) => {
		const fechaRaw = (ev.date ?? '').slice(0, 10);
		return {
			tienda: storesMap.get(Number(ev.store_id)) || String(ev.store_id ?? ''),
			cc: String(ev.employee_id?.document_number ?? ''),
			empleado: nombreEmpleado(ev.employee_id),
			fecha: fechaRaw ? dayjs(fechaRaw).format('DD-MM-YYYY') : '',
			fechaOrden: fechaRaw,
			hora: ev.hour ? String(ev.hour).slice(0, 5) : '',
			evento: ev.event_type || '',
			observacion: ev.observations || '',
		};
	});

	filas.sort(
		(a, b) =>
			a.tienda.localeCompare(b.tienda) ||
			a.fechaOrden.localeCompare(b.fechaOrden) ||
			a.hora.localeCompare(b.hora) ||
			a.empleado.localeCompare(b.empleado),
	);

	const [excelModule, { saveAs }] = await Promise.all([
		import('exceljs'),
		import('file-saver'),
	]);
	const ExcelJS = (excelModule.default ||
		excelModule) as typeof import('exceljs');
	const workbook = new ExcelJS.Workbook();
	const worksheet = workbook.addWorksheet('Pausas Activas');

	worksheet.getColumn(1).width = 15;
	worksheet.getColumn(2).width = 30;
	worksheet.getColumn(3).width = 15;
	worksheet.getColumn(4).width = 10;
	worksheet.getColumn(5).width = 20;
	worksheet.getColumn(6).width = 45;

	stores.forEach((store, index) => {
		const storeName = store.name;
		const registrosTienda = filas.filter((f) => f.tienda === storeName);

		const storeHeaderRow = worksheet.addRow([storeName]);
		worksheet.mergeCells(storeHeaderRow.number, 1, storeHeaderRow.number, 6);

		const storeCell = storeHeaderRow.getCell(1);
		storeCell.font = { bold: true, color: { argb: 'FFFFFF' }, size: 12 };
		storeCell.fill = {
			type: 'pattern',
			pattern: 'solid',
			fgColor: { argb: '004680' },
		};
		storeCell.alignment = { horizontal: 'center', vertical: 'middle' };
		storeHeaderRow.height = 26;

		if (registrosTienda.length > 0) {
			const startRow = storeHeaderRow.number + 1;
			const tableRows = registrosTienda.map((reg) => [
				reg.cc,
				reg.empleado,
				reg.fecha,
				reg.hora,
				reg.evento,
				reg.observacion,
			]);

			worksheet.addTable({
				name: `Tabla_${store.id}_${index}`,
				ref: `A${startRow}`,
				headerRow: true,
				columns: [
					{ name: 'Número CC', filterButton: true },
					{ name: 'Nombre empleado', filterButton: true },
					{ name: 'Fecha', filterButton: true },
					{ name: 'Hora', filterButton: true },
					{ name: 'Evento', filterButton: true },
					{ name: 'Observación', filterButton: true },
				],
				rows: tableRows,
			});

			const headersRow = worksheet.getRow(startRow);
			headersRow.height = 20;
			headersRow.eachCell((cell) => {
				cell.font = { bold: true, color: { argb: '333333' } };
				cell.fill = {
					type: 'pattern',
					pattern: 'solid',
					fgColor: { argb: 'E2E8F0' },
				};
				cell.border = {
					top: { style: 'thin', color: { argb: 'CBD5E1' } },
					left: { style: 'thin', color: { argb: 'CBD5E1' } },
					bottom: { style: 'medium', color: { argb: '94A3B8' } },
					right: { style: 'thin', color: { argb: 'CBD5E1' } },
				};
				cell.alignment = { vertical: 'middle' };
			});

			for (let r = startRow + 1; r <= startRow + tableRows.length; r++) {
				const dataRow = worksheet.getRow(r);
				dataRow.height = 18;
				dataRow.eachCell((cell) => {
					cell.border = {
						bottom: { style: 'thin', color: { argb: 'E2E8F0' } },
						left: { style: 'thin', color: { argb: 'F1F5F9' } },
						right: { style: 'thin', color: { argb: 'F1F5F9' } },
					};
					cell.alignment = { vertical: 'middle' };
				});
			}
		} else {
			const noDataRow = worksheet.addRow([
				'No contiene datos en este rango de tiempo',
			]);
			worksheet.mergeCells(noDataRow.number, 1, noDataRow.number, 6);

			const noDataCell = noDataRow.getCell(1);
			noDataCell.font = { italic: true, color: { argb: '64748B' } };
			noDataCell.alignment = { horizontal: 'center', vertical: 'middle' };
			noDataRow.height = 20;

			noDataCell.border = {
				top: { style: 'thin', color: { argb: 'E2E8F0' } },
				left: { style: 'thin', color: { argb: 'E2E8F0' } },
				bottom: { style: 'thin', color: { argb: 'E2E8F0' } },
				right: { style: 'thin', color: { argb: 'E2E8F0' } },
			};
		}

		worksheet.addRow([]);
		worksheet.addRow([]);
	});

	const buffer = await workbook.xlsx.writeBuffer();
	const fileType =
		'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
	const blob = new Blob([buffer], { type: fileType });
	saveAs(
		blob,
		`Reporte_Pausas_Activas_Horarios_${dayjs().format('YYYYMMDD-HHmmss')}.xlsx`,
	);

	return { ok: true };
};
