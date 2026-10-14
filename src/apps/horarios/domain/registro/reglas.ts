import { LOG_TYPE, type LogType } from './marcaciones';

/**
 * Reglas de negocio del registro de horarios que antes estaban como números
 * sueltos en los componentes. Cambiar un valor aquí lo cambia en toda la app.
 */

/** Pausas activas que puede completar un empleado por día. */
export const MAX_PAUSAS_ACTIVAS = 2;

/** Duración del temporizador de pausa activa (ms). */
export const DURACION_PAUSA_ACTIVA_MS = 5 * 60 * 1000;

/** Longitud máxima de una observación (marcación o evento). */
export const MAX_CARACTERES_OBSERVACION = 300;

/** Mínimo de caracteres de la nota cuando el motivo de edición de hora es "Otro". */
export const MIN_CARACTERES_NOTA_MOTIVO_OTRO = 15;

/**
 * Eventos que requieren obligatoriamente verificación con fotografía y geolocalización GPS.
 * Limitado a "comenzar" (inicio de jornada) y "terminar" (fin de jornada).
 */
export const EVENTOS_CON_VERIFICACION: readonly LogType[] = [
	LOG_TYPE.inicioJornada,
	LOG_TYPE.finJornada,
] as const;

/** Indica si un tipo de evento requiere captura de fotografía y GPS. */
export function requiereVerificacion(tipoEvento: LogType): boolean {
	return EVENTOS_CON_VERIFICACION.includes(tipoEvento);
}
