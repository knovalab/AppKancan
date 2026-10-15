import {
	createItem,
	createItems,
	deleteItem,
	readItems,
	updateItem,
} from '@directus/sdk';
import { withAutoRefresh } from '@/auth/services/directusInterceptor';
import directus from '@/services/directus/directus';
import { aPunto } from '../../domain/ubicacion';
import type { CreateEmployeeDto, UpdateEmployeeDto } from '../../interfaces/api/employees';
import type { CreateEventReportDto } from '../../interfaces/api/eventReports';
import type { CreateNewnessReportDto } from '../../interfaces/api/newness';
import type {
	CreateTimeRecordDto,
	UpdateTimeRecordDto,
} from '../../interfaces/api/timeRecords';

export async function createNovedad(data: CreateNewnessReportDto) {
	try {
		const payload = {
			employee_id: Number(data.employee_id),
			newness_id: Number(data.newness_id),
			report_date: data.report_date,
			observations: data.observations || '',
			store_id: Number(data.store_id || 90),
		};
		return await withAutoRefresh(() =>
			directus.request(createItem('com_newness_reports', payload)),
		);
	} catch (error: any) {
		console.error('❌ Error crítico guardando en BD:', error);
		throw new Error(
			error?.errors?.[0]?.message || 'Error inesperado al guardar en Directus',
		);
	}
}

export async function createNovedades(
	items: CreateNewnessReportDto[],
) {
	try {
		const payloads = items.map((data) => ({
			employee_id: Number(data.employee_id),
			newness_id: Number(data.newness_id),
			report_date: data.report_date,
			observations: data.observations || '',
			store_id: Number(data.store_id || 90),
		}));
		return await withAutoRefresh(() =>
			directus.request(createItems('com_newness_reports', payloads)),
		);
	} catch (error: any) {
		console.error('❌ Error crítico guardando novedades en lote en BD:', error);
		throw new Error(
			error?.errors?.[0]?.message ||
				'Error inesperado al guardar novedades en Directus',
		);
	}
}

export async function createEventReport(data: CreateEventReportDto) {
	try {
		const payload = {
			employee_id: Number(data.employee_id),
			store_id: Number(data.store_id || 90),
			event_type: data.event_type,
			observations: data.observations || '',
			date: data.date,
			hour: data.hour,
		};
		return await withAutoRefresh(() =>
			directus.request(createItem('com_event_reports', payload)),
		);
	} catch (error: any) {
		console.error('❌ Error guardando reporte de evento:', error);
		throw new Error(
			error?.errors?.[0]?.message || 'Error al crear el reporte de evento',
		);
	}
}

export async function createTimeRecord(data: CreateTimeRecordDto) {
	try {
		const payload: Record<string, any> = {
			employee_id: Number(data.employee_id),
			store_id: Number(data.store_id || 90),
			log_type: data.log_type,
			record_date: data.record_date,
			record_time: data.record_time,
			observations: data.observations || '',
		};
		if (data.location) {
			payload.location = data.location;
		} else if (
			data.latitude !== undefined &&
			data.latitude !== null &&
			data.longitude !== undefined &&
			data.longitude !== null
		) {
			payload.location = aPunto({
				latitud: data.latitude,
				longitud: data.longitude,
			});
		}
		if (data.accuracy !== undefined && data.accuracy !== null) {
			payload.accuracy = data.accuracy;
		}
		if (data.photo !== undefined && data.photo !== null) {
			payload.photo = data.photo;
		}
		return await withAutoRefresh(() =>
			directus.request(createItem('com_time_records', payload)),
		);
	} catch (error: any) {
		console.error('❌ Error guardando registro de tiempo:', error);
		throw new Error(
			error?.errors?.[0]?.message || 'Error al crear registro de tiempo',
		);
	}
}

export async function updateTimeRecord(
	id: number,
	data: UpdateTimeRecordDto,
) {
	try {
		const payload: any = {};
		if (data.observations !== undefined)
			payload.observations = data.observations;
		if (data.record_time !== undefined) payload.record_time = data.record_time;
		if (data.original_record_time !== undefined)
			payload.original_record_time = data.original_record_time;
		return await withAutoRefresh(() =>
			directus.request(updateItem('com_time_records', id, payload)),
		);
	} catch (error: any) {
		console.error('❌ Error al actualizar registro de tiempo:', error);
		throw new Error(
			error?.errors?.[0]?.message || 'Error al actualizar registro de tiempo',
		);
	}
}

export async function upsertRecordReason(recordId: number, reasonId: number) {
	try {
		const existentes: any = await withAutoRefresh(() =>
			directus.request(
				readItems('com_records_reasons', {
					fields: ['id'],
					filter: { records_id: { _eq: recordId } },
					limit: 1,
				}),
			),
		);
		const fila = (existentes || [])[0];
		if (fila?.id != null) {
			return await withAutoRefresh(() =>
				directus.request(
					updateItem('com_records_reasons', fila.id, {
						reasons_id: Number(reasonId),
					}),
				),
			);
		}
		return await withAutoRefresh(() =>
			directus.request(
				createItem('com_records_reasons', {
					records_id: Number(recordId),
					reasons_id: Number(reasonId),
				}),
			),
		);
	} catch (error: any) {
		console.error('❌ Error al guardar el motivo del registro:', error);
		throw new Error(
			error?.errors?.[0]?.message || 'Error al guardar el motivo del registro',
		);
	}
}

const EMAIL_DEFECTO = 'correo@dominio.com';
const TELEFONO_DEFECTO = '1';

export async function crearEmpleado(data: CreateEmployeeDto) {
	try {
		const payload: any = {
			document_type: data.document_type,
			document_number: data.document_number,
			first_name: data.first_name.trim(),
			last_name: data.last_name.trim(),
			store_id: Number(data.store_id),
			position_id: Number(data.position_id),
			status: 'Activo',
			email: EMAIL_DEFECTO,
			phone_number: TELEFONO_DEFECTO,
		};
		if (data.middle_name?.trim()) payload.middle_name = data.middle_name.trim();
		if (data.second_last_name?.trim())
			payload.second_last_name = data.second_last_name.trim();

		return await withAutoRefresh(() =>
			directus.request(createItem('adm_employees', payload)),
		);
	} catch (error: any) {
		console.error('❌ Error al crear empleado:', error);
		throw new Error(
			error?.errors?.[0]?.message || 'Error al crear el empleado',
		);
	}
}

export async function actualizarEmpleado(
	id: number,
	data: UpdateEmployeeDto,
) {
	try {
		const payload: any = {};
		if (data.store_id !== undefined) payload.store_id = Number(data.store_id);
		if (data.position_id !== undefined)
			payload.position_id = Number(data.position_id);
		if (data.status !== undefined) payload.status = data.status;
		if (data.first_name !== undefined) payload.first_name = data.first_name;
		if (data.middle_name !== undefined) payload.middle_name = data.middle_name;
		if (data.last_name !== undefined) payload.last_name = data.last_name;
		if (data.second_last_name !== undefined)
			payload.second_last_name = data.second_last_name;

		return await withAutoRefresh(() =>
			directus.request(updateItem('adm_employees', id, payload)),
		);
	} catch (error: any) {
		console.error('❌ Error al actualizar empleado:', error);
		throw new Error(
			error?.errors?.[0]?.message || 'Error al actualizar el empleado',
		);
	}
}

export async function eliminarNovedad(id: number) {
	try {
		return await withAutoRefresh(() =>
			directus.request(deleteItem('com_newness_reports', id)),
		);
	} catch (error: any) {
		console.error('❌ Error al eliminar novedad:', error);
		throw new Error(
			error?.errors?.[0]?.message || 'Error al eliminar la novedad',
		);
	}
}

export async function setStoreClosedDayStatus(
	storeId: number,
	date: string,
	newStatus: boolean,
	providedId?: number,
): Promise<any> {
	try {
		let targetId = providedId;

		if (!targetId) {
			const existing = await withAutoRefresh(() =>
				directus.request(
					readItems('com_store_closed_days', {
						fields: ['id'],
						filter: {
							store_id: { _eq: Number(storeId) },
							date: { _eq: date },
						},
						limit: 1,
					}),
				),
			);
			if (existing && existing.length > 0) {
				targetId = existing[0].id;
			}
		}

		if (targetId) {
			return await withAutoRefresh(() =>
				directus.request(
					updateItem('com_store_closed_days', targetId as number, {
						status: newStatus,
					}),
				),
			);
		} else if (newStatus) {
			return await withAutoRefresh(() =>
				directus.request(
					createItem('com_store_closed_days', {
						store_id: Number(storeId),
						date: date,
						status: true,
					}),
				),
			);
		}
		return null;
	} catch (error: any) {
		console.error('❌ Error al actualizar estado de día cerrado:', error);
		throw new Error(
			error?.errors?.[0]?.message ||
				'Error al actualizar estado de día cerrado',
		);
	}
}

export async function createStoreClosedDay(
	storeId: number,
	date: string,
): Promise<any> {
	return setStoreClosedDayStatus(storeId, date, true);
}

export async function deleteStoreClosedDay(id: number): Promise<void> {
	try {
		await withAutoRefresh(() =>
			directus.request(
				updateItem('com_store_closed_days', id, {
					status: false,
				}),
			),
		);
	} catch (error: any) {
		console.error(
			'❌ Error al actualizar estado de día cerrado de tienda:',
			error,
		);
		throw new Error(
			error?.errors?.[0]?.message || 'Error al actualizar día cerrado',
		);
	}
}
