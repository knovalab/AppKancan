import { readItems } from '@directus/sdk';
import { withAutoRefresh } from '@/auth/services/directusInterceptor';
import directus from '@/services/directus/directus';
import type {
	FiltroDirectus,
	OperadoresDirectus,
} from '../../interfaces/api/directus';
import type {
	EmployeeEventReportDto,
	EventReportExportDto,
	EventReportHoyDto,
	StoreEventReportDto,
} from '../../interfaces/api/eventReports';
import type {
	EmployeeNewnessDto,
	NewnessReportDto,
} from '../../interfaces/api/newness';
import type { TimeRecordStoreDto } from '../../interfaces/api/timeRecordStore';
import type {
	EmployeeTimeRecordDto,
	TimeRecordDto,
} from '../../interfaces/api/timeRecords';
import { STORE_PRUEBAS } from './read';

/** `{ _in, _neq }` de tienda para las exportaciones (excluye la tienda de pruebas salvo que se pida). */
function operadoresTienda(
	storeIds: number[] | undefined,
	incluirPruebas: boolean,
): OperadoresDirectus | null {
	const ops: OperadoresDirectus = {};
	if (storeIds && storeIds.length > 0) ops._in = storeIds;
	if (!incluirPruebas) ops._neq = STORE_PRUEBAS;
	return Object.keys(ops).length > 0 ? ops : null;
}

/** `{ _gte, _lte }` con las fechas que vengan; null si no hay ninguna. */
function rango(desde?: string, hasta?: string): OperadoresDirectus | null {
	if (!desde && !hasta) return null;
	const ops: OperadoresDirectus = {};
	if (desde) ops._gte = desde;
	if (hasta) ops._lte = hasta;
	return ops;
}

export const fetchTimeRecordsExport = async (
	fechaInicio?: string,
	fechaFin?: string,
	storeIds?: number[],
	incluirPruebas = false,
): Promise<TimeRecordDto[]> => {
	const filter: FiltroDirectus = {};
	const tienda = operadoresTienda(storeIds, incluirPruebas);
	if (tienda) filter.store_id = tienda;
	const fechas = rango(fechaInicio, fechaFin);
	if (fechas) filter.record_date = fechas;

	return (await withAutoRefresh(() =>
		directus.request(
			readItems('com_time_records', {
				fields: [
					'id',
					'record_date',
					'record_time',
					'original_record_time',
					'log_type',
					'employee_id.document_number',
					'employee_id.first_name',
					'employee_id.middle_name',
					'employee_id.last_name',
					'employee_id.second_last_name',
					'store_id.id',
					'store_id.name',
					'observations',
				],
				filter,
				sort: ['record_date'],
				limit: -1,
			}),
		),
	)) as TimeRecordDto[];
};

export const fetchNewnessReportsExport = async (
	fechaInicio?: string,
	fechaFin?: string,
	storeIds?: number[],
	incluirPruebas = false,
): Promise<NewnessReportDto[]> => {
	const condiciones: FiltroDirectus[] = [];

	if (storeIds && storeIds.length > 0) {
		condiciones.push({ store_id: { _in: storeIds } });
	}
	if (!incluirPruebas) {
		condiciones.push({ store_id: { _neq: STORE_PRUEBAS } });
	}

	if (fechaInicio || fechaFin) {
		const reportRange: OperadoresDirectus = {};
		const createdRange: OperadoresDirectus = {};
		if (fechaInicio) {
			reportRange._gte = fechaInicio;
			createdRange._gte = `${fechaInicio}T00:00:00`;
		}
		if (fechaFin) {
			reportRange._lte = fechaFin;
			createdRange._lte = `${fechaFin}T23:59:59`;
		}
		condiciones.push({
			_or: [
				{ report_date: reportRange },
				{
					_and: [
						{ report_date: { _null: true } },
						{ date_created: createdRange },
					],
				},
			],
		});
	}

	const filter: FiltroDirectus =
		condiciones.length > 0 ? { _and: condiciones } : {};

	return (await withAutoRefresh(() =>
		directus.request(
			readItems('com_newness_reports', {
				fields: [
					'id',
					'report_date',
					'date_created',
					'observations',
					'newness_id.name',
					'store_id',
					'employee_id.id',
					'employee_id.document_number',
					'employee_id.first_name',
					'employee_id.middle_name',
					'employee_id.last_name',
					'employee_id.second_last_name',
				],
				filter,
				sort: ['report_date'],
				limit: -1,
			}),
		),
	)) as NewnessReportDto[];
};

export const fetchEventReportsExport = async (
	fechaInicio?: string,
	fechaFin?: string,
	storeIds?: number[],
	incluirPruebas = false,
): Promise<EventReportExportDto[]> => {
	const filter: FiltroDirectus = {};
	const tienda = operadoresTienda(storeIds, incluirPruebas);
	if (tienda) filter.store_id = tienda;
	const fechas = rango(fechaInicio, fechaFin);
	if (fechas) filter.date = fechas;

	return (await withAutoRefresh(() =>
		directus.request(
			readItems('com_event_reports', {
				fields: [
					'event_type',
					'date',
					'hour',
					'observations',
					'store_id',
					'employee_id.document_number',
					'employee_id.first_name',
					'employee_id.middle_name',
					'employee_id.last_name',
					'employee_id.second_last_name',
				],
				filter,
				sort: ['date', 'hour'],
				limit: -1,
			}),
		),
	)) as EventReportExportDto[];
};

export async function getEmployeeTimeRecords(
	employeeId: number,
	fechaInicio: string,
	fechaFin: string,
): Promise<EmployeeTimeRecordDto[]> {
	try {
		return (await withAutoRefresh(() =>
			directus.request(
				readItems('com_time_records', {
					fields: [
						'id',
						'record_date',
						'record_time',
						'original_record_time',
						'log_type',
					],
					filter: {
						employee_id: { _eq: employeeId },
						record_date: { _gte: fechaInicio, _lte: fechaFin },
					},
					sort: ['record_date', 'record_time'],
					limit: -1,
				}),
			),
		)) as EmployeeTimeRecordDto[];
	} catch (error) {
		console.error('❌ Error cargando marcaciones del empleado:', error);
		return [];
	}
}

export async function getEmployeeNovedades(
	employeeId: number,
	limit = 10,
): Promise<EmployeeNewnessDto[]> {
	try {
		return (await withAutoRefresh(() =>
			directus.request(
				readItems('com_newness_reports', {
					fields: [
						'id',
						'report_date',
						'date_created',
						'observations',
						'newness_id.name',
					],
					filter: { employee_id: { _eq: employeeId } },
					sort: ['-id'],
					limit,
				}),
			),
		)) as EmployeeNewnessDto[];
	} catch (error) {
		console.error('❌ Error cargando novedades del empleado:', error);
		return [];
	}
}

export async function getEmployeeEventReports(
	employeeId: number,
	fechaInicio: string,
	fechaFin: string,
): Promise<EmployeeEventReportDto[]> {
	try {
		return (await withAutoRefresh(() =>
			directus.request(
				readItems('com_event_reports', {
					fields: ['id', 'event_type', 'date', 'hour', 'observations'],
					filter: {
						employee_id: { _eq: employeeId },
						date: { _gte: fechaInicio, _lte: fechaFin },
					},
					sort: ['-date', '-hour'],
					limit: -1,
				}),
			),
		)) as EmployeeEventReportDto[];
	} catch (error) {
		console.error('❌ Error cargando eventos del empleado:', error);
		return [];
	}
}

export async function getStoreEventReportsToday(
	storeId: number,
	date: string,
): Promise<EventReportHoyDto[]> {
	try {
		return (await withAutoRefresh(() =>
			directus.request(
				readItems('com_event_reports', {
					fields: ['id', 'employee_id.id', 'event_type', 'date'],
					filter: {
						store_id: { _eq: storeId },
						date: { _eq: date },
					},
					limit: -1,
				}),
			),
		)) as EventReportHoyDto[];
	} catch (error) {
		console.error('❌ Error cargando eventos de la tienda:', error);
		return [];
	}
}

export async function getStoreEventReports(
	storeId: number | number[] | null,
	fechaInicio?: string,
	fechaFin?: string,
): Promise<StoreEventReportDto[]> {
	try {
		const filter: FiltroDirectus = {};
		if (storeId != null) {
			if (Array.isArray(storeId)) {
				filter.store_id = { _in: storeId };
			} else {
				filter.store_id = { _eq: storeId };
			}
		}
		const fechas = rango(fechaInicio, fechaFin);
		if (fechas) filter.date = fechas;
		return (await withAutoRefresh(() =>
			directus.request(
				readItems('com_event_reports', {
					fields: [
						'id',
						'event_type',
						'date',
						'hour',
						'date_created',
						'observations',
						'employee_id.id',
						'employee_id.first_name',
						'employee_id.middle_name',
						'employee_id.last_name',
						'employee_id.second_last_name',
						'employee_id.document_number',
						'store_id.id',
						'store_id.name',
					],
					filter,
					sort: ['-date', '-hour'],
					limit: -1,
				}),
			),
		)) as StoreEventReportDto[];
	} catch (error) {
		console.error(
			'❌ Error al obtener reportes de eventos de la tienda:',
			error,
		);
		return [];
	}
}

/**
 * Consulta la tabla `com_time_record_store` ("Registro_de_tienda") en Directus.
 * Si la tabla aún no existe o está vacía, devuelve array vacío para permitir
 * el cálculo de respaldo a partir de `com_time_records`.
 */
export async function fetchTimeRecordStore(
	fechaInicio?: string,
	fechaFin?: string,
	storeIds?: number | number[],
): Promise<TimeRecordStoreDto[]> {
	try {
		const filter: FiltroDirectus = {};
		if (storeIds != null) {
			if (Array.isArray(storeIds)) {
				if (storeIds.length > 0) filter.store = { _in: storeIds };
			} else {
				filter.store = { _eq: storeIds };
			}
		}
		if (fechaInicio || fechaFin) {
			const rangoFechas: OperadoresDirectus = {};
			if (fechaInicio) rangoFechas._gte = fechaInicio;
			if (fechaFin) rangoFechas._lte = fechaFin;
			filter.work_date = rangoFechas;
		}

		return (await withAutoRefresh(() =>
			directus.request(
				readItems('com_time_record_store' as any, {
					fields: [
						'*',
						'store.id',
						'store.name',
						'open_user.id',
						'open_user.first_name',
						'open_user.last_name',
						'close_user.id',
						'close_user.first_name',
						'close_user.last_name',
					],
					filter,
					sort: ['-work_date'],
					limit: -1,
				}),
			),
		)) as TimeRecordStoreDto[];
	} catch (_error) {
		return [];
	}
}
