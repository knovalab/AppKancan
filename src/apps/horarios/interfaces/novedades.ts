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

export interface Novedad {
	id: string;
	empleadoId: string;
	empleadoNombre: string;
	empleadoDocumento?: string;
	tipo: string;
	fecha: string;
	description?: string;
	notes?: string;
	fechaRegistro: string;
}

export interface TipoNovedad {
	id: number;
	nombre: string;
	name: string;
}

export interface NovedadMapeada {
	id: string | number;
	fecha: string;
	empleadoNombre: string;
	tipo: string;
	observaciones: string;
	empleadoActivo?: boolean;
	empleadoDocumento?: string | null;
	tiendaNombre?: string;
}
