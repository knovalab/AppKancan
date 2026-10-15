/** Fila de `com_newness_reports` para la exportación de novedades. */
export interface NewnessReportDto {
	id: number;
	report_date: string | null;
	date_created: string | null;
	observations: string | null;
	newness_id: { name?: string | null } | null;
	store_id: string | number | null;
	employee_id: {
		document_number?: string | number | null;
		first_name: string;
		middle_name: string | null;
		last_name: string;
		second_last_name: string | null;
	} | null;
}

/** Entrada de `createNovedad` / `createNovedades` (una fila por día). */
export interface CreateNewnessReportDto {
	employee_id: number;
	newness_id: number;
	report_date: string;
	observations?: string;
	store_id?: number;
}
