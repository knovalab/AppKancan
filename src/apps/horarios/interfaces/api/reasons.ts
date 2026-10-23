import type { Relacion } from './relacion';

/** Fila de `com_reasons` (motivos de edición de hora). */
export interface ReasonDto {
	id: number | string;
	name: string | null;
}

/** Fila de `com_records_reasons` (motivo asignado a una marcación). */
export interface RecordReasonDto {
	id?: number;
	records_id?: Relacion;
	reasons_id?: Relacion<{ id: number | string; name?: string | null }>;
}
