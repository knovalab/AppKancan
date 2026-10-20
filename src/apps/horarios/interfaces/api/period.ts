/** Fila de `com_period` (quincenas). */
export interface PeriodDto {
	id: number;
	name?: string | null;
	/** YYYY-MM-DD */
	start_date: string;
	end_date: string;
	liquidacion_date?: string | null;
	created_at?: string | null;
}
