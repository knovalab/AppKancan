import { ESTADO_HORA_EXTRA, type EstadoHoraExtra } from './estados';

export interface RangoPeriodo {
	id: number;
	/** YYYY-MM-DD */
	start_date: string;
	end_date: string;
}

/** Periodo que contiene `hoy` (YYYY-MM-DD); `undefined` si no está creado. */
export const periodoVigente = <T extends RangoPeriodo>(
	periodos: readonly T[],
	hoy: string,
): T | undefined =>
	periodos.find((p) => p.start_date <= hoy && hoy <= p.end_date);

/**
 * Rezagada: sigue pendiente (o sugerida) y su día es anterior al periodo vigente.
 * Al aprobar se asigna siempre al periodo vigente, así que una aprobada nunca lo es.
 */
export function esRezagada(
	h: { work_date: string; status: EstadoHoraExtra; period_id?: unknown },
	vigente: RangoPeriodo | undefined,
): boolean {
	if (!vigente || h.period_id != null) return false;
	const abierta =
		h.status === ESTADO_HORA_EXTRA.pendiente ||
		h.status === ESTADO_HORA_EXTRA.sugerida;
	return abierta && h.work_date < vigente.start_date;
}
