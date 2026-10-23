import { cargarTokenStorage } from '@/auth/services/tokenDirectus';
import { directusUrl } from '@/services/directus/directus';

export type DirectusTransformOperation = [
	string,
	...(string | number | boolean | Record<string, unknown>)[],
];

export interface AssetTransformOptions {
	width?: number;
	height?: number;
	quality?: number;
	fit?: 'cover' | 'contain' | 'inside' | 'outside';
	format?: 'auto' | 'jpg' | 'png' | 'webp' | 'tiff';
	/**
	 * Nivel de desenfoque/pixelación facial (sigma de Sharp) ejecutado en el servidor.
	 * Por defecto aplica 12 para anonimizar la captura facial en el origen sin compartir la original.
	 * Pasa 0 si deseas desactivarlo.
	 */
	blur?: number;
	/**
	 * Array 2D de transformaciones avanzadas según la documentación de Directus:
	 * https://directus.com/docs/guides/files/transform
	 * Ej: [["blur", 10], ["rotate", 90]]
	 */
	transforms?: DirectusTransformOperation[];
}

/**
 * Genera la URL para miniatura de Directus usando transformaciones en el servidor (origen).
 * Envía el parámetro `transforms` con Sharp (ej: [["blur", 12]]) según la documentación oficial de Directus
 * (https://directus.com/docs/guides/files/transform) para que la imagen se ofusque/pixelice
 * directamente en el origen antes de transmitirse al cliente.
 */
export function getDirectusThumbnailUrl(
	fileId: string | null | undefined,
	options: AssetTransformOptions = {},
): string {
	if (!fileId) return '';
	const {
		width = 96,
		height = 96,
		quality = 70,
		fit = 'cover',
		format,
		blur = 12,
		transforms,
	} = options;
	const token = cargarTokenStorage()?.access;

	const params = new URLSearchParams({
		width: String(width),
		height: String(height),
		quality: String(quality),
		fit,
	});

	if (format) {
		params.set('format', format);
	}

	// Transformación en el servidor (origen) usando el parámetro `transforms` de Directus (Sharp)
	const operations: DirectusTransformOperation[] =
		transforms !== undefined ? transforms : blur > 0 ? [['blur', blur]] : [];

	if (operations.length > 0) {
		params.set('transforms', JSON.stringify(operations));
	}

	if (token) {
		params.set('access_token', token);
	}

	return `${directusUrl}/assets/${fileId}?${params.toString()}`;
}

/**
 * Genera la URL para previsualización ampliada con resolución controlada,
 * transformada en el origen usando `transforms` para no transferir el archivo pesado ni exponer datos faciales originales.
 */
export function getDirectusPreviewUrl(
	fileId: string | null | undefined,
	options: AssetTransformOptions = {},
): string {
	if (!fileId) return '';
	const {
		width = 500,
		height = 500,
		quality = 80,
		fit = 'inside',
		format,
		blur = 10,
		transforms,
	} = options;
	const token = cargarTokenStorage()?.access;

	const params = new URLSearchParams({
		width: String(width),
		height: String(height),
		quality: String(quality),
		fit,
	});

	if (format) {
		params.set('format', format);
	}

	const operations: DirectusTransformOperation[] =
		transforms !== undefined ? transforms : blur > 0 ? [['blur', blur]] : [];

	if (operations.length > 0) {
		params.set('transforms', JSON.stringify(operations));
	}

	if (token) {
		params.set('access_token', token);
	}

	return `${directusUrl}/assets/${fileId}?${params.toString()}`;
}
