import type { EventoTipo, LogType } from '../domain/registro';
import type { Resultado } from './comunes';
import type { NuevaNovedadInput } from './novedades';
import type { VerificationData } from './verificacion';

/** Entradas de las acciones del registro (hooks/registro/useAccionesRegistro). */

export interface RegistrarInput {
	empleadoId: number;
	marcacion: LogType;
	/** Foto + GPS del modal de verificación (ausente en las marcaciones sin verificación). */
	verificacion?: VerificationData;
	observacion?: string;
}

export interface EditarHoraInput {
	recordId: number;
	/** '08:05 PM' o '20:05'; se guarda sobre la fecha del propio registro. */
	hora: string;
	motivoId?: number | null;
	/** undefined = no se toca la observación guardada. */
	observacion?: string;
}

export interface ObservarInput {
	recordId: number;
	texto: string;
}

export interface ReportarEventoInput {
	empleadoId: number;
	tipo: EventoTipo;
	observacion?: string;
}

/**
 * Todo lo que una tarjeta de empleado puede pedir. La implementa la página:
 * `useAccionesTarjeta` (Directus) y `useAccionesDemo` (en memoria, para el tour).
 * La tarjeta no sabe cuál recibe. Ninguna lanza: todas devuelven `Resultado`.
 */
export interface AccionesTarjeta {
	registrar(input: {
		empleadoId: string;
		marcacion: LogType;
		verificacion?: VerificationData;
	}): Promise<Resultado>;
	editarHora(input: {
		empleadoId: string;
		marcacion: LogType;
		/** 'hh:mm A', como lo entrega EditHourModal. */
		hora: string;
		motivoId: number | null;
		observacion: string;
	}): Promise<Resultado>;
	observar(input: {
		empleadoId: string;
		marcacion: LogType;
		texto: string;
	}): Promise<Resultado>;
	reportarEvento(input: {
		empleadoId: string;
		tipo: EventoTipo;
		observacion?: string;
	}): Promise<Resultado>;
	agregarNovedad(input: NuevaNovedadInput): Promise<Resultado>;
	/** Consulta fresca (sin caché): ¿aceptó las normas vigentes? */
	verificarNormas(empleadoId: string): Promise<boolean>;
	aceptarNormas(empleadoId: string): Promise<Resultado>;
	/** Motivo guardado de una marcación ya editada (para precargar EditHourModal). */
	motivoDeMarcacion(input: {
		empleadoId: string;
		marcacion: LogType;
	}): Promise<number | null>;
}

/** Motivo de edición de una hora (`com_reasons`). */
export interface Motivo {
	id: number;
	name: string;
}
