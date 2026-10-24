import { aggregate, readItems } from '@directus/sdk';
import { withAutoRefresh } from '@/auth/services/directusInterceptor';
import directus from '@/services/directus/directus';
import type { EstadoHoraExtra } from '../../domain/horasExtras';
import type { FiltroDirectus } from '../../interfaces/api/directus';
import { errorDeApi } from '../../utils/errores';
import { STORE_PRUEBAS } from './read';
import { idRelacion } from './relacion';

/** Campos por los que se puede agrupar el agregado. */
export type CampoAgrupacion =
	| 'store_id'
	| 'employee_id'
	| 'work_date'
	| 'period_id'
	| 'status';

export interface FiltrosAgregado {
	estados: EstadoHoraExtra[];
	/** `work_date` YYYY-MM-DD, ambos incluidos. */
	desde?: string;
	hasta?: string;
	/** `true` = solo vinculadas a un periodo; `false` = solo sin periodo. */
	conPeriodo?: boolean;
	/** Solo estas tiendas **trabajadas** (zona); vacío o ausente = todas. */
	tiendas?: number[];
}

/** Una fila agregada: los campos agrupados (los que se pidieron) + conteo y suma. */
export interface FilaAgregada {
	storeId: number | null;
	empleadoId: number | null;
	fecha: string | null;
	periodoId: number | null;
	estado: string | null;
	registros: number;
	minutos: number;
}

/** Filtro del agregado. Siempre sin la tienda de pruebas. */
export function filtroAgregado(f: FiltrosAgregado): FiltroDirectus {
	const y: FiltroDirectus[] = [
		{ store_id: { _neq: STORE_PRUEBAS } },
		{ status: { _in: f.estados } },
	];
	if (f.desde) y.push({ work_date: { _gte: f.desde } });
	if (f.hasta) y.push({ work_date: { _lte: f.hasta } });
	if (f.conPeriodo === true) y.push({ period_id: { _nnull: true } });
	if (f.conPeriodo === false) y.push({ period_id: { _null: true } });
	if (f.tiendas && f.tiendas.length > 0)
		y.push({ store_id: { _in: f.tiendas } });
	return { _and: y };
}

/**
 * Horas extras agregadas en Directus (count + sum de minutos) agrupadas por los
 * campos pedidos. Devuelve pocas filas aunque haya miles de registros; respeta
 * los permisos del usuario (un jefe de zona solo suma sus tiendas).
 */
export async function agregadoHorasExtras(
	filtros: FiltrosAgregado,
	agrupar: CampoAgrupacion[],
): Promise<FilaAgregada[]> {
	try {
		const filas = (await withAutoRefresh(() =>
			directus.request(
				aggregate('com_over_time', {
					aggregate: { count: ['id'], sum: ['minutes'] },
					groupBy: agrupar,
					query: { filter: filtroAgregado(filtros), limit: -1 },
				}),
			),
		)) as Record<string, unknown>[];
		// Directus devuelve los agregados como texto en algunos motores.
		return filas.map((f) => ({
			storeId: agrupar.includes('store_id') ? idRelacion(f.store_id) : null,
			empleadoId: agrupar.includes('employee_id')
				? idRelacion(f.employee_id)
				: null,
			fecha: agrupar.includes('work_date')
				? String(f.work_date ?? '').slice(0, 10) || null
				: null,
			periodoId: agrupar.includes('period_id') ? idRelacion(f.period_id) : null,
			estado: agrupar.includes('status')
				? String(f.status ?? '') || null
				: null,
			registros: Number((f.count as { id?: unknown })?.id ?? 0),
			minutos: Number((f.sum as { minutes?: unknown })?.minutes ?? 0),
		}));
	} catch (error) {
		throw errorDeApi(
			error,
			'Error consultando el reporte de horas extras',
			'Error al cargar el reporte de horas extras',
		);
	}
}

export interface Zona {
	/** El valor de `core_stores.zone` (también es el nombre). */
	id: string;
	nombre: string;
	tiendas: number[];
}

/**
 * Agrupa las tiendas por su `zone`. Sin zona o la tienda de pruebas: fuera.
 * Orden alfabético; tiendas en el orden recibido.
 */
export function zonasDeTiendas(
	tiendas: readonly { id: number | string; zone?: string | null }[],
): Zona[] {
	const zonas = new Map<string, Zona>();
	for (const t of tiendas) {
		const nombre = t.zone?.trim();
		const id = Number(t.id);
		if (!nombre || id === STORE_PRUEBAS) continue;
		const z = zonas.get(nombre) ?? { id: nombre, nombre, tiendas: [] };
		z.tiendas.push(id);
		zonas.set(nombre, z);
	}
	return [...zonas.values()].sort((a, b) =>
		a.nombre.localeCompare(b.nombre, 'es'),
	);
}

export interface TiendaReporte {
	id: number;
	name: string;
	company?: string | null;
	zone?: string | null;
}

/**
 * Tiendas con solo los campos de los reportes (sin `ultra_code`): las que puede
 * leer gerencia (`time_log_gerencia`). Sin la tienda de pruebas.
 */
export async function listarTiendasReporte(): Promise<TiendaReporte[]> {
	try {
		const tiendas = (await withAutoRefresh(() =>
			directus.request(
				readItems('core_stores', {
					fields: ['id', 'name', 'company', 'zone'],
					sort: ['name'],
					limit: -1,
				}),
			),
		)) as TiendaReporte[];
		return tiendas
			.map((t) => ({ ...t, id: Number(t.id) }))
			.filter((t) => t.id !== STORE_PRUEBAS);
	} catch (error) {
		throw errorDeApi(
			error,
			'Error consultando tiendas',
			'Error al cargar las tiendas',
		);
	}
}

/**
 * Zonas = valores de `core_stores.zone` con sus tiendas. Consulta aparte de
 * `getStores`: si una política aún no puede leer `zone`, solo falla el reporte.
 */
export async function listarZonas(): Promise<Zona[]> {
	try {
		const tiendas = (await withAutoRefresh(() =>
			directus.request(
				readItems('core_stores', {
					fields: ['id', 'zone'],
					limit: -1,
				}),
			),
		)) as { id: number | string; zone?: string | null }[];
		return zonasDeTiendas(tiendas);
	} catch (error) {
		throw errorDeApi(
			error,
			'Error consultando zonas',
			'Error al cargar las zonas de las tiendas',
		);
	}
}
