import { readItems, readMe } from '@directus/sdk';
import dayjs from 'dayjs';
import { withAutoRefresh } from '@/auth/services/directusInterceptor';
import directus from '@/services/directus/directus';
import type { EmpleadoAsistencia } from '../../domain/registro/modelo';
import type {
	FiltroDirectus,
	OperadoresDirectus,
} from '../../interfaces/api/directus';
import type {
	EmployeeDto,
	PositionDto,
	UsuarioActualDto,
} from '../../interfaces/api/employees';
import type {
	NewnessReportFullDto,
	NewnessTypeDto,
} from '../../interfaces/api/newness';
import type { ReasonDto, RecordReasonDto } from '../../interfaces/api/reasons';
import type { TimeRecordDto } from '../../interfaces/api/timeRecords';
import type { Cargo, EmpleadoAdmin } from '../../interfaces/empleados';
import type { NovedadTienda, TipoNovedad } from '../../interfaces/novedades';
import type { Motivo } from '../../interfaces/registro';
import type { Tienda } from '../../interfaces/tiendas';
import type { RegistroEditado } from '../../interfaces/ui/monitoreo';
import { getEmpleadosBulk, getStoreClosedDays } from './readBulk';
import { idRelacion } from './relacion';

export { getStoreClosedDays };

// Tienda "Oficina" usada para pruebas.
export const STORE_PRUEBAS = 90;

export async function getStoreIdUsuarioActual(): Promise<number | null> {
	try {
		const me = (await withAutoRefresh(() =>
			directus.request(readMe({ fields: ['store_id', 'store.id'] })),
		)) as UsuarioActualDto | null;
		const raw = me?.store_id ?? me?.store?.id ?? null;
		const num = Number(idRelacion(raw));
		return Number.isFinite(num) && num > 0 ? num : null;
	} catch (error) {
		console.error('❌ Error obteniendo store_id del usuario (readMe):', error);
		return null;
	}
}

/**
 * Reutiliza getEmpleadosBulk([storeId]) para evitar duplicar código de mapeo de empleados.
 */
export async function getEmpleados(
	storeId: number,
): Promise<EmpleadoAsistencia[]> {
	return getEmpleadosBulk([storeId]);
}

export async function getTiposNovedad(): Promise<TipoNovedad[]> {
	try {
		const items = (await withAutoRefresh(() =>
			directus.request(
				readItems('com_newness', {
					fields: ['id', 'name'],
				}),
			),
		)) as NewnessTypeDto[];
		return (items || []).map((t) => ({
			id: t.id,
			nombre: t.name ?? '',
			name: t.name ?? '',
		}));
	} catch (error) {
		console.error('❌ Error cargando com_newness:', error);
		return [];
	}
}

export async function getReasons(): Promise<Motivo[]> {
	try {
		const items = (await withAutoRefresh(() =>
			directus.request(
				readItems('com_reasons', {
					fields: ['id', 'name'],
					filter: { status: { _eq: true } },
					sort: ['name'],
					limit: -1,
				}),
			),
		)) as ReasonDto[];
		const motivos = (items || []).map((r) => ({
			id: Number(r.id),
			name: r.name || '',
		}));
		return motivos.sort((a: Motivo, b: Motivo) => {
			const aOtro = a.name.trim().toLowerCase() === 'otro';
			const bOtro = b.name.trim().toLowerCase() === 'otro';
			if (aOtro !== bOtro) return aOtro ? 1 : -1;
			return a.name.localeCompare(b.name);
		});
	} catch (error) {
		console.error('❌ Error cargando com_reasons:', error);
		return [];
	}
}

export async function getReasonNamesForRecords(
	recordIds: number[],
): Promise<Map<number, string>> {
	const mapa = new Map<number, string>();
	if (!recordIds || recordIds.length === 0) return mapa;
	try {
		const items = (await withAutoRefresh(() =>
			directus.request(
				readItems('com_records_reasons', {
					fields: ['records_id', 'reasons_id.name'],
					filter: { records_id: { _in: recordIds } },
					limit: -1,
				}),
			),
		)) as RecordReasonDto[];
		(items || []).forEach((it) => {
			const rid = idRelacion(it.records_id) ?? Number.NaN;
			const motivo = it.reasons_id;
			const nombre =
				motivo != null && typeof motivo === 'object'
					? (motivo.name ?? null)
					: null;
			if (Number.isFinite(rid) && nombre) mapa.set(rid, nombre);
		});
		return mapa;
	} catch (error) {
		console.error('❌ Error obteniendo motivos de los registros:', error);
		return mapa;
	}
}

export async function getRecordReasonId(
	recordId: number,
): Promise<number | null> {
	try {
		const items = (await withAutoRefresh(() =>
			directus.request(
				readItems('com_records_reasons', {
					fields: ['reasons_id'],
					filter: { records_id: { _eq: recordId } },
					limit: 1,
				}),
			),
		)) as RecordReasonDto[];
		const raw = (items || [])[0]?.reasons_id;
		if (raw == null) return null;
		return idRelacion(raw);
	} catch (error) {
		console.error('❌ Error obteniendo motivo del registro:', error);
		return null;
	}
}

/** Fecha de una novedad: `report_date` o, si falta, la de creación. */
const fechaNovedad = (nov: NewnessReportFullDto): string =>
	nov.report_date ||
	(nov.date_created ? dayjs(nov.date_created).format('YYYY-MM-DD') : '');

/** `com_newness_reports` expandido → `NovedadTienda` (lo comparten las dos consultas). */
function mapearNovedadTienda(
	nov: NewnessReportFullDto,
	conDocumento: boolean,
): NovedadTienda {
	const emp: Partial<EmployeeDto> = nov.employee_id || {};
	const fullName = [
		emp.first_name,
		emp.middle_name,
		emp.last_name,
		emp.second_last_name,
	]
		.filter(Boolean)
		.join(' ');
	const fecha = fechaNovedad(nov);
	return {
		...nov,
		id: nov.id,
		fecha,
		report_date: fecha,
		employee_id: emp,
		empleadoId: emp.id,
		empleadoNombre: fullName || `Empleado #${emp.id || ''}`,
		...(conDocumento
			? {
					empleadoDocumento: emp.document_number
						? String(emp.document_number)
						: undefined,
				}
			: {}),
		tipo: nov.newness_id?.name || 'Novedad',
		observaciones: nov.observations || '',
		empleadoActivo: emp.status === 'Activo',
		tiendaNombre: nov.store_id?.name || '',
	};
}

/**
 * Reutiliza getStoreNovedades para evitar duplicar código de la tabla com_newness_reports.
 */
export async function getNovedades(storeId: number): Promise<NovedadTienda[]> {
	try {
		const filter: FiltroDirectus = {};
		if (storeId != null && Number(storeId) > 0) {
			filter.store_id = { _eq: storeId };
		}
		const items = (await withAutoRefresh(() =>
			directus.request(
				readItems('com_newness_reports', {
					fields: ['*', 'newness_id.*', 'employee_id.*', 'store_id.*'],
					filter,
					sort: ['-report_date', '-id'],
					limit: -1,
				}),
			),
		)) as NewnessReportFullDto[];
		return (items || []).map((nov) => mapearNovedadTienda(nov, false));
	} catch (error) {
		console.error('❌ Error al obtener novedades:', error);
		return [];
	}
}

export async function getStoreNovedades(
	storeId: number | number[] | null,
): Promise<NovedadTienda[]> {
	try {
		const filter: FiltroDirectus = {};
		if (
			storeId != null &&
			(Array.isArray(storeId) ? storeId.length > 0 : Number(storeId) > 0)
		) {
			if (Array.isArray(storeId)) {
				filter.store_id = { _in: storeId };
			} else {
				filter.store_id = { _eq: storeId };
			}
		}
		const items = (await withAutoRefresh(() =>
			directus.request(
				readItems('com_newness_reports', {
					fields: ['*', 'newness_id.*', 'employee_id.*', 'store_id.*'],
					filter,
					sort: ['-report_date', '-id'],
					limit: -1,
				}),
			),
		)) as NewnessReportFullDto[];
		return (items || []).map((nov) => mapearNovedadTienda(nov, true));
	} catch (error) {
		console.error('❌ Error cargando novedades por tienda:', error);
		return [];
	}
}

export const fetchTimeRecords = async (
	fechaInicio?: string,
	fechaFin?: string,
	storeId?: number | number[],
	employeeId?: number | string,
): Promise<TimeRecordDto[]> => {
	const filter: FiltroDirectus = {};

	if (
		storeId != null &&
		(Array.isArray(storeId) ? storeId.length > 0 : Number(storeId) > 0)
	) {
		if (Array.isArray(storeId)) {
			filter.store_id = { _in: storeId };
		} else {
			filter.store_id = { _eq: storeId };
		}
	}
	if (employeeId != null) {
		filter.employee_id = { _eq: Number(employeeId) };
	}
	const rangoFechas: OperadoresDirectus = {};
	if (fechaInicio) rangoFechas._gte = fechaInicio;
	if (fechaFin) rangoFechas._lte = fechaFin;
	if (fechaInicio || fechaFin) filter.record_date = rangoFechas;

	return (await withAutoRefresh(() =>
		directus.request(
			readItems('com_time_records', {
				fields: [
					'id',
					'record_date',
					'record_time',
					'original_record_time',
					'log_type',
					'employee_id.id',
					'employee_id.document_number',
					'employee_id.first_name',
					'employee_id.middle_name',
					'employee_id.last_name',
					'employee_id.second_last_name',
					'store_id.id',
					'store_id.name',
					'store_id.location',
					'observations',
					'photo',
					'location',
					'accuracy',
					'is_under_review',
					'review_reason',
				],
				filter,
				sort: ['-record_date'],
				limit: -1,
			}),
		),
	)) as TimeRecordDto[];
};

/**
 * Id de la marcación (empleado, log_type, fecha) si ya existe en Directus; null si no.
 * Consulta fresca, sin caché: la usa el registro para rechazar marcaciones repetidas
 * aunque se hayan hecho desde otro dispositivo. Los errores se propagan.
 */
export async function getMarcacionExistenteId(
	employeeId: number,
	logType: string,
	date: string,
): Promise<number | null> {
	const items = (await withAutoRefresh(() =>
		directus.request(
			readItems('com_time_records', {
				fields: ['id'],
				filter: {
					_and: [
						{ employee_id: { _eq: employeeId } },
						{ log_type: { _eq: logType } },
						{ record_date: { _eq: date } },
					],
				},
				limit: 1,
			}),
		),
	)) as { id: number }[];
	return items[0]?.id != null ? Number(items[0].id) : null;
}

/**
 * Reutiliza fetchTimeRecords(date, date, storeId) para evitar duplicar peticiones a com_time_records.
 */
export async function getTimeRecords(
	storeId: number,
	date: string,
): Promise<TimeRecordDto[]> {
	return fetchTimeRecords(date, date, storeId);
}

export async function getStores(): Promise<Tienda[]> {
	try {
		const data = await withAutoRefresh(() =>
			directus.request(
				readItems('core_stores', {
					fields: ['id', 'name', 'ultra_code', 'company'],
					sort: ['name'],
					limit: -1,
				}),
			),
		);
		return (data || []) as Tienda[];
	} catch (error) {
		console.error('❌ Error cargando core_stores:', error);
		return [];
	}
}

export async function getCargos(): Promise<Cargo[]> {
	try {
		const data = (await withAutoRefresh(() =>
			directus.request(
				readItems('core_positions', {
					fields: ['id', 'name'],
					sort: ['name'],
					limit: -1,
				}),
			),
		)) as PositionDto[];
		return (data || []).map((c) => ({
			id: c.id,
			name: c.name || 'Sin nombre',
		})) as Cargo[];
	} catch (error) {
		console.error('❌ Error cargando core_positions:', error);
		return [];
	}
}

export { idRelacion } from './relacion';

const mapEmpleadoAdmin = (emp: EmployeeDto): EmpleadoAdmin => ({
	id: emp.id,
	document_type: emp.document_type ?? null,
	document_number:
		emp.document_number != null ? String(emp.document_number) : null,
	first_name: emp.first_name ?? null,
	middle_name: emp.middle_name ?? null,
	last_name: emp.last_name ?? null,
	second_last_name: emp.second_last_name ?? null,
	store_id: idRelacion(emp.store_id),
	position_id: idRelacion(emp.position_id),
	position_name:
		(emp.position_id != null && typeof emp.position_id === 'object'
			? emp.position_id.name
			: null) ?? null,
	status: emp.status ?? null,
});

export async function listarEmpleadosTienda(
	storeId: number,
): Promise<EmpleadoAdmin[]> {
	try {
		const items = (await withAutoRefresh(() =>
			directus.request(
				readItems('adm_employees', {
					fields: [
						'id',
						'document_type',
						'document_number',
						'first_name',
						'middle_name',
						'last_name',
						'second_last_name',
						'store_id',
						'position_id.id',
						'position_id.name',
						'status',
					],
					filter: { store_id: { _eq: storeId } },
					sort: ['first_name', 'last_name'],
					limit: -1,
				}),
			),
		)) as EmployeeDto[];
		return (items || []).map(mapEmpleadoAdmin);
	} catch (error) {
		console.error('❌ Error listando empleados por tienda:', error);
		throw error;
	}
}

export async function listarTodosEmpleados(): Promise<EmpleadoAdmin[]> {
	try {
		const items = (await withAutoRefresh(() =>
			directus.request(
				readItems('adm_employees', {
					fields: [
						'id',
						'document_type',
						'document_number',
						'first_name',
						'middle_name',
						'last_name',
						'second_last_name',
						'store_id',
						'position_id.id',
						'position_id.name',
						'status',
					],
					sort: ['first_name', 'last_name'],
					limit: -1,
				}),
			),
		)) as EmployeeDto[];
		return (items || []).map(mapEmpleadoAdmin);
	} catch (error) {
		console.error('❌ Error listando todos los empleados:', error);
		throw error;
	}
}

export async function buscarEmpleados(query: string): Promise<EmpleadoAdmin[]> {
	const q = query.trim();
	if (!q) return [];
	try {
		const esNumero = /^\d+$/.test(q);
		const tokens = q.split(/\s+/).filter(Boolean);
		const filter: FiltroDirectus = esNumero
			? { document_number: { _eq: Number(q) } }
			: {
					_and: tokens.map((tok) => ({
						_or: [
							{ first_name: { _icontains: tok } },
							{ middle_name: { _icontains: tok } },
							{ last_name: { _icontains: tok } },
							{ second_last_name: { _icontains: tok } },
						],
					})),
				};

		const items = (await withAutoRefresh(() =>
			directus.request(
				readItems('adm_employees', {
					fields: [
						'id',
						'document_type',
						'document_number',
						'first_name',
						'middle_name',
						'last_name',
						'second_last_name',
						'store_id',
						'position_id.id',
						'position_id.name',
						'status',
					],
					filter,
					sort: ['first_name', 'last_name'],
					limit: 50,
				}),
			),
		)) as EmployeeDto[];
		return (items || []).map(mapEmpleadoAdmin);
	} catch (error) {
		console.error('❌ Error buscando empleados:', error);
		throw error;
	}
}

export async function existeDocumentoEmpleado(
	documentNumber: string,
): Promise<boolean> {
	const doc = documentNumber.trim();
	if (!doc) return false;
	try {
		const items = await withAutoRefresh(() =>
			directus.request(
				readItems('adm_employees', {
					fields: ['id'],
					filter: { document_number: { _eq: doc } },
					limit: 1,
				}),
			),
		);
		return !!(items && items.length > 0);
	} catch (error) {
		console.error('❌ Error verificando existencia de documento:', error);
		return false;
	}
}

export async function getEditedTimeRecords(
	storeIds: number[],
	startDate: string,
	endDate: string,
): Promise<RegistroEditado[]> {
	try {
		const filter: FiltroDirectus = {
			original_record_time: { _nnull: true },
			record_date: { _gte: startDate, _lte: endDate },
		};
		if (storeIds && storeIds.length > 0) {
			filter.store_id = { _in: storeIds };
		}

		const records = (await withAutoRefresh(() =>
			directus.request(
				readItems('com_time_records', {
					fields: [
						'id',
						'record_date',
						'record_time',
						'original_record_time',
						'log_type',
						'employee_id.id',
						'employee_id.first_name',
						'employee_id.middle_name',
						'employee_id.last_name',
						'employee_id.second_last_name',
						'store_id.id',
						'store_id.name',
						'observations',
					],
					filter,
					limit: -1,
					sort: ['-record_date'],
				}),
			),
		)) as TimeRecordDto[];

		if (!records || records.length === 0) return [];

		const recordIds = records.map((r) => r.id);
		const reasonsMap = await getReasonNamesForRecords(recordIds);

		return records.map((r): RegistroEditado => {
			const emp: Partial<NonNullable<TimeRecordDto['employee_id']>> =
				r.employee_id || {};
			const store: { id?: number; name?: string } =
				r.store_id != null && typeof r.store_id === 'object' ? r.store_id : {};
			const fullName = [
				emp.first_name,
				emp.middle_name,
				emp.last_name,
				emp.second_last_name,
			]
				.filter(Boolean)
				.join(' ');

			return {
				id: r.id,
				fecha: r.record_date,
				empleadoId: Number(emp.id),
				empleadoNombre: fullName || 'Empleado Desconocido',
				tiendaId: store.id,
				tiendaNombre: store.name || 'Sin Tienda',
				tipoRegistro: r.log_type,
				horaOriginal: r.original_record_time,
				horaModificada: r.record_time,
				motivo: reasonsMap.get(r.id) || 'Sin justificación',
				observaciones: r.observations || '',
			};
		});
	} catch (error) {
		console.error('❌ Error al obtener registros editados:', error);
		return [];
	}
}

export async function getPrimerPeriodoRegistro(): Promise<{
	year: number;
	month: number;
}> {
	try {
		const items = (await withAutoRefresh(() =>
			directus.request(
				readItems('com_time_records', {
					fields: ['record_date'],
					sort: ['record_date'],
					limit: 1,
				}),
			),
		)) as Pick<TimeRecordDto, 'record_date'>[];
		if (items && items.length > 0 && items[0].record_date) {
			const date = dayjs(items[0].record_date);
			const year = date.year();
			const month = date.month();
			if (!isNaN(year) && !isNaN(month)) {
				return { year, month };
			}
		}
	} catch (error) {
		console.error('❌ Error al obtener el primer período de registro:', error);
	}
	return { year: dayjs().year(), month: 0 };
}

// Reexportar todas las consultas bulk y reportes
export * from './readBulk';
export * from './reports';
