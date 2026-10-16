import dayjs from 'dayjs';
import type { RegistroTienda } from '../interfaces/registroTienda';
import { formatEstadoRegistroTienda } from './registroTienda';

export interface ExportarRegistroTiendaParams {
	registros: RegistroTienda[];
	nombreArchivo?: string;
}

export const exportarRegistroTiendaExcel = async ({
	registros,
	nombreArchivo,
}: ExportarRegistroTiendaParams): Promise<{
	ok: boolean;
	mensaje?: string;
}> => {
	try {
		const [excelModule, { saveAs }] = await Promise.all([
			import('exceljs'),
			import('file-saver'),
		]);

		const ExcelJS = excelModule.default || excelModule;
		const workbook = new ExcelJS.Workbook();
		workbook.creator = 'Sistema de Horarios';
		workbook.created = new Date();

		const worksheet = workbook.addWorksheet('Registro de Tienda', {
			views: [{ showGridLines: true }],
		});

		// Header title
		const titleRow = worksheet.addRow([
			'REPORTE DE REGISTRO DE TIENDA (APERTURA Y CIERRE)',
		]);
		worksheet.mergeCells(1, 1, 1, 9);
		const titleCell = titleRow.getCell(1);
		titleCell.font = { bold: true, color: { argb: 'FFFFFF' }, size: 14 };
		titleCell.fill = {
			type: 'pattern',
			pattern: 'solid',
			fgColor: { argb: '004680' },
		};
		titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
		titleRow.height = 32;

		// Metadata row
		const metaRow = worksheet.addRow([
			`Generado el: ${dayjs().format('DD/MM/YYYY HH:mm')} | Total registros: ${registros.length}`,
		]);
		worksheet.mergeCells(2, 1, 2, 9);
		const metaCell = metaRow.getCell(1);
		metaCell.font = { italic: true, color: { argb: '475569' }, size: 10 };
		metaCell.alignment = { horizontal: 'center', vertical: 'middle' };
		metaRow.height = 20;

		worksheet.addRow([]); // Blank spacer row

		// Table columns definition
		const startRow = 4;
		const tableRows = registros.map((r) => [
			r.store_id,
			r.store_name,
			r.work_day,
			r.open_time || '--',
			r.close_time || '--',
			r.operative_time,
			r.open_employee || '--',
			r.close_employee || '--',
			formatEstadoRegistroTienda(r.status),
		]);

		worksheet.addTable({
			name: 'TablaRegistroTiendas',
			ref: `A${startRow}`,
			headerRow: true,
			columns: [
				{ name: 'ID Tienda', filterButton: true },
				{ name: 'Tienda', filterButton: true },
				{ name: 'Fecha Jornada', filterButton: true },
				{ name: 'Apertura (open_time)', filterButton: true },
				{ name: 'Cierre (close_time)', filterButton: true },
				{ name: 'Horas Operativas (hrs)', filterButton: true },
				{ name: 'Personal Apertura', filterButton: true },
				{ name: 'Personal Cierre', filterButton: true },
				{ name: 'Estado', filterButton: true },
			],
			rows:
				tableRows.length > 0
					? tableRows
					: [['--', '--', '--', '--', '--', 0, '--', '--', '--']],
		});

		// Style header row
		const headersRow = worksheet.getRow(startRow);
		headersRow.height = 24;
		headersRow.eachCell((cell) => {
			cell.font = { bold: true, color: { argb: 'FFFFFF' }, size: 10 };
			cell.fill = {
				type: 'pattern',
				pattern: 'solid',
				fgColor: { argb: '0F172A' },
			};
			cell.alignment = { vertical: 'middle', horizontal: 'center' };
			cell.border = {
				top: { style: 'thin', color: { argb: '94A3B8' } },
				left: { style: 'thin', color: { argb: '94A3B8' } },
				bottom: { style: 'medium', color: { argb: '004680' } },
				right: { style: 'thin', color: { argb: '94A3B8' } },
			};
		});

		// Style data rows
		const totalDataRows = tableRows.length > 0 ? tableRows.length : 1;
		for (let r = startRow + 1; r <= startRow + totalDataRows; r++) {
			const dataRow = worksheet.getRow(r);
			dataRow.height = 20;
			dataRow.eachCell((cell, colNumber) => {
				cell.alignment = {
					vertical: 'middle',
					horizontal:
						colNumber === 1 ||
						colNumber === 3 ||
						colNumber === 6 ||
						colNumber === 9
							? 'center'
							: 'left',
				};
				cell.border = {
					bottom: { style: 'thin', color: { argb: 'E2E8F0' } },
					left: { style: 'thin', color: { argb: 'F1F5F9' } },
					right: { style: 'thin', color: { argb: 'F1F5F9' } },
				};
				if (colNumber === 6 && typeof cell.value === 'number') {
					cell.numFmt = '0.00';
				}
			});
		}

		// Auto fit column widths
		worksheet.columns = [
			{ width: 12 }, // ID Tienda
			{ width: 28 }, // Tienda
			{ width: 16 }, // Fecha Jornada
			{ width: 22 }, // Apertura
			{ width: 22 }, // Cierre
			{ width: 22 }, // Horas Operativas
			{ width: 26 }, // Personal Apertura
			{ width: 26 }, // Personal Cierre
			{ width: 16 }, // Estado
		];

		const buffer = await workbook.xlsx.writeBuffer();
		const fileType =
			'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
		const blob = new Blob([buffer], { type: fileType });
		const finalName =
			nombreArchivo ||
			`Registro_Tienda_Apertura_Cierre_${dayjs().format('YYYYMMDD-HHmmss')}.xlsx`;

		saveAs(blob, finalName);
		return { ok: true };
	} catch (error) {
		return {
			ok: false,
			mensaje: error instanceof Error ? error.message : 'Error desconocido',
		};
	}
};
