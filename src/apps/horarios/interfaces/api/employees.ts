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
