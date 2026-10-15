/** Estado de un día en el calendario de la tienda. */
export type EstadoDia =
	| 'completo'
	| 'parcial'
	| 'sin_registro'
	| 'tienda_cerrada';

/** Fila de la tabla de empleados del detalle de tienda (Monitoreo). */
export interface FilaEmpleadoDetalle {
	id: string;
	nombre: string;
	documento: string;
	cargo: string;
	inicioJornada: string | null;
	inicioAlmuerzo: string | null;
	finAlmuerzo: string | null;
	finJornada: string | null;
	estado: string;
	tieneNovedad: boolean;
	novedadTipo?: string;
	novedadObservacion?: string;
	novedadId?: string;
	horasDia: string;
	horasSemana: string;
}
