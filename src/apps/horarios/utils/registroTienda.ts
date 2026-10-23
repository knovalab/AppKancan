import dayjs from 'dayjs';
import type { TimeRecordStoreDto } from '../interfaces/api/timeRecordStore';
import type { TimeRecordDto } from '../interfaces/api/timeRecords';
import type { RegistroTienda } from '../interfaces/registroTienda';
import type { Tienda } from '../interfaces/tiendas';

export const formatNombreEmpleado = (
	emp: TimeRecordDto['employee_id'],
): string => {
	if (!emp) return 'Sin nombre';
	const parts = [
		emp.first_name,
		emp.middle_name,
		emp.last_name,
		emp.second_last_name,
	].filter((p) => p && String(p).trim().length > 0);
	return parts.length > 0 ? parts.join(' ').trim() : 'Sin nombre';
};

export const formatOperativeTimeLabel = (minutes: number): string => {
	if (minutes <= 0) return '0h 0m';
	const h = Math.floor(minutes / 60);
	const m = minutes % 60;
	return `${h}h ${m}m`;
};

/**
 * Converts duration in minutes to decimal hours rounded to 2 decimal places.
 * e.g. 90 -> 1.5, 450 -> 7.5
 */
export const calculateOperativeHours = (minutes: number): number => {
	if (!minutes || minutes <= 0) return 0;
	return Math.round((minutes / 60) * 100) / 100;
};

/**
 * Resolves operational minutes. Uses rawMinutes if provided (> 0),
 * otherwise calculates the duration difference in minutes between openTime and closeTime.
 */
export const calculateOperativeMinutes = (
	rawMinutes?: number | null,
	openTime?: string | null,
	closeTime?: string | null,
): number => {
	const parsedRaw = Number(rawMinutes);
	if (parsedRaw > 0) {
		return parsedRaw;
	}
	if (openTime && closeTime) {
		const start = dayjs(openTime);
		const end = dayjs(closeTime);
		if (start.isValid() && end.isValid()) {
			const diffMin = end.diff(start, 'minute');
			if (diffMin > 0) {
				return diffMin;
			}
		}
	}
	return 0;
};

/**
 * Evaluates store operational status based on opening and closing timestamps:
 * - No open_time -> 'sin_abrir'
 * - Has open_time but no close_time -> 'en_operacion'
 * - Has both open_time and close_time -> 'completado'
 */
export const determinarEstadoRegistroTienda = (
	openTime?: string | null,
	closeTime?: string | null,
): RegistroTienda['status'] => {
	if (!openTime) {
		return 'sin_abrir';
	}
	if (!closeTime) {
		return 'en_operacion';
	}
	return 'completado';
};

/**
 * Returns human-readable Spanish text representation for a store operational status.
 */
export const formatEstadoRegistroTienda = (
	status: RegistroTienda['status'],
): string => {
	switch (status) {
		case 'completado':
			return 'Completado';
		case 'en_operacion':
			return 'En Operación';
		case 'sin_abrir':
			return 'Sin abrir';
		case 'dia_cerrado':
			return 'Día Cerrado';
		case 'sin_registros':
			return 'Sin registros';
		default:
			return 'Sin abrir';
	}
};

/**
 * Extracts a readable user or employee name from varied API representations:
 * direct string, object with { first_name, last_name }, or { name }.
 */
export const extraerNombreUsuario = (u: unknown): string | undefined => {
	if (!u) return undefined;
	if (typeof u === 'string') return u.trim() || undefined;
	if (typeof u === 'object') {
		const obj = u as {
			first_name?: string;
			last_name?: string;
			name?: string;
		};
		const parts = [obj.first_name, obj.last_name].filter(Boolean);
		if (parts.length > 0) return parts.join(' ').trim();
		if (obj.name) return String(obj.name).trim();
	}
	return undefined;
};

/**
 * Formats or extracts the short time (HH:mm) from a datetime or time string.
 */
export const extraerHoraCorta = (timeStr?: string | null): string | null => {
	if (!timeStr) return null;
	const d = dayjs(timeStr);
	if (d.isValid() && timeStr.length > 5) {
		return d.format('HH:mm');
	}
	return timeStr.slice(11, 16) || timeStr.slice(0, 5) || null;
};

/**
 * Resolves numeric store ID and store display name from relation object/id and lookup map.
 */
export const resolverInfoTienda = (
	store: unknown,
	storesMap?: Map<number, string>,
): { storeId: number; storeName: string } => {
	const storeId =
		store && typeof store === 'object' && 'id' in store
			? Number((store as { id: unknown }).id)
			: Number(store);

	const validId = Number.isNaN(storeId) ? 0 : storeId;

	let storeName = storesMap?.get(validId);
	if (!storeName && store && typeof store === 'object' && 'name' in store) {
		storeName = String((store as { name: unknown }).name);
	}
	if (!storeName) {
		storeName = validId > 0 ? `Tienda #${validId}` : 'Tienda Desconocida';
	}

	return { storeId: validId, storeName };
};

export interface TiendasKPIStats {
	totalDays: number;
	totalOperativeHours: number;
	avgHoursPerDay: number;
	completedDays: number;
	inProgressDays: number;
}

/**
 * Calculates aggregated KPI metrics across a collection of store records.
 */
export const calculateTiendasKPIStats = (
	records: RegistroTienda[],
): TiendasKPIStats => {
	const totalDays = records.length;
	let totalOperativeHours = 0;
	let completedDays = 0;
	let inProgressDays = 0;

	for (const r of records) {
		totalOperativeHours += r.operative_time;
		if (r.status === 'completado') completedDays++;
		if (r.status === 'en_operacion') inProgressDays++;
	}

	const avgHours = totalDays > 0 ? totalOperativeHours / totalDays : 0;

	return {
		totalDays,
		totalOperativeHours: Math.round(totalOperativeHours * 100) / 100,
		avgHoursPerDay: Math.round(avgHours * 100) / 100,
		completedDays,
		inProgressDays,
	};
};

/**
 * Pure filter function for store records by search query string.
 */
export const filterRegistrosTienda = (
	records: RegistroTienda[],
	searchQuery: string,
): RegistroTienda[] => {
	if (!searchQuery.trim()) return records;
	const query = searchQuery.toLowerCase().trim();
	return records.filter((r) => {
		return (
			r.store_name.toLowerCase().includes(query) ||
			String(r.store_id).includes(query) ||
			r.work_date.includes(query) ||
			(r.open_employee?.toLowerCase().includes(query) ?? false) ||
			(r.close_employee?.toLowerCase().includes(query) ?? false)
		);
	});
};

export interface CalcularRegistrosTiendaOptions {
	stores?: Tienda[];
	closedDays?: { store_id: number | string; date: string }[];
}

/**
 * Maps a row from Directus table `com_time_record_store` to `RegistroTienda`.
 * Orchestrates pure helper functions for store resolution, date/time formatting,
 * operative time transformation, user name extraction, and status determination.
 */
export function mapearTimeRecordStoreDtoARegistroTienda(
	item: TimeRecordStoreDto,
	storesMap?: Map<number, string>,
): RegistroTienda {
	const { storeId, storeName } = resolverInfoTienda(item.store, storesMap);

	const workDateParsed = dayjs(item.work_date);
	const workDateFormatted = workDateParsed.isValid()
		? workDateParsed.format('DD/MM/YYYY')
		: item.work_date;

	const openTimeShort = extraerHoraCorta(item.open_time);
	const closeTimeShort = extraerHoraCorta(item.close_time);

	const operativeMinutes = calculateOperativeMinutes(
		item.operative_time,
		item.open_time,
		item.close_time,
	);
	const operativeHours = calculateOperativeHours(operativeMinutes);

	const openUser =
		extraerNombreUsuario(item.open_user) ||
		extraerNombreUsuario((item as { open_user_id?: unknown }).open_user_id);

	const closeUser =
		extraerNombreUsuario(item.close_user) ||
		extraerNombreUsuario((item as { close_user_id?: unknown }).close_user_id);

	const status = determinarEstadoRegistroTienda(
		item.open_time,
		item.close_time,
	);

	return {
		store_id: storeId,
		store_name: storeName,
		work_date: workDateFormatted,
		work_date_raw: item.work_date,
		open_time: item.open_time || null,
		open_time_short: openTimeShort,
		close_time: item.close_time || null,
		close_time_short: closeTimeShort,
		operative_time: operativeHours,
		operative_time_label: formatOperativeTimeLabel(operativeMinutes),
		open_employee: openUser,
		close_employee: closeUser,
		total_punches: 0,
		status,
	};
}
