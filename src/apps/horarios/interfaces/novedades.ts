/** Novedad que se registra desde la tarjeta del empleado (una fila por día del rango). */
export interface NuevaNovedadInput {
	empleadoId: string;
	empleadoNombre: string;
	/** Nombre del tipo de novedad (com_newness.name). */
	tipo: string;
	fechaInicio: string;
	fechaFin: string;
	observaciones: string;
	fechaRegistro: string;
}
