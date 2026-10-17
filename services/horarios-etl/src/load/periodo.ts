import { createItem, readItems } from '@directus/sdk';
import type { ClienteDirectus } from '../directus/client.ts';
import type { RangoPeriodo } from '../transform/periodo.ts';

/** Devuelve el id del periodo con ese rango; si no existe, lo crea. */
export async function asegurarPeriodo(
	directus: ClienteDirectus,
	rango: RangoPeriodo,
): Promise<{ id: number; creado: boolean }> {
	const [existente] = await directus.request(
		readItems('com_period', {
			fields: ['id'],
			filter: {
				start_date: { _eq: rango.start_date },
				end_date: { _eq: rango.end_date },
			},
			limit: 1,
		}),
	);
	if (existente) return { id: existente.id, creado: false };

	const nuevo = await directus.request(
		createItem('com_period', rango, { fields: ['id'] }),
	);
	return { id: nuevo.id, creado: true };
}
