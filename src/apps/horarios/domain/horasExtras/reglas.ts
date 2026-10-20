import { MAX_CARACTERES_OBSERVACION } from '../registro/reglas';
import { ESTADOS_ACTIVOS, type EstadoHoraExtra } from './estados';

/** Las horas extras se registran en bloques de media hora */
export const BLOQUE_MINUTOS = 30;

export interface HoraExtraBorrador {
	/** YYYY-MM-DD */
	workDate: string;
	minutos: number;
	observacion?: string;
}

export interface ContextoValidacion {
	/** YYYY-MM-DD (`getRealColombiaTime`). */
	hoy: string;
	empleadoActivo: boolean;
	empleadoDelLider: boolean;
}

export type ErroresHoraExtra = Partial<
	Record<'workDate' | 'minutos' | 'observacion' | 'empleado', string>
>;

/** Errores del formulario; objeto vacío si es válido. */
export function validarHoraExtra(
	b: HoraExtraBorrador,
	ctx: ContextoValidacion,
): ErroresHoraExtra {
	const errores: ErroresHoraExtra = {};
	if (!/^\d{4}-\d{2}-\d{2}$/.test(b.workDate))
		errores.workDate = 'La fecha es obligatoria';
	else if (b.workDate > ctx.hoy)
		errores.workDate = 'No se pueden registrar horas extras de días futuros';

	if (!Number.isInteger(b.minutos) || b.minutos <= 0)
		errores.minutos = 'Las horas extras deben ser mayores que cero';
	else if (b.minutos % BLOQUE_MINUTOS !== 0)
		errores.minutos = 'Las horas extras van en bloques de media hora';

	if ((b.observacion?.length ?? 0) > MAX_CARACTERES_OBSERVACION)
		errores.observacion = `Máximo ${MAX_CARACTERES_OBSERVACION} caracteres`;

	if (!ctx.empleadoActivo) errores.empleado = 'El empleado no está activo';
	else if (!ctx.empleadoDelLider)
		errores.empleado = 'El empleado no pertenece a tus tiendas';
	return errores;
}

/** Otra hora extra activa entre `existentes` (las del mismo empleado y día). Es un aviso: no bloquea. */
export function buscarDuplicado<
	T extends { id: number; status: EstadoHoraExtra },
>(existentes: readonly T[], excluirId?: number): T | undefined {
	return existentes.find(
		(h) => h.id !== excluirId && ESTADOS_ACTIVOS.includes(h.status),
	);
}

/** 90 → "1 h 30 min". */
export function formatoMinutos(minutos: number): string {
	const h = Math.floor(minutos / 60);
	const m = minutos % 60;
	if (h === 0) return `${m} min`;
	return m === 0 ? `${h} h` : `${h} h ${m} min`;
}
