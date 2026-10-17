import { createDirectus, rest, staticToken } from '@directus/sdk';
import type { Config } from '../config.ts';
import type { Schema } from './schema.ts';

export function crearClienteDirectus(config: Config) {
	const { url, token, timeoutMs } = config.directus;
	if (!url || !token) {
		throw new Error(
			'Directus no configurado: faltan DIRECTUS_URL o DIRECTUS_ETL_TOKEN',
		);
	}
	return createDirectus<Schema>(url)
		.with(staticToken(token))
		.with(
			rest({
				// fetch no tiene timeout propio: cada petición se aborta pasado timeoutMs.
				onRequest: (opciones) => ({
					...opciones,
					signal: AbortSignal.timeout(timeoutMs),
				}),
			}),
		);
}

export type ClienteDirectus = ReturnType<typeof crearClienteDirectus>;
