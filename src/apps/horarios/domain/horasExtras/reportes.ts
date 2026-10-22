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

/** Días de la semana en el orden del reporte (lunes primero). */
export const DIAS_SEMANA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

export interface DiaPersona extends Totales {
	/** YYYY-MM-DD */
	fecha: string;
}

export interface PersonaZona extends Totales {
	empleadoId: number;
	dias: DiaPersona[];
}

export interface TiendaZona extends Totales {
	storeId: number;
	personas: PersonaZona[];
	/** % de los minutos de la zona. */
	porcentaje: number;
	/** Minutos por persona de plantilla; `null` si no hay plantilla. */
	minutosPorPersona: number | null;
	/** Variación vs. el rango anterior (0,12 = +12 %); `null` si antes no hubo horas. */
	variacion: number | null;
}

export interface ReporteZona {
	total: Totales & { personas: number; minutosPorPersona: number | null };
	tiendas: TiendaZona[];
	/** Minutos por día de la semana, lunes a domingo. */
	porDiaSemana: number[];
	/** Personas con más minutos en la zona (todas sus tiendas). */
	topPersonas: (Totales & { empleadoId: number; tiendas: number[] })[];
}

/**
 * Reporte de una zona (R2 + R4) a partir de un agregado por tienda × empleado × día.
 * `plantilla`: empleados activos por tienda, para comparar tiendas grandes y chicas.
 * `previas`: minutos por tienda del rango anterior, para la variación.
 */
export function reporteZona(
	filas: readonly {
		storeId: number | null;
		empleadoId: number | null;
		fecha: string | null;
		registros: number;
		minutos: number;
	}[],
	previas: ReadonlyMap<number, number>,
	plantilla: ReadonlyMap<number, number>,
	topN = 10,
): ReporteZona {
	const tiendas = new Map<number, Map<number, PersonaZona>>();
	const porDiaSemana = [0, 0, 0, 0, 0, 0, 0];
	const personasZona = new Map<
		number,
		Totales & { empleadoId: number; tiendas: number[] }
	>();
	for (const f of filas) {
		if (f.storeId == null || f.empleadoId == null || !f.fecha) continue;
		const personas = tiendas.get(f.storeId) ?? new Map<number, PersonaZona>();
		tiendas.set(f.storeId, personas);
		const p = personas.get(f.empleadoId) ?? {
			empleadoId: f.empleadoId,
			registros: 0,
			minutos: 0,
			dias: [],
		};
		personas.set(f.empleadoId, p);
		sumar(p, f.registros, f.minutos);
		const dia = p.dias.find((d) => d.fecha === f.fecha);
		if (dia) sumar(dia, f.registros, f.minutos);
		else
			p.dias.push({
				fecha: f.fecha,
				registros: f.registros,
				minutos: f.minutos,
			});
		// getDay(): 0 = domingo → lunes primero. Mediodía para no cruzar de día por zona horaria.
		porDiaSemana[(new Date(`${f.fecha}T12:00:00`).getDay() + 6) % 7] +=
			f.minutos;
		const z = personasZona.get(f.empleadoId) ?? {
			empleadoId: f.empleadoId,
			registros: 0,
			minutos: 0,
			tiendas: [],
		};
		sumar(z, f.registros, f.minutos);
		if (!z.tiendas.includes(f.storeId)) z.tiendas.push(f.storeId);
		personasZona.set(f.empleadoId, z);
	}

	const totalMinutos = filas.reduce((s, f) => s + (f.minutos || 0), 0);
	const porMinutos = <T extends Totales>(a: T, b: T) => b.minutos - a.minutos;
	const resultado: TiendaZona[] = [...tiendas].map(([storeId, personas]) => {
		const lista = [...personas.values()].sort(porMinutos);
		for (const p of lista)
			p.dias.sort((a, b) => a.fecha.localeCompare(b.fecha));
		const t = cero();
		for (const p of lista) sumar(t, p.registros, p.minutos);
		const cupo = plantilla.get(storeId) ?? 0;
		const antes = previas.get(storeId) ?? 0;
		return {
			storeId,
			...t,
			personas: lista,
			porcentaje: totalMinutos ? t.minutos / totalMinutos : 0,
			minutosPorPersona: cupo ? t.minutos / cupo : null,
			variacion: antes ? (t.minutos - antes) / antes : null,
		};
	});
	const cupoZona = [...tiendas.keys()].reduce(
		(s, id) => s + (plantilla.get(id) ?? 0),
		0,
	);
	return {
		total: {
			registros: resultado.reduce((s, t) => s + t.registros, 0),
			minutos: totalMinutos,
			personas: personasZona.size,
			minutosPorPersona: cupoZona ? totalMinutos / cupoZona : null,
		},
		tiendas: resultado.sort(porMinutos),
		porDiaSemana,
		topPersonas: [...personasZona.values()].sort(porMinutos).slice(0, topN),
	};
}

/** Rango anterior de la misma duración, justo antes de `desde` (para la variación). */
export function rangoAnterior(desde: string, hasta: string) {
	const dia = 24 * 60 * 60 * 1000;
	const d = new Date(`${desde}T12:00:00Z`).getTime();
	const h = new Date(`${hasta}T12:00:00Z`).getTime();
	const largo = Math.round((h - d) / dia) + 1;
	const iso = (t: number) => new Date(t).toISOString().slice(0, 10);
	return { desde: iso(d - largo * dia), hasta: iso(d - dia) };
}
