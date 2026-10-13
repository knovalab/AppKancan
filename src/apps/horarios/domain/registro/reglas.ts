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
