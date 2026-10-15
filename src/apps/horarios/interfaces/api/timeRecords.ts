import type { PuntoGeo } from '../../domain/ubicacion';

/** Fila de `com_time_records` con los `fields` que pide `fetchTimeRecords`. */
export interface TimeRecordDto {
	id: number;
	record_date: string;
	record_time: string;
	original_record_time: string | null;
	log_type: string;
	employee_id: {
		id?: number | string;
		document_number?: string | number | null;
		first_name: string;
		middle_name: string | null;
		last_name: string;
		second_last_name: string | null;
	} | null;
	store_id: { id: number; name: string } | string | null;
	observations: string | null;
	photo?: string | null;
	location?: PuntoGeo | null;
	/** @deprecated Registros anteriores a `location` (GeoJSON). */
	latitude?: number | null;
	/** @deprecated Registros anteriores a `location` (GeoJSON). */
	longitude?: number | null;
	accuracy?: number | null;
}

/** Entrada de `createTimeRecord`. La ubicación puede llegar como punto o como lat/lon sueltos. */
export interface CreateTimeRecordDto {
	employee_id: number;
	store_id?: number;
	log_type: string;
	record_date: string;
	record_time: string;
	observations?: string;
	latitude?: number | null;
	longitude?: number | null;
	location?: PuntoGeo | null;
	accuracy?: number | null;
	photo?: string | null;
}

/** Entrada de `updateTimeRecord`: solo se envían los campos definidos. */
export interface UpdateTimeRecordDto {
	observations?: string;
	record_time?: string;
	original_record_time?: string;
}
