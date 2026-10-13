/**
 * Estados de la jornada de un empleado en el registro del día.
 *
 * El estado no se guarda en Directus: se deduce de las marcaciones registradas
 * (ver `estadoResultante` en `marcaciones.ts`).
 */
export const ESTADO = {
	entradaPendiente: 'entrada_pendiente',
	jornadaIniciada: 'jornada_iniciada',
	enAlmuerzo: 'en_almuerzo',
	regresoAlmuerzo: 'regreso_almuerzo',
	jornadaFinalizada: 'jornada_finalizada',
} as const;

export type EstadoAsistencia = (typeof ESTADO)[keyof typeof ESTADO];

/** Texto del chip de estado en la tarjeta del empleado. */
export const ETIQUETA_ESTADO: Record<EstadoAsistencia, string> = {
	entrada_pendiente: 'ENTRADA PENDIENTE',
	jornada_iniciada: 'JORNADA INICIADA',
	en_almuerzo: 'EN ALMUERZO',
	regreso_almuerzo: 'REGRESO ALMUERZO',
	jornada_finalizada: 'JORNADA FINALIZADA',
};
