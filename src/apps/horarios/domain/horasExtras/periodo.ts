import dayjs from 'dayjs';
import { ESTADO_HORA_EXTRA, type EstadoHoraExtra } from './estados';

export const ESTADO_PERIODO = {
	preliquidado: 'preliquidado',
	liquidado: 'liquidado',
} as const;

export type EstadoPeriodo =
	(typeof ESTADO_PERIODO)[keyof typeof ESTADO_PERIODO];

export const ETIQUETA_ESTADO_PERIODO: Record<EstadoPeriodo, string> = {
	preliquidado: 'Preliquidado',
	liquidado: 'Liquidado',
};

/** Accesos rápidos de duración al crear un periodo. */
export const DIAS_RAPIDOS = [5, 10, 15] as const;

export interface RangoPeriodo {
	id: number;
	/** YYYY-MM-DD, ambos incluidos. */
	start_date: string;
	end_date: string;
	status: EstadoPeriodo;
}

const FECHA = /^\d{4}-\d{2}-\d{2}$/;

/** YYYY-MM-DD + n días. */
export const sumarDias = (fecha: string, dias: number): string =>
	dayjs(fecha).add(dias, 'day').format('YYYY-MM-DD');

/** Fin de un periodo de `dias` días que empieza en `inicio` (incluido). */
export const finPorDias = (inicio: string, dias: number): string =>
	sumarDias(inicio, dias - 1);

/** Días del periodo, ambos extremos incluidos. */
export const duracionDias = (inicio: string, fin: string): number =>
	dayjs(fin).diff(dayjs(inicio), 'day') + 1;

/** Sin huecos: el día siguiente al fin del último periodo; `null` si no hay ninguno (inicio libre). */
export function siguienteInicio(
	periodos: readonly Pick<RangoPeriodo, 'end_date'>[],
): string | null {
	if (periodos.length === 0) return null;
	const ultimo = periodos.reduce((max, p) =>
		p.end_date > max.end_date ? p : max,
	);
	return sumarDias(ultimo.end_date, 1);
}

export type ErroresPeriodo = Partial<Record<'inicio' | 'fin', string>>;

/** Errores al crear un periodo; objeto vacío si es válido. */
export function validarPeriodo(
	nuevo: { inicio: string; fin: string },
	periodos: readonly Pick<RangoPeriodo, 'end_date'>[],
): ErroresPeriodo {
	const errores: ErroresPeriodo = {};
	const esperado = siguienteInicio(periodos);
	if (!FECHA.test(nuevo.inicio))
		errores.inicio = 'La fecha de inicio es obligatoria';
	else if (esperado && nuevo.inicio !== esperado)
		errores.inicio = `El periodo debe empezar el ${esperado}, el día siguiente al último`;

	if (!FECHA.test(nuevo.fin)) errores.fin = 'La fecha de fin es obligatoria';
	else if (!errores.inicio && nuevo.fin < nuevo.inicio)
		errores.fin = 'La fecha de fin no puede ser anterior al inicio';
	return errores;
}

/** El `preliquidado` más antiguo: el único que muestra las rezagadas. */
export const preliquidadoMasAntiguo = <T extends RangoPeriodo>(
	periodos: readonly T[],
): T | undefined =>
	periodos
		.filter((p) => p.status === ESTADO_PERIODO.preliquidado)
		.reduce<T | undefined>(
			(min, p) => (!min || p.start_date < min.start_date ? p : min),
			undefined,
		);

interface HoraParaPeriodo {
	work_date: string;
	status: EstadoHoraExtra;
	period_id?: unknown;
}

/**
 * Horas que entrarían al liquidar `periodo` (aún sin vincular). Solo cuentan las
 * `aprobada` sin periodo. Rezagadas = anteriores al inicio, y solo en el
 * `preliquidado` más antiguo para que no salgan en dos periodos a la vez.
 */
export function clasificarParaPeriodo<T extends HoraParaPeriodo>(
	horas: readonly T[],
	periodo: RangoPeriodo,
	periodos: readonly RangoPeriodo[],
): { delPeriodo: T[]; rezagadas: T[] } {
	const delPeriodo: T[] = [];
	const rezagadas: T[] = [];
	if (periodo.status !== ESTADO_PERIODO.preliquidado)
		return { delPeriodo, rezagadas };
	const conRezagadas = preliquidadoMasAntiguo(periodos)?.id === periodo.id;
	for (const h of horas) {
		if (h.status !== ESTADO_HORA_EXTRA.aprobada || h.period_id != null)
			continue;
		if (h.work_date > periodo.end_date) continue;
		if (h.work_date >= periodo.start_date) delPeriodo.push(h);
		else if (conRezagadas) rezagadas.push(h);
	}
	return { delPeriodo, rezagadas };
}

export interface ResumenEmpleado {
	empleadoId: number | null;
	empleado: string;
	documento: string;
	/** Tiendas donde trabajó, sin repetir. */
	tiendas: string[];
	horasExtras: number;
	minutos: number;
}

/** Total a pagar por empleado (sin recargos), ordenado por nombre. */
export function resumenPorEmpleado(
	filas: readonly {
		empleadoId: number | null;
		empleado: string;
		documento: string;
		tienda: string;
		minutos: number;
	}[],
): ResumenEmpleado[] {
	const porEmpleado = new Map<string, ResumenEmpleado>();
	for (const f of filas) {
		const clave = f.empleadoId != null ? String(f.empleadoId) : f.documento;
		const r = porEmpleado.get(clave) ?? {
			empleadoId: f.empleadoId,
			empleado: f.empleado,
			documento: f.documento,
			tiendas: [],
			horasExtras: 0,
			minutos: 0,
		};
		if (f.tienda && !r.tiendas.includes(f.tienda)) r.tiendas.push(f.tienda);
		r.horasExtras += 1;
		r.minutos += f.minutos;
		porEmpleado.set(clave, r);
	}
	return [...porEmpleado.values()].sort((a, b) =>
		a.empleado.localeCompare(b.empleado, 'es'),
	);
}
