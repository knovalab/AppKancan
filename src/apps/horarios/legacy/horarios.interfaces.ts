import type {
	EstadoAsistencia,
	EventoTipo,
	LogType,
	MarcacionKey,
} from '../domain/registro';

/** Datos opcionales por marcación (solo existen si la marcación está registrada). */
type PorMarcacion<T> = Partial<Record<MarcacionKey, T>>;

/**
 * Marcaciones del día de un empleado. Las 4 horas (`inicioJornada`, …) vienen del
 * catálogo `MARCACIONES`; los contenedores siempre existen (pueden estar vacíos).
 */
export type RegistrosAsistencia = Record<MarcacionKey, string | null> & {
	observaciones: PorMarcacion<string>;
	ids: PorMarcacion<number>;
	horasOriginales: PorMarcacion<string | null>;
	horasEditadas: PorMarcacion<string | null>;
};

export interface EmpleadoAsistencia {
	/** Id de `adm_employees` como string (la BD usa number; se convierte en la API). */
	id: string;
	documento: string;
	nombre: string;
	cargo?: string;
	estadoActual: EstadoAsistencia;
	registros: RegistrosAsistencia;
	pausasActivasCount?: number;
	storeId?: number | null;
}

/** Fila de `com_event_reports` tal como la leen las consultas del día. */
export interface EventReportHoy {
	id: number;
	employee_id: { id: number | string } | number | string | null;
	event_type: EventoTipo | string;
	date: string;
}

export type { EstadoAsistencia, EventoTipo, LogType, MarcacionKey };

export interface ObservacionEvento {
	evento: string;
	hora: string | null;
	observacion: string;
}

export interface GeoJsonPoint {
	type: 'Point';
	coordinates: [number, number]; // [longitude, latitude]
}

export interface HistorialEventoDetalle {
	evento: string;
	hora: string | null;
	observacion?: string;
	photo?: string | null;
	location?: GeoJsonPoint | null;
	latitude?: number | null;
	longitude?: number | null;
	accuracy?: number | null;
}

export interface HistorialRow {
	fecha: string;
	empleado: string;
	documento?: string | null;
	inicio_turno: string | null;
	inicio_almuerzo: string | null;
	fin_almuerzo: string | null;
	fin_turno: string | null;
	observaciones_evento: ObservacionEvento[];
	eventos_detalle?: HistorialEventoDetalle[];
	tiendaNombre?: string;
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

export interface Motivo {
	id: number;
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

export interface Tienda {
	id: number;
	name: string;
	ultra_code?: string | number;
	company?: string;
}

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
