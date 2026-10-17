/**
 * Configuración del servicio a partir de variables de entorno.
 */
export interface Config {
	port: number;
	timezone: string;
	directus: {
		url: string | null;
		/** Valor del token: solo lo usa directus/client.ts. No se serializa ni se registra. */
		token: string | null;
		timeoutMs: number;
	};
}

export function leerConfig(env: NodeJS.ProcessEnv = process.env): Config {
	const port = Number(env.PORT ?? 3010);
	const timeout = Number(env.DIRECTUS_TIMEOUT_MS ?? 15000);
	return {
		port: Number.isFinite(port) && port > 0 ? port : 3010,
		timezone: env.TZ ?? 'America/Bogota',
		directus: {
			url: env.DIRECTUS_URL?.replace(/\/+$/, '') || null,
			token: env.DIRECTUS_ETL_TOKEN || null,
			timeoutMs: Number.isFinite(timeout) && timeout > 0 ? timeout : 15000,
		},
	};
}

export const directusConfigurado = (c: Config) =>
	c.directus.url !== null && c.directus.token !== null;
