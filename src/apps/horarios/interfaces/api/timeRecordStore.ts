import type { Relacion } from './relacion';

/**
 * Representation of a row in the Directus collection `com_time_record_store`
 * ("Registro_de_tienda").
 */
export interface TimeRecordStoreDto {
	id: number;
	/** Store reference (relational object or numeric id) */
	store: Relacion<{ id: number; name: string }>;
	/** Work day in ISO format YYYY-MM-DD */
	work_date: string;
	/** Opening timestamp (datetime, e.g. "2026-10-15T07:45:00") or null if not yet opened */
	open_time: string | null;
	/** Closing timestamp (datetime, e.g. "2026-10-15T20:15:00" or null if still open) */
	close_time: string | null;
	/** Operating time in minutes (number, e.g. 600 minutes = 10 hours) */
	operative_time: number;
	/** User/Employee who performed the store opening */
	open_user?: Relacion<{
		id: number | string;
		first_name?: string;
		last_name?: string;
		name?: string;
	}>;
	/** User/Employee who performed the store closing */
	close_user?: Relacion<{
		id: number | string;
		first_name?: string;
		last_name?: string;
		name?: string;
	}>;
	/** Creation timestamp */
	date_created?: string;
	/** Last update timestamp */
	date_updated?: string;
}
