import { LOG_TYPE, type LogType } from './marcaciones';
import { requiereVerificacion } from './reglas';

export type PasoPrevio = 'normas' | 'verificacion';

export interface ContextoPasos {
	/** La tarjeta demo (tour) no pasa por normas ni por cámara. */
	esDemo: boolean;
	/** Hay normas vigentes publicadas. */
	hayNormas: boolean;
}

export function pasosPrevios(
	marcacion: LogType,
	ctx: ContextoPasos,
): PasoPrevio[] {
	if (ctx.esDemo) return [];
	const pasos: PasoPrevio[] = [];
	if (marcacion === LOG_TYPE.inicioJornada && ctx.hayNormas)
		pasos.push('normas');
	if (requiereVerificacion(marcacion)) pasos.push('verificacion');
	return pasos;
}
