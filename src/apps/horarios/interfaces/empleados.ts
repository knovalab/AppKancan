export interface Cargo {
	id: number;
	name: string;
}

export interface EmpleadoAdmin {
	id: number;
	document_type: string | null;
	document_number: string | null;
	first_name: string | null;
	middle_name: string | null;
	last_name: string | null;
	second_last_name: string | null;
	store_id: number | null;
	position_id: number | null;
	position_name?: string | null;
	status: string | null;
	email?: string;
	phone_number?: string;
}

export interface NuevoEmpleadoPayload {
	document_type: string;
	document_number: string;
	first_name: string;
	middle_name?: string;
	last_name: string;
	second_last_name?: string;
	store_id: number;
	position_id: number;
	email?: string;
	phone?: string;
}
