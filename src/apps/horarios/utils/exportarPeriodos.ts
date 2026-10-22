import dayjs from 'dayjs';
import { ESTADO_PERIODO, ETIQUETA_ESTADO_PERIODO } from '../domain/horasExtras';
import type { OverTimeDto } from '../interfaces/api/overTime';
import type { PeriodDto } from '../interfaces/api/period';
import type { Tienda } from '../interfaces/tiendas';
import { aFilaHoraExtra } from './horasExtras';

export interface FilaExportPeriodo {
	empleado: string;
	documento: string;
	tienda: string;
	horasExtras: number;
	minutos: number;
}

export interface BloquePeriodo {
	periodo: PeriodDto;
	filas: FilaExportPeriodo[];
	totales: { horasExtras: number; minutos: number; empleados: number };
}

export interface HojaEmpresa {
	empresa: string;
	bloques: BloquePeriodo[];
}

const SIN_EMPRESA = 'Sin empresa';

/**
 * Agrupa las horas de cada periodo por **empresa** (la de la tienda donde se
 * trabajó) y, dentro de cada periodo, por empleado + tienda. Una hoja por
 * empresa; en cada hoja, un bloque por periodo (aunque esté vacío).
 */
export function hojasExportacionPeriodos(
	datos: readonly { periodo: PeriodDto; horas: readonly OverTimeDto[] }[],
	tiendas: readonly Tienda[],
): HojaEmpresa[] {
	const empresaDe = new Map(
		tiendas.map((t) => [Number(t.id), t.company?.trim() || SIN_EMPRESA]),
	);
	const empresas = new Set<string>();
	// empresa → periodo.id → empleado|tienda → fila
	const acum = new Map<string, Map<number, Map<string, FilaExportPeriodo>>>();

	for (const { periodo, horas } of datos) {
		for (const dto of horas) {
			const f = aFilaHoraExtra(dto);
			const empresa =
				(f.tiendaId != null && empresaDe.get(f.tiendaId)) || SIN_EMPRESA;
			empresas.add(empresa);
			const porPeriodo = acum.get(empresa) ?? new Map();
			acum.set(empresa, porPeriodo);
			const filas = porPeriodo.get(periodo.id) ?? new Map();
			porPeriodo.set(periodo.id, filas);
			const clave = `${f.empleadoId ?? f.documento}|${f.tiendaId}`;
			const fila = filas.get(clave) ?? {
				empleado: f.empleado,
				documento: f.documento,
				tienda: f.tienda,
				horasExtras: 0,
				minutos: 0,
			};
			fila.horasExtras += 1;
			fila.minutos += f.minutos;
			filas.set(clave, fila);
		}
	}

	return [...empresas]
		.sort((a, b) =>
			a === SIN_EMPRESA ? 1 : b === SIN_EMPRESA ? -1 : a.localeCompare(b, 'es'),
		)
		.map((empresa) => ({
			empresa,
			bloques: datos.map(({ periodo }) => {
				const porClave = acum.get(empresa)?.get(periodo.id) ?? new Map();
				const filas = [...porClave.values()].sort(
					(a, b) =>
						a.tienda.localeCompare(b.tienda, 'es') ||
						a.empleado.localeCompare(b.empleado, 'es'),
				);
				return {
					periodo,
					filas,
					totales: {
						horasExtras: filas.reduce((s, f) => s + f.horasExtras, 0),
						minutos: filas.reduce((s, f) => s + f.minutos, 0),
						// Por id de empleado (la clave es empleado|tienda): el documento puede faltar.
						empleados: new Set([...porClave.keys()].map((k) => k.split('|')[0]))
							.size,
					},
				};
			}),
		}));
}

const fecha = (f: string) => dayjs(f).format('DD/MM/YYYY');

/** Hoja de Excel: máx. 31 caracteres y sin `\ / ? * [ ] :`. */
const nombreHoja = (s: string) => s.replace(/[\\/?*[\]:]/g, ' ').slice(0, 31);

/** Escribe el Excel (una hoja por empresa) y lo descarga. */
export async function exportarPeriodosExcel(hojas: HojaEmpresa[]) {
	const [excelModule, { saveAs }] = await Promise.all([
		import('exceljs'),
		import('file-saver'),
	]);
	const ExcelJS = (excelModule.default ||
		excelModule) as typeof import('exceljs');
	const workbook = new ExcelJS.Workbook();
	const azul = { argb: 'FF004680' };
	const relleno = (argb: string) =>
		({ type: 'pattern', pattern: 'solid', fgColor: { argb } }) as const;

	for (const hoja of hojas) {
		const ws = workbook.addWorksheet(nombreHoja(hoja.empresa));
		ws.columns = [{ width: 38 }, { width: 18 }, { width: 28 }, { width: 16 }];
		const titulo = ws.addRow([`Horas extras por periodo · ${hoja.empresa}`]);
		titulo.font = { bold: true, size: 14, color: azul };
		ws.addRow([`Generado el ${dayjs().format('DD/MM/YYYY HH:mm')}`]).font = {
			italic: true,
			color: { argb: 'FF64748B' },
		};

		for (const { periodo, filas, totales } of hoja.bloques) {
			ws.addRow([]);
			const cab = ws.addRow([`Periodo: ${periodo.name || 'Sin nombre'}`]);
			cab.font = { bold: true, size: 12, color: azul };
			cab.getCell(1).fill = relleno('FFF0F7FF');
			const liquidado = periodo.status === ESTADO_PERIODO.liquidado;
			ws.addRow([
				`Fechas: ${fecha(periodo.start_date)} al ${fecha(periodo.end_date)}`,
				`Estado: ${ETIQUETA_ESTADO_PERIODO[periodo.status] ?? periodo.status}${
					liquidado && periodo.liquidacion_at
						? ` (${dayjs(periodo.liquidacion_at).format('DD/MM/YYYY HH:mm')})`
						: liquidado
							? ''
							: ' (vista previa, sin liquidar)'
				}`,
			]);
			ws.addRow([
				`Empleados: ${totales.empleados}`,
				`Horas extras: ${totales.horasExtras}`,
				`Total horas: ${(totales.minutos / 60).toFixed(2)}`,
			]);
			if (filas.length === 0) {
				ws.addRow(['Sin horas extras de esta empresa en el periodo']).font = {
					italic: true,
					color: { argb: 'FF94A3B8' },
				};
				continue;
			}
			const encabezado = ws.addRow([
				'Empleado / asesor',
				'Documento',
				'Tienda',
				'Total horas',
			]);
			encabezado.eachCell((c) => {
				c.font = { bold: true, color: { argb: 'FFFFFFFF' } };
				c.fill = relleno('FF004680');
			});
			for (const f of filas) {
				const r = ws.addRow([
					f.empleado,
					f.documento,
					f.tienda,
					f.minutos / 60,
				]);
				r.getCell(4).numFmt = '0.00';
			}
			const total = ws.addRow(['Total', '', '', totales.minutos / 60]);
			total.font = { bold: true };
			total.getCell(4).numFmt = '0.00';
		}
	}

	const buffer = await workbook.xlsx.writeBuffer();
	const blob = new Blob([buffer], {
		type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
	});
	saveAs(
		blob,
		`Horas_Extras_Periodos_${dayjs().format('YYYYMMDD-HHmmss')}.xlsx`,
	);
}
