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
	/** Id de la novedad (Directus lo devuelve numérico). */
	novedadId?: string | number;
	horasDia: string;
	horasSemana: string;
}

/** Marcación editada a mano, con su motivo (auditoría de Monitoreo). */
export interface RegistroEditado {
	id: number;
	fecha: string;
	empleadoId: number;
	empleadoNombre: string;
	tiendaId: number | undefined;
	tiendaNombre: string;
	tipoRegistro: string;
	horaOriginal: string | null;
	horaModificada: string;
	motivo: string;
	observaciones: string;
}
