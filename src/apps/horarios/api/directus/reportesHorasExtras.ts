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

/**
 * Las zonas son estos usuarios (los perfiles "Jefe Zona …") y sus tiendas en
 * `core_user_stores`. Configurable por entorno (ids separados por coma) porque
 * los ids cambian entre instancias de Directus.
 */
export const JEFES_ZONA: string[] = (
	import.meta.env.VITE_HORARIOS_JEFES_ZONA ??
	[
		'39534e5e-ee6b-4600-9891-0bb192bacc13', // Jefe Zona Cafetera
		'4c5419ed-a2f2-43e4-96a7-dcfe56016e60', // Jefe Zona Narino
		'fa67d633-1c93-4903-a0d4-7d7b5741e5f4', // Jefe Zona Sur
		'c8e035ed-2763-418e-bc00-1889a91d6684', // Jefe Zona Norte
	].join(',')
)
	.split(',')
	.map((id: string) => id.trim())
	.filter(Boolean);

export interface Zona {
	/** UUID del jefe de zona. */
	id: string;
	/** "Cafetera" (de "Jefe Zona Cafetera"). */
	nombre: string;
	tiendas: number[];
}

const PREFIJO_ZONA = /^\s*jefe\s+(de\s+)?zona\s+/i;

/** "Jefe Zona Cafetera" → "Cafetera". Sin el prefijo, el nombre tal cual. */
export const nombreZona = (nombreJefe: string) =>
	nombreJefe.replace(PREFIJO_ZONA, '').trim() || nombreJefe;

/**
 * Zonas = los usuarios de `JEFES_ZONA` y sus tiendas activas en `core_user_stores`.
 * Requiere que quien consulta pueda leer esas filas (por defecto cada usuario solo
 * ve las suyas): si no, devuelve menos zonas o ninguna.
 */
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
							{ user_id: { _in: JEFES_ZONA } },
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
			const completo = [f.user_id.first_name, f.user_id.last_name]
				.filter(Boolean)
				.join(' ');
			const z = zonas.get(f.user_id.id) ?? {
				id: f.user_id.id,
				// Sin permiso para leer el nombre: la zona se nombra por su posición en JEFES_ZONA.
				nombre: completo
					? nombreZona(completo)
					: `Zona ${JEFES_ZONA.indexOf(f.user_id.id) + 1}`,
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
