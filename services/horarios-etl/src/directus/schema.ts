/**
 * Colecciones que usa el ETL, con los nombres y tipos reales de Directus
 * (verificados en src/apps/horarios/results/ETL_DIRECTUS_ESQUEMA_ANALISIS.md).
 * Un campo mal escrito en `fields` o `filter` es un error de compilación, no un 403.
 */

/** Relación M2O: el id o el objeto expandido, según los `fields` pedidos. */
type M2O<Id, T> = Id | T | null;

export interface Tienda {
	/** El id de las tiendas es texto ("90"), no número. */
	id: string;
	name: string | null;
	ultra_code: number | null;
	company: string | null;
}

export interface Empleado {
	id: number;
	/** Big Integer: Directus lo devuelve como texto. */
	document_number: string | null;
	first_name: string;
	middle_name: string | null;
	last_name: string;
	second_last_name: string | null;
	store_id: M2O<string, Tienda>;
	position_id: number | null;
	status: string | null;
}

export interface Marcacion {
	id: number;
	employee_id: M2O<number, Empleado>;
	store_id: M2O<string, Tienda>;
	log_type: string;
	/** Date: 'YYYY-MM-DD' */
	record_date: string;
	/** Time: 'HH:mm:ss' */
	record_time: string;
	original_record_time: string | null;
	observations: string | null;
}

export interface DiaCerrado {
	id: number;
	store_id: M2O<string, Tienda>;
	date: string;
	status: boolean | null;
}

export interface Novedad {
	id: number;
	employee_id: M2O<number, Empleado>;
	store_id: M2O<string, Tienda>;
	newness_id: number | null;
	report_date: string | null;
}

export interface RegistroTienda {
	id: number;
	store: M2O<string, Tienda>;
	/** Date: 'YYYY-MM-DD' */
	work_day: string | null;
	/** DateTime sin zona, hora local de Bogotá: 'YYYY-MM-DDTHH:mm:ss' */
	open_time: string | null;
	close_time: string | null;
	/** Minutos */
	operative_time: number | null;
	/** UUID de directus_users */
	open_user: string | null;
	close_user: string | null;
	user_created: string | null;
	date_created: string | null;
	date_updated: string | null;
}

export interface Periodo {
	id: number;
	start_date: string | null;
	end_date: string | null;
	created_at: string | null;
	created_by: string | null;
}

export type EstadoHoraExtra = 'Gen' | 'Req' | 'Aprov' | 'Decl';

export interface HoraExtra {
	id: number;
	employee_id: M2O<number, Empleado>;
	store_id: M2O<string, Tienda>;
	minutes: number | null;
	status: EstadoHoraExtra | null;
	approval_at: string | null;
	period_id: M2O<number, Periodo>;
	created_at: string | null;
	created_by: string | null;
}

/** La clave es el nombre exacto de la colección en Directus. */
export interface Schema {
	adm_employees: Empleado[];
	core_stores: Tienda[];
	com_time_records: Marcacion[];
	com_store_closed_days: DiaCerrado[];
	com_newness_reports: Novedad[];
	com_time_record_store: RegistroTienda[];
	com_period: Periodo[];
	com_over_time: HoraExtra[];
}
