import { isDirectusError } from '@directus/sdk';

/** Texto para logs. Nunca incluye cabeceras (el token va en Authorization). */
export function describirError(err: unknown): string {
	if (isDirectusError(err)) {
		const e = err.errors?.[0];
		const status = err.response?.status;
		return `Directus ${status ?? '?'} ${e?.extensions?.code ?? ''}: ${e?.message ?? 'sin mensaje'}`;
	}
	if (err instanceof Error && err.name === 'TimeoutError')
		return 'Directus no respondió a tiempo';
	if (err instanceof TypeError)
		return `Sin conexión con Directus (${err.message})`;
	return err instanceof Error ? err.message : String(err);
}

/** Solo lo que puede arreglarse solo: red, timeout, 429 y 5xx. Nunca 400/401/403/404. */
export function esReintentable(err: unknown): boolean {
	if (isDirectusError(err)) {
		const status = err.response?.status ?? 0;
		return status === 429 || status >= 500;
	}
	return (
		err instanceof TypeError ||
		(err instanceof Error && err.name === 'TimeoutError')
	);
}

export async function conReintentos<T>(
	fn: () => Promise<T>,
	intentos = 3,
	esperaMs = 500,
): Promise<T> {
	for (let i = 1; ; i++) {
		try {
			return await fn();
		} catch (err) {
			if (i >= intentos || !esReintentable(err)) throw err;
			await new Promise((r) => setTimeout(r, esperaMs * 2 ** (i - 1)));
		}
	}
}
