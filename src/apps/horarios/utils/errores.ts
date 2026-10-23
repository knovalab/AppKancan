import type { DirectusErrorDto } from '../interfaces/api/directus';

/**
 * Mensajes de error para el usuario a partir de lo que lanza la API (camino A de
 * results/ERRORES_ESTADO_Y_PROPUESTA.md). Sustituye a las extracciones manuales
 * `error?.errors?.[0]?.message || '…'` repartidas por la app.
 *
 * Códigos según docs/GUIA_ERRORES_DIRECTUS.md.
 */

const MENSAJE_POR_CODIGO: Record<string, string> = {
	INVALID_CREDENTIALS: 'Tu sesión expiró. Vuelve a iniciar sesión.',
	TOKEN_EXPIRED: 'Tu sesión expiró. Vuelve a iniciar sesión.',
	INVALID_TOKEN: 'Tu sesión expiró. Vuelve a iniciar sesión.',
	FORBIDDEN: 'No tienes permiso para esta acción.',
	COLLECTION_FORBIDDEN: 'No tienes permiso para esta acción.',
	RECORD_NOT_UNIQUE: 'Este registro ya existe.',
	FAILED_VALIDATION: 'Hay datos no válidos en la solicitud.',
	INVALID_PAYLOAD: 'Hay datos no válidos en la solicitud.',
	INVALID_QUERY: 'La consulta enviada no es válida.',
	FIELD_NOT_FOUND_IN_COLLECTION: 'La solicitud usa un campo que no existe.',
	ROUTE_NOT_FOUND: 'No se encontró el recurso solicitado.',
	REQUESTS_EXCEEDED:
		'Demasiadas solicitudes. Espera un momento e inténtalo de nuevo.',
	SERVICE_UNAVAILABLE:
		'El servidor no está disponible. Inténtalo de nuevo en unos minutos.',
};

const MENSAJE_POR_STATUS: Record<number, string> = {
	401: 'Tu sesión expiró. Vuelve a iniciar sesión.',
	403: 'No tienes permiso para esta acción.',
	404: 'No se encontró el recurso solicitado.',
	429: 'Demasiadas solicitudes. Espera un momento e inténtalo de nuevo.',
	503: 'El servidor no está disponible. Inténtalo de nuevo en unos minutos.',
};

const MENSAJE_SIN_RED =
	'Sin conexión con el servidor. Revisa la red e inténtalo de nuevo.';

const esObjeto = (v: unknown): v is Record<string, unknown> =>
	typeof v === 'object' && v !== null;

/** El error tal como lo devuelve Directus, si lo es. */
export function comoErrorDirectus(err: unknown): DirectusErrorDto | null {
	if (!esObjeto(err)) return null;
	const posible = err as DirectusErrorDto;
	return Array.isArray(posible.errors) ||
		typeof posible.response?.status === 'number'
		? posible
		: null;
}

/** Código de Directus (`extensions.code`) del primer error, si existe. */
export function codigoDeError(err: unknown): string | null {
	return comoErrorDirectus(err)?.errors?.[0]?.extensions?.code ?? null;
}

/** Status HTTP del error, si se conoce. */
export function statusDeError(err: unknown): number | null {
	const directus = comoErrorDirectus(err);
	const status = directus?.response?.status ?? directus?.status;
	return typeof status === 'number' ? status : null;
}

/**
 * Texto para mostrar al usuario. Orden:
 * 1. código de Directus conocido → mensaje en español;
 * 2. status HTTP conocido → mensaje en español;
 * 3. mensaje del primer error de Directus;
 * 4. fallo de red (`TypeError: Failed to fetch`) → mensaje de conexión;
 * 5. `Error.message` (p. ej. los de sesión de withAutoRefresh, ya en español);
 * 6. `porDefecto`.
 */
export function mensajeDeError(err: unknown, porDefecto: string): string {
	const codigo = codigoDeError(err);
	if (codigo && MENSAJE_POR_CODIGO[codigo]) return MENSAJE_POR_CODIGO[codigo];

	const status = statusDeError(err);
	if (status != null && MENSAJE_POR_STATUS[status])
		return MENSAJE_POR_STATUS[status];

	const mensajeDirectus = comoErrorDirectus(err)?.errors?.[0]?.message;
	if (mensajeDirectus) return mensajeDirectus;

	if (err instanceof TypeError && /fetch|network/i.test(err.message)) {
		return MENSAJE_SIN_RED;
	}
	if (err instanceof Error && err.message) return err.message;
	return porDefecto;
}

/**
 * Para los `catch` de la API: registra el error original y devuelve un `Error`
 * con el mensaje ya traducido, listo para lanzar.
 */
export function errorDeApi(
	err: unknown,
	contexto: string,
	porDefecto: string,
): Error {
	console.error(`❌ ${contexto}:`, err);
	return new Error(mensajeDeError(err, porDefecto));
}
