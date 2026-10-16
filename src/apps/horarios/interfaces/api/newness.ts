import type { EmployeeDto } from './employees';
import type { Relacion } from './relacion';

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

/** Fila de `com_newness` (tipos de novedad). */
export interface NewnessTypeDto {
	id: number;
	name: string | null;
}

/** `com_newness_reports` con `fields: ['*', 'newness_id.*', 'employee_id.*', 'store_id.*']`. */
export interface NewnessReportFullDto {
	id: number;
	report_date: string | null;
	date_created: string | null;
	observations: string | null;
	newness_id: { id?: number; name?: string | null } | null;
	employee_id: EmployeeDto | null;
	store_id: { id?: number; name?: string | null } | null;
}

/** `com_newness_reports` de las consultas en lote (Planilla, Monitoreo). */
export interface NewnessBulkDto {
	id: number;
	report_date: string | null;
	store_id: Relacion;
	observations: string | null;
	employee_id: { id?: number | string } | null;
	newness_id: { name?: string | null } | null;
}

/** Novedades de un empleado (perfil de Admin). */
export interface EmployeeNewnessDto {
	id: number;
	report_date: string | null;
	date_created: string | null;
	observations: string | null;
	newness_id: { name?: string | null } | null;
}
