import type { EstadoAsistencia } from './estados';
import type { MarcacionKey } from './marcaciones';

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

/** Empleado con su asistencia del día, tal como la consume el registro. */
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

/** Lo mínimo de una fila de `com_time_records` que necesita el registro. */
export interface MarcacionCruda {
	id: number;
	log_type: string;
	record_time: string | null;
	original_record_time?: string | null;
	observations?: string | null;
}
