import { createItems, readItems, updateItemsBatch } from '@directus/sdk';
import type { ClienteDirectus } from '../directus/client.ts';
import type { DiaTiendaCalculado } from '../transform/diaTienda.ts';

const LOTE = 100;

const trozos = <T>(xs: T[], n = LOTE) =>
	Array.from({ length: Math.ceil(xs.length / n) }, (_, i) =>
		xs.slice(i * n, i * n + n),
	);

/**
 * Upsert por (store, work_day): Directus no tiene upsert por clave natural, así que se
 * leen las filas existentes del día y se crean o actualizan. Repetirlo no duplica.
 * No toca open_user / close_user (son usuarios de Directus; el ETL no los conoce).
 */
export async function guardarDiasTienda(
	directus: ClienteDirectus,
	fecha: string,
	calculados: DiaTiendaCalculado[],
): Promise<{ creadas: number; actualizadas: number }> {
	if (calculados.length === 0) return { creadas: 0, actualizadas: 0 };

	const existentes = await directus.request(
		readItems('com_time_record_store', {
			fields: ['id', 'store'],
			filter: { work_day: { _eq: fecha } },
			limit: -1,
		}),
	);
	const idPorTienda = new Map(
		existentes.map((e) => [String(e.store), e.id] as const),
	);

	const crear = calculados.filter((d) => !idPorTienda.has(d.store));
	const actualizar = calculados
		.filter((d) => idPorTienda.has(d.store))
		.map((d) => ({ ...d, id: idPorTienda.get(d.store) as number }));

	for (const lote of trozos(crear))
		await directus.request(createItems('com_time_record_store', lote));
	for (const lote of trozos(actualizar))
		await directus.request(updateItemsBatch('com_time_record_store', lote));

	return { creadas: crear.length, actualizadas: actualizar.length };
}
