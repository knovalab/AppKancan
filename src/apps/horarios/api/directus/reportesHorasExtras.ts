import { aggregate, readItems } from '@directus/sdk';
import { withAutoRefresh } from '@/auth/services/directusInterceptor';
import directus from '@/services/directus/directus';
import type { EstadoHoraExtra } from '../../domain/horasExtras';
import type { FiltroDirectus } from '../../interfaces/api/directus';
import { errorDeApi } from '../../utils/errores';
import { STORE_PRUEBAS } from './read';
import { idRelacion } from './relacion';

/** Campos por los que se puede agrupar el agregado. */
export type CampoAgrupacion = 'store_id' | 'work_date' | 'period_id' | 'status';

export interface FiltrosAgregado {
	estados: EstadoHoraExtra[];
	/** `work_date` YYYY-MM-DD, ambos incluidos. */
	desde?: string;
	hasta?: string;
	/** `true` = solo vinculadas a un periodo; `false` = solo sin periodo. */
	conPeriodo?: boolean;
}

/** Una fila agregada: los campos agrupados (los que se pidieron) + conteo y suma. */
export interface FilaAgregada {
	storeId: number | null;
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

/**
 * Rol de Directus de los **jefes de zona**: la zona es el jefe y sus tiendas
 * (`core_user_stores`). Configurable por entorno porque el id cambia entre instancias.
 */
export const ROL_JEFE_ZONA: string =
	import.meta.env.VITE_HORARIOS_ROL_JEFE_ZONA ??
	'909f5090-9f86-4205-9a5f-f595fdf6a856';

export interface Zona {
	/** UUID del jefe de zona. */
	id: string;
	/** "Cafetera" (de "Jefe Zona Cafetera"). */
	nombre: string;
	tiendas: number[];
}

/** "Jefe Zona Cafetera" → "Cafetera". Sin el prefijo, el nombre tal cual. */
export const nombreZona = (nombreJefe: string) =>
	nombreJefe.replace(/^\s*jefe\s+(de\s+)?zona\s+/i, '').trim() || nombreJefe;

/** Zonas = jefes de zona activos con sus tiendas asignadas (`core_user_stores`). */
export async function listarZonas(): Promise<Zona[]> {
	try {
		const filas = (await withAutoRefresh(() =>
			directus.request(
				readItems('core_user_stores', {
					fields: [
						'store_id',
						'user_id.id',
						'user_id.first_name',
						'user_id.last_name',
					],
					filter: {
						_and: [
							{ status: { _eq: 'Activo' } },
							{ user_id: { role: { _eq: ROL_JEFE_ZONA } } },
						],
					},
					limit: -1,
				}),
			),
		)) as {
			store_id: unknown;
			user_id: {
				id: string;
				first_name?: string | null;
				last_name?: string | null;
			} | null;
		}[];
		const zonas = new Map<string, Zona>();
		for (const f of filas) {
			const tienda = idRelacion(f.store_id);
			if (!f.user_id || tienda == null || tienda === STORE_PRUEBAS) continue;
			const z = zonas.get(f.user_id.id) ?? {
				id: f.user_id.id,
				nombre: nombreZona(
					[f.user_id.first_name, f.user_id.last_name].filter(Boolean).join(' '),
				),
				tiendas: [],
			};
			if (!z.tiendas.includes(tienda)) z.tiendas.push(tienda);
			zonas.set(z.id, z);
		}
		return [...zonas.values()].sort((a, b) =>
			a.nombre.localeCompare(b.nombre, 'es'),
		);
	} catch (error) {
		throw errorDeApi(
			error,
			'Error consultando zonas',
			'Error al cargar las zonas (jefes de zona)',
		);
	}
}
