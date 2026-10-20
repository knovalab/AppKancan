/**
 * Estados de una hora extra (`com_over_time.status`)
 */
export const ESTADO_HORA_EXTRA = {
	sugerida: 'sugerida',
	pendiente: 'pendiente',
	descartadaLider: 'descartada_lider',
	descartadaComercial: 'descartada_comercial',
	aprobada: 'aprobada',
} as const;

export type EstadoHoraExtra =
	(typeof ESTADO_HORA_EXTRA)[keyof typeof ESTADO_HORA_EXTRA];

export const ESTADOS_HORA_EXTRA = Object.values(
	ESTADO_HORA_EXTRA,
) as readonly EstadoHoraExtra[];

/** Texto del chip de estado. */
export const ETIQUETA_ESTADO_HORA_EXTRA: Record<EstadoHoraExtra, string> = {
	sugerida: 'Sugerida',
	pendiente: 'Pendiente',
	descartada_lider: 'Descartada por el líder',
	descartada_comercial: 'Rechazada',
	aprobada: 'Aprobada',
};

/** Estados en los que la fila ya no cambia. */
export const ESTADOS_FINALES: readonly EstadoHoraExtra[] = [
	ESTADO_HORA_EXTRA.descartadaLider,
	ESTADO_HORA_EXTRA.descartadaComercial,
	ESTADO_HORA_EXTRA.aprobada,
];

/** Estados que cuentan para detectar un duplicado (empleado + día). */
export const ESTADOS_ACTIVOS: readonly EstadoHoraExtra[] = [
	ESTADO_HORA_EXTRA.sugerida,
	ESTADO_HORA_EXTRA.pendiente,
	ESTADO_HORA_EXTRA.aprobada,
];

export const esEstadoHoraExtra = (valor: unknown): valor is EstadoHoraExtra =>
	typeof valor === 'string' &&
	(ESTADOS_HORA_EXTRA as readonly string[]).includes(valor);

export const esEstadoFinal = (estado: EstadoHoraExtra): boolean =>
	ESTADOS_FINALES.includes(estado);
