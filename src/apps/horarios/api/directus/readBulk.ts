import { readItems } from '@directus/sdk';
import { withAutoRefresh } from '@/auth/services/directusInterceptor';
import directus from '@/services/directus/directus';
import { crearRegistrosVacios, ESTADO } from '../../domain/registro';
import type { EmpleadoAsistencia } from '../../domain/registro/modelo';
import type { FiltroDirectus } from '../../interfaces/api/directus';
import type { EmployeeDto } from '../../interfaces/api/employees';
import type { NewnessBulkDto } from '../../interfaces/api/newness';
import type {
	StoreClosedDayDto,
	StoreClosedDayRawDto,
} from '../../interfaces/api/stores';
import type { TimeRecordBulkDto } from '../../interfaces/api/timeRecords';
import { idRelacion } from './relacion';

/**
 * Obtiene empleados activos en lote (bulk) para un listado de tiendas
 */
export const getEmpleadosBulk = async (
	storeIds?: number[],
): Promise<EmpleadoAsistencia[]> => {
	try {
		const filter: FiltroDirectus = { status: { _eq: 'Activo' } };
		if (storeIds && storeIds.length > 0) {
			filter.store_id = { _in: storeIds };
		}
		const res = (await withAutoRefresh(() =>
			directus.request(
				readItems('adm_employees', {
					fields: [
						'id',
						'document_number',
						'first_name',
						'middle_name',
						'last_name',
						'second_last_name',
						'store_id',
						'position_id.name',
					],
					filter,
					limit: -1,
				}),
			),
		)) as EmployeeDto[];
		return (res || []).map((e) => {
			const parts = [
				e.first_name,
				e.middle_name,
				e.last_name,
				e.second_last_name,
			].filter(Boolean);
			return {
				id: String(e.id),
				documento: e.document_number ? String(e.document_number) : String(e.id),
				nombre: parts.join(' ').trim() || 'Empleado Sin Nombre',
				cargo:
					e.position_id != null && typeof e.position_id === 'object'
						? (e.position_id.name ?? undefined)
						: 'Sin cargo',
				estadoActual: ESTADO.entradaPendiente,
				storeId: e.store_id ? idRelacion(e.store_id) : null,
				registros: crearRegistrosVacios(),
			};
		});
	} catch (err) {
		console.error('❌ Error al obtener empleados en bulk:', err);
		return [];
	}
};

/**
 * Obtiene registros de asistencia en lote para un rango de fechas
 */
export const getTimeRecordsBulkRange = async (
	storeIds: number[],
	startDate: string,
	endDate: string,
): Promise<TimeRecordBulkDto[]> => {
	if (!storeIds || storeIds.length === 0) return [];
	try {
		const res = (await withAutoRefresh(() =>
			directus.request(
				readItems('com_time_records', {
					fields: [
						'id',
						'record_date',
						'record_time',
						'original_record_time',
						'log_type',
						'store_id',
						'observations',
						'employee_id.id',
						'employee_id.first_name',
						'employee_id.middle_name',
						'employee_id.last_name',
						'employee_id.second_last_name',
						'employee_id.document_number',
						'photo',
						'location',
						'accuracy',
					],
					filter: {
						store_id: { _in: storeIds },
						record_date: { _gte: startDate, _lte: endDate },
					},
					limit: -1,
				}),
			),
		)) as TimeRecordBulkDto[];
		return res || [];
	} catch (err) {
		console.error('❌ Error al obtener time_records bulk range:', err);
		return [];
	}
};

/**
 * Obtiene registros de asistencia en lote para un día específico (reutiliza getTimeRecordsBulkRange)
 */
export const getTimeRecordsBulk = async (
	storeIds: number[],
	date: string,
): Promise<TimeRecordBulkDto[]> => {
	return getTimeRecordsBulkRange(storeIds, date, date);
};

/**
 * Obtiene novedades en lote para un rango de fechas
 */
export const getNovedadesBulkRange = async (
	storeIds: number[],
	startDate: string,
	endDate: string,
): Promise<NewnessBulkDto[]> => {
	if (!storeIds || storeIds.length === 0) return [];
	try {
		const res = (await withAutoRefresh(() =>
			directus.request(
				readItems('com_newness_reports', {
					fields: [
						'id',
						'report_date',
						'store_id',
						'observations',
						'employee_id.id',
						'newness_id.name',
					],
					filter: {
						store_id: { _in: storeIds },
						report_date: { _gte: startDate, _lte: endDate },
					},
					limit: -1,
				}),
			),
		)) as NewnessBulkDto[];
		return res || [];
	} catch (err) {
		console.error('❌ Error al obtener novedades bulk range:', err);
		return [];
	}
};

/**
 * Obtiene los días de tienda cerrada para una o varias tiendas
 */
export const getStoreClosedDays = async (
	storeIds?: number | number[],
	startDate?: string,
	endDate?: string,
): Promise<StoreClosedDayDto[]> => {
	try {
		const filter: FiltroDirectus = {};
		if (storeIds != null) {
			if (Array.isArray(storeIds)) {
				if (!storeIds.length) return [];
				filter.store_id = { _in: storeIds };
			} else {
				filter.store_id = { _eq: storeIds };
			}
		}
		if (startDate && endDate) {
			filter.date = { _between: [startDate, endDate] };
		} else if (startDate) {
			filter.date = { _gte: startDate };
		} else if (endDate) {
			filter.date = { _lte: endDate };
		}

		const res = (await withAutoRefresh(() =>
			directus.request(
				readItems('com_store_closed_days', {
					fields: [
						'id',
						'store_id',
						'date',
						'status',
						'user_created',
						'date_created',
					],
					filter,
					limit: -1,
				}),
			),
		)) as StoreClosedDayRawDto[];

		return (res || []).map((item) => ({
			id: item.id,
			store_id: Number(
				item.store_id != null && typeof item.store_id === 'object'
					? item.store_id.id
					: item.store_id,
			),
			date: item.date,
			status: item.status !== false,
			user_created: item.user_created,
			date_created: item.date_created,
		})) as StoreClosedDayDto[];
	} catch (err) {
		console.error('❌ Error al obtener días cerrados de la tienda:', err);
		return [];
	}
};
