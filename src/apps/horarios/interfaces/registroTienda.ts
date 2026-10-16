/**
 * Interface representing a store's daily operational time record:
 * "Registro_de_tienda" (com_time_record_store)
 */
export interface RegistroTienda {
	/** Identifier of the store (e.g. 90) */
	store_id: number;
	/** Name of the store (e.g. "Tienda Centro") */
	store_name: string;
	/** Formatted work day (e.g. "15/10/2026") */
	work_day: string;
	/** Raw ISO date string (YYYY-MM-DD) for sorting and filtering */
	work_day_raw: string;
	/** Opening datetime (e.g. "15/10/2026 07:45:00") or null if no opening registered */
	open_time: string | null;
	/** Opening time only (e.g. "07:45") */
	open_time_short: string | null;
	/** Closing datetime (e.g. "15/10/2026 20:15:00") or null if in progress/not registered */
	close_time: string | null;
	/** Closing time only (e.g. "20:15") */
	close_time_short: string | null;
	/** Operating duration in decimal hours (e.g. 12.50) */
	operative_time: number;
	/** Friendly duration label (e.g. "12h 30m") */
	operative_time_label: string;
	/** Name of the employee who opened the store */
	open_employee?: string;
	/** Name of the employee who closed the store */
	close_employee?: string;
	/** Total punches recorded for this store on this day */
	total_punches: number;
	/** Operational status of the store on this day */
	status:
		| 'completado'
		| 'en_operacion'
		| 'sin_abrir'
		| 'dia_cerrado'
		| 'sin_registros';
}
