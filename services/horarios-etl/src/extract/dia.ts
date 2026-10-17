import { readItems } from '@directus/sdk';
import type { ClienteDirectus } from '../directus/client.ts';
import type { MarcacionDia } from '../transform/diaTienda.ts';

const TAMANO_PAGINA = 500;

/** Marcaciones de un día, todas las tiendas, paginadas por id (orden estable). */
export async function marcacionesDelDia(
	directus: ClienteDirectus,
	fecha: string,
): Promise<MarcacionDia[]> {
	const todas: MarcacionDia[] = [];
	for (let page = 1; ; page++) {
		const lote = await directus.request(
			readItems('com_time_records', {
				fields: ['id', 'store_id', 'log_type', 'record_time'],
				filter: { record_date: { _eq: fecha } },
				sort: ['id'],
				limit: TAMANO_PAGINA,
				page,
			}),
		);
		todas.push(...(lote as MarcacionDia[]));
		if (lote.length < TAMANO_PAGINA) return todas;
	}
}

/** Ids de las tiendas marcadas como cerradas ese día (`status = true`). */
export async function tiendasCerradas(
	directus: ClienteDirectus,
	fecha: string,
): Promise<Set<string>> {
	const filas = await directus.request(
		readItems('com_store_closed_days', {
			fields: ['store_id'],
			filter: { date: { _eq: fecha }, status: { _eq: true } },
			limit: -1,
		}),
	);
	return new Set(
		filas.flatMap((f) => (f.store_id == null ? [] : [String(f.store_id)])),
	);
}
