/**
 * Empleado ficticio del modo demo y del tour. Nunca se guarda en Directus.
 */
export const ID_EMPLEADO_DEMO = '99999';

export const esEmpleadoDemo = (id: string | number): boolean =>
	String(id) === ID_EMPLEADO_DEMO;
