import type { EventoTipo } from '../../domain/registro';
import type { Relacion } from './relacion';

/** Fila de `com_event_reports` tal como la leen las consultas del día. */
export interface EventReportHoyDto {
	id: number;
	employee_id: Relacion;
	event_type: EventoTipo | string;
	date: string;
}

/** Fila de `com_event_reports` para la exportación de eventos. */
export interface EventReportExportDto {
	event_type: string;
	date: string | null;
	hour: string | null;
	observations: string | null;
	store_id: string | number | null;
	employee_id: {
		document_number?: string | number | null;
		first_name: string;
		middle_name: string | null;
		last_name: string;
		second_last_name: string | null;
	} | null;
}

/** Entrada de `createEventReport`. */
export interface CreateEventReportDto {
	employee_id: number;
	store_id?: number;
	event_type: string;
	observations?: string;
	date?: string;
	hour?: string;
}

/** Eventos de un empleado (perfil de Admin). */
export interface EmployeeEventReportDto {
	id: number;
	event_type: string;
	date: string | null;
	hour: string | null;
	observations: string | null;
}

/** Eventos de una o varias tiendas (reporte de pausas). */
export interface StoreEventReportDto extends EmployeeEventReportDto {
	date_created: string | null;
	employee_id: {
		id?: number | string;
		first_name?: string | null;
		middle_name?: string | null;
		last_name?: string | null;
		second_last_name?: string | null;
		document_number?: string | number | null;
	} | null;
	store_id: { id?: number; name?: string | null } | null;
}
