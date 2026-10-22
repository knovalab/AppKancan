import type { EstadoHoraExtra } from './estados';
import {
	clasificarParaPeriodo,
	ESTADO_PERIODO,
	type RangoPeriodo,
} from './periodo';

export interface Totales {
	registros: number;
	minutos: number;
}

export interface ResumenPeriodo<P extends RangoPeriodo = RangoPeriodo> {
	periodo: P;
	/** Liquidado: vinculadas de su rango. Preliquidado: aprobadas por vincular de su rango. */
	delPeriodo: Totales;
	/** Con fecha anterior al inicio (pagadas o por pagar en este periodo). */
	rezagadas: Totales;
	total: Totales;
}

const cero = (): Totales => ({ registros: 0, minutos: 0 });
const sumar = (t: Totales, registros: number, minutos: number) => {
	t.registros += registros;
	t.minutos += minutos;
};

/**
 * Totales por periodo para el reporte en tiempo real. Solo **aprobadas**:
 * - Liquidado: lo vinculado (`vinculadas`, ya agregado por periodo, tienda y día).
 * - Preliquidado: lo que se vincularía hoy (`porPagar`, con la misma regla que Periodos).
 * `incluirTienda` aplica el filtro de empresa.
 */
export function resumenPorPeriodo<P extends RangoPeriodo>(
	periodos: readonly P[],
	vinculadas: readonly {
		periodoId: number | null;
		storeId: number | null;
		fecha: string | null;
		registros: number;
		minutos: number;
	}[],
	porPagar: readonly {
		work_date: string;
		status: EstadoHoraExtra;
		period_id?: unknown;
		minutes: number;
		store_id: unknown;
	}[],
	tiendaDe: (h: { store_id: unknown }) => number | null,
	incluirTienda: (storeId: number | null) => boolean,
): ResumenPeriodo<P>[] {
	const porPagarFiltradas = porPagar.filter((h) => incluirTienda(tiendaDe(h)));
	return periodos.map((periodo) => {
		const delPeriodo = cero();
		const rezagadas = cero();
		if (periodo.status === ESTADO_PERIODO.liquidado) {
			for (const v of vinculadas) {
				if (v.periodoId !== periodo.id || !incluirTienda(v.storeId)) continue;
				const destino =
					v.fecha && v.fecha < periodo.start_date ? rezagadas : delPeriodo;
				sumar(destino, v.registros, v.minutos);
			}
		} else {
			const c = clasificarParaPeriodo(porPagarFiltradas, periodo, periodos);
			for (const h of c.delPeriodo) sumar(delPeriodo, 1, h.minutes);
			for (const h of c.rezagadas) sumar(rezagadas, 1, h.minutes);
		}
		return {
			periodo,
			delPeriodo,
			rezagadas,
			total: {
				registros: delPeriodo.registros + rezagadas.registros,
				minutos: delPeriodo.minutos + rezagadas.minutos,
			},
		};
	});
}

/** El periodo que contiene `hoy` (preferiblemente preliquidado); si no hay, el más reciente. */
export function periodoActual<P extends RangoPeriodo>(
	periodos: readonly P[],
	hoy: string,
): P | undefined {
	const contienen = periodos.filter(
		(p) => p.start_date <= hoy && hoy <= p.end_date,
	);
	return (
		contienen.find((p) => p.status === ESTADO_PERIODO.preliquidado) ??
		contienen[0] ??
		[...periodos].sort((a, b) => b.start_date.localeCompare(a.start_date))[0]
	);
}

/** Preliquidados cuyo rango ya terminó: deberían liquidarse. */
export const periodosVencidos = <P extends RangoPeriodo>(
	periodos: readonly P[],
	hoy: string,
): P[] =>
	periodos.filter(
		(p) => p.status === ESTADO_PERIODO.preliquidado && p.end_date < hoy,
	);
