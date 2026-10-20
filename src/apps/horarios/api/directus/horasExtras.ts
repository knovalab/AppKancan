import { createItem, readItems, updateItem, updateItems } from '@directus/sdk';
import { withAutoRefresh } from '@/auth/services/directusInterceptor';
import directus from '@/services/directus/directus';
import {
	ESTADO_HORA_EXTRA,
	type EstadoHoraExtra,
} from '../../domain/horasExtras';
import type { FiltroDirectus } from '../../interfaces/api/directus';
import type {
	CreateOverTimeDto,
	OverTimeDto,
	ReviewOverTimeDto,
	UpdateOverTimeDto,
} from '../../interfaces/api/overTime';
import { errorDeApi } from '../../utils/errores';
import { STORE_PRUEBAS } from './read';

export interface FiltrosHorasExtras {
	/** Tiendas permitidas del usuario; vacío o ausente = sin filtro (comercial: todas). */
	tiendas?: number[];
	empleadoId?: number;
	/** `work_date` YYYY-MM-DD */
	desde?: string;
	hasta?: string;
	estados?: EstadoHoraExtra[];
	incluirPruebas?: boolean;
}

// created_by / reviewed_by / updated_by necesitan lectura de directus_users (first_name, last_name).
const CAMPOS = [
	'*',
	'employee_id.id',
	'employee_id.first_name',
	'employee_id.last_name',
	'employee_id.document_number',
	'employee_id.store_id',
	'store_id.id',
	'store_id.name',
	'created_by.id',
	'created_by.first_name',
	'created_by.last_name',
	'reviewed_by.id',
	'reviewed_by.first_name',
	'reviewed_by.last_name',
	'updated_by.id',
	'updated_by.first_name',
	'updated_by.last_name',
];

/**
 * Filtro de Directus para la lista. Las tiendas cuentan por la tienda donde se
 * trabajó **o** por la del empleado: así el líder ve a sus empleados rotados a
 * otra tienda (decisión P4).
 */
export function filtroHorasExtras(f: FiltrosHorasExtras): FiltroDirectus {
	const y: FiltroDirectus[] = [];
	if (f.tiendas && f.tiendas.length > 0) {
		y.push({
			_or: [
				{ store_id: { _in: f.tiendas } },
				{ employee_id: { store_id: { _in: f.tiendas } } },
			],
		});
	}
	if (!f.incluirPruebas) y.push({ store_id: { _neq: STORE_PRUEBAS } });
	if (f.empleadoId != null) y.push({ employee_id: { _eq: f.empleadoId } });
	if (f.desde) y.push({ work_date: { _gte: f.desde } });
	if (f.hasta) y.push({ work_date: { _lte: f.hasta } });
	if (f.estados && f.estados.length > 0) y.push({ status: { _in: f.estados } });
	return y.length > 0 ? { _and: y } : {};
}

export async function listarHorasExtras(
	filtros: FiltrosHorasExtras,
): Promise<OverTimeDto[]> {
	try {
		return (await withAutoRefresh(() =>
			directus.request(
				readItems('com_over_time', {
					fields: CAMPOS,
					filter: filtroHorasExtras(filtros),
					sort: ['-work_date', '-id'],
					limit: -1,
				}),
			),
		)) as OverTimeDto[];
	} catch (error) {
		throw errorDeApi(
			error,
			'Error consultando horas extras',
			'Error al cargar las horas extras',
		);
	}
}

/** Crea una hora extra del líder: entra siempre en `pendiente`. */
export async function crearHoraExtra(data: CreateOverTimeDto) {
	try {
		return await withAutoRefresh(() =>
			directus.request(
				createItem('com_over_time', {
					employee_id: Number(data.employee_id),
					store_id: Number(data.store_id),
					work_date: data.work_date,
					minutes: data.minutes,
					observations: data.observations ?? '',
				}),
			),
		);
	} catch (error) {
		throw errorDeApi(
			error,
			'Error guardando hora extra',
			'Error al crear la hora extra',
		);
	}
}

/** Edición del líder. Que siga en `pendiente` lo exige el permiso de Directus. */
export async function actualizarHoraExtra(id: number, data: UpdateOverTimeDto) {
	try {
		const payload: Record<string, unknown> = {};
		if (data.store_id !== undefined) payload.store_id = Number(data.store_id);
		if (data.minutes !== undefined) payload.minutes = data.minutes;
		if (data.observations !== undefined)
			payload.observations = data.observations;
		return await withAutoRefresh(() =>
			directus.request(updateItem('com_over_time', id, payload)),
		);
	} catch (error) {
		throw errorDeApi(
			error,
			'Error actualizando hora extra',
			'Error al actualizar la hora extra',
		);
	}
}

/** Aprueba o rechaza una o varias pendientes en una sola petición. */
export async function revisarHorasExtras(ids: number[], r: ReviewOverTimeDto) {
	if (ids.length === 0) return [];
	const aprobar = r.decision === ESTADO_HORA_EXTRA.aprobada;
	if (!aprobar && !r.nota?.trim())
		throw new Error('El motivo del rechazo es obligatorio.');
	try {
		return await withAutoRefresh(() =>
			directus.request(
				updateItems('com_over_time', ids, {
					status: r.decision,
					// shortcut: hora del dispositivo (UTC); si se exige la del servidor, preset $NOW en la política del comercial.
					reviewed_at: new Date().toISOString(),
					reviewed_by: r.revisor,
					review_note: aprobar ? null : r.nota!.trim(),
				}),
			),
		);
	} catch (error) {
		throw errorDeApi(
			error,
			'Error revisando horas extras',
			'Error al guardar la revisión de las horas extras',
		);
	}
}
