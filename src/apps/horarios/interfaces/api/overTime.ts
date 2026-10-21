import type { EstadoHoraExtra } from '../../domain/horasExtras';
import type { Relacion } from './relacion';

/** Usuario de Directus (`directus_users`) tal como se expande en las filas. */
type UsuarioDirectus = Relacion<{
	id: string;
	first_name?: string | null;
	last_name?: string | null;
}>;

/** Fila de `com_over_time` (horas extras). */
export interface OverTimeDto {
	id: number;
	employee_id: Relacion<{
		id: number;
		first_name?: string | null;
		last_name?: string | null;
		document_number?: string | number | null;
		/** Tienda del empleado (puede diferir de la tienda donde trabajó). */
		store_id?: Relacion;
	}>;
	store_id: Relacion<{ id: number | string; name?: string | null }>;
	/** YYYY-MM-DD */
	work_date: string;
	/** Minutos, en bloques de 30. */
	minutes: number;
	status: EstadoHoraExtra;
	observations?: string | null;
	/** Motivo del rechazo del comercial. */
	review_note?: string | null;
	/** Instante de la aprobación o del rechazo (Timestamp, UTC). */
	reviewed_at?: string | null;
	created_at?: string | null;
	created_by?: UsuarioDirectus;
	updated_at?: string | null;
	/** Lo llena Directus (*User Updated*): en una fila revisada, el comercial que decidió. */
	updated_by?: UsuarioDirectus;
	/** Periodo de nómina; lo escribe nómina al liquidar. */
	period_id?: Relacion<{ id: number; start_date?: string; end_date?: string }>;
}

/** Entrada de `crearHoraExtra`: siempre entra en `pendiente`. */
export interface CreateOverTimeDto {
	employee_id: number;
	store_id: number;
	work_date: string;
	minutes: number;
	observations?: string;
}

/** Edición del líder mientras está `pendiente`. */
export interface UpdateOverTimeDto {
	store_id?: number;
	minutes?: number;
	observations?: string;
}

/** Decisión del comercial sobre una o varias pendientes. */
export interface ReviewOverTimeDto {
	decision: 'aprobada' | 'descartada_comercial';
	/** Obligatorio al rechazar. */
	nota?: string;
}
