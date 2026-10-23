import type { Relacion } from './relacion';

/** Entrada de `crearEmpleado` (`adm_employees`). */
export interface CreateEmployeeDto {
	document_type: string;
	document_number: string;
	first_name: string;
	middle_name?: string;
	last_name: string;
	second_last_name?: string;
	store_id: number;
	position_id: number;
}

/** Entrada de `actualizarEmpleado`: solo se envían los campos definidos. */
export interface UpdateEmployeeDto {
	store_id?: number;
	position_id?: number;
	status?: string;
	first_name?: string;
	middle_name?: string;
	last_name?: string;
	second_last_name?: string;
}

/** Fila de `adm_employees`. Los campos dependen de los `fields` pedidos; las relaciones pueden venir expandidas. */
export interface EmployeeDto {
	id: number;
	document_type?: string | null;
	document_number?: string | number | null;
	first_name?: string | null;
	middle_name?: string | null;
	last_name?: string | null;
	second_last_name?: string | null;
	status?: string | null;
	email?: string | null;
	phone_number?: string | null;
	store_id?: Relacion;
	position_id?: Relacion<{ id?: number | string; name?: string | null }>;
}

/** Fila de `core_positions`. */
export interface PositionDto {
	id: number;
	name: string | null;
}

/** `readMe()` con `fields: ['store_id', 'store.id']`. */
export interface UsuarioActualDto {
	store_id?: Relacion;
	store?: { id?: number | string } | null;
}
