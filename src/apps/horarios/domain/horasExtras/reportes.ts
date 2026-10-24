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
	/** Las mismas horas por tienda trabajada (más horas primero; sin tienda: `null`). */
	tiendas: TotalesTienda[];
}

export interface TotalesTienda {
	storeId: number | null;
	delPeriodo: Totales;
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
 *   Cada fila cuenta `registros` (si viene agregada) o 1.
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
		registros?: number;
	}[],
	tiendaDe: (h: { store_id: unknown }) => number | null,
	incluirTienda: (storeId: number | null) => boolean,
): ResumenPeriodo<P>[] {
	const porPagarFiltradas = porPagar.filter((h) => incluirTienda(tiendaDe(h)));
	return periodos.map((periodo) => {
		const delPeriodo = cero();
		const rezagadas = cero();
		const porTienda = new Map<number | null, TotalesTienda>();
		const sumarEn = (
			rezagada: boolean,
			storeId: number | null,
			registros: number,
			minutos: number,
		) => {
			let t = porTienda.get(storeId);
			if (!t) {
				t = { storeId, delPeriodo: cero(), rezagadas: cero(), total: cero() };
				porTienda.set(storeId, t);
			}
			sumar(rezagada ? rezagadas : delPeriodo, registros, minutos);
			sumar(rezagada ? t.rezagadas : t.delPeriodo, registros, minutos);
			sumar(t.total, registros, minutos);
		};
		if (periodo.status === ESTADO_PERIODO.liquidado) {
			for (const v of vinculadas) {
				if (v.periodoId !== periodo.id || !incluirTienda(v.storeId)) continue;
				const rezagada = !!v.fecha && v.fecha < periodo.start_date;
				sumarEn(rezagada, v.storeId, v.registros, v.minutos);
			}
		} else {
			const c = clasificarParaPeriodo(porPagarFiltradas, periodo, periodos);
			for (const h of c.delPeriodo)
				sumarEn(false, tiendaDe(h), h.registros ?? 1, h.minutes);
			for (const h of c.rezagadas)
				sumarEn(true, tiendaDe(h), h.registros ?? 1, h.minutes);
		}
		return {
			periodo,
			delPeriodo,
			rezagadas,
			total: {
				registros: delPeriodo.registros + rezagadas.registros,
				minutos: delPeriodo.minutos + rezagadas.minutos,
			},
			tiendas: [...porTienda.values()].sort(
				(a, b) => b.total.minutos - a.total.minutos,
			),
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

const variacion = (ahora: number, antes: number) =>
	antes ? (ahora - antes) / antes : null;
// getDay(): 0 = domingo → lunes primero. Mediodía para no cruzar de día por zona horaria.
const diaSemana = (fecha: string) =>
	(new Date(`${fecha}T12:00:00`).getDay() + 6) % 7;

export interface ZonaGerencia extends Totales {
	/** `null` = tiendas sin zona. */
	zona: string | null;
	tiendas: number;
	porcentaje: number;
	variacion: number | null;
}

export interface TiendaGerencia extends Totales {
	storeId: number;
	zona: string | null;
	porcentaje: number;
	variacion: number | null;
}

export interface ReporteGerencia {
	total: Totales & { variacion: number | null };
	/** Más horas primero. */
	zonas: ZonaGerencia[];
	/** Más horas primero. */
	tiendas: TiendaGerencia[];
	porDiaSemana: number[];
}

/**
 * Vista macro de gerencia, **sin personas**: zonas y tiendas a partir de un agregado
 * por tienda × día. `previas`: minutos por tienda del rango anterior (variación).
 */
export function reporteGerencia(
	filas: readonly {
		storeId: number | null;
		fecha: string | null;
		registros: number;
		minutos: number;
	}[],
	previas: ReadonlyMap<number, number>,
	zonaDe: (storeId: number) => string | null,
): ReporteGerencia {
	const porDiaSemana = [0, 0, 0, 0, 0, 0, 0];
	const tiendas = new Map<number, Totales>();
	const total = cero();
	for (const f of filas) {
		if (f.storeId == null) continue;
		const t = tiendas.get(f.storeId) ?? cero();
		tiendas.set(f.storeId, t);
		sumar(t, f.registros, f.minutos);
		sumar(total, f.registros, f.minutos);
		if (f.fecha) porDiaSemana[diaSemana(f.fecha)] += f.minutos;
	}
	const parte = (m: number) => (total.minutos ? m / total.minutos : 0);
	const porMinutos = <T extends Totales>(a: T, b: T) => b.minutos - a.minutos;

	const zonas = new Map<string | null, ZonaGerencia & { antes: number }>();
	const zona = (nombre: string | null) => {
		const z = zonas.get(nombre) ?? {
			zona: nombre,
			...cero(),
			tiendas: 0,
			porcentaje: 0,
			variacion: null,
			antes: 0,
		};
		zonas.set(nombre, z);
		return z;
	};
	const listaTiendas: TiendaGerencia[] = [...tiendas].map(([storeId, t]) => {
		const nombreZona = zonaDe(storeId);
		const z = zona(nombreZona);
		sumar(z, t.registros, t.minutos);
		z.tiendas += 1;
		return {
			storeId,
			zona: nombreZona,
			...t,
			porcentaje: parte(t.minutos),
			variacion: variacion(t.minutos, previas.get(storeId) ?? 0),
		};
	});
	// Lo previo cuenta para su zona aunque la tienda no tenga horas ahora.
	let totalAntes = 0;
	for (const [storeId, m] of previas) {
		totalAntes += m;
		zona(zonaDe(storeId)).antes += m;
	}
	return {
		total: { ...total, variacion: variacion(total.minutos, totalAntes) },
		zonas: [...zonas.values()]
			.filter((z) => z.minutos > 0)
			.map(({ antes, ...z }) => ({
				...z,
				porcentaje: parte(z.minutos),
				variacion: variacion(z.minutos, antes),
			}))
			.sort(porMinutos),
		tiendas: listaTiendas.sort(porMinutos),
		porDiaSemana,
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
