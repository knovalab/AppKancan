/**
 * Eventos que se guardan en `com_event_reports.event_type` (independientes de las
 * marcaciones). **No cambiar los valores**: reportes y conteos dependen de este texto.
 */
export const EVENTO = {
	iniciarPausaActiva: 'Iniciar Pausa Activa',
	terminarPausaActiva: 'Terminar Pausa Activa',
} as const;

export type EventoTipo = (typeof EVENTO)[keyof typeof EVENTO];

/** Eventos que el usuario puede elegir en el modal "Reporta un evento". */
export const EVENTOS_REPORTABLES: readonly EventoTipo[] = [
	EVENTO.iniciarPausaActiva,
];
