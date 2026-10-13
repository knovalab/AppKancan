import directus from '@/services/directus/directus';
import { uploadFiles } from '@directus/sdk';
import { withAutoRefresh } from '@/auth/services/directusInterceptor';

/**
 * Uploads an attendance snapshot photo to Directus storage.
 * @param photoBlob The JPEG image blob captured from the in-app camera canvas.
 * @param filename Custom filename (defaults to timestamped name).
 * @returns The unique ID (UUID string) of the uploaded file in Directus.
 */
export async function uploadAttendancePhoto(
	photoBlob: Blob,
	filename = `marcacion_${Date.now()}.jpg`,
): Promise<string> {
	try {
		const formData = new FormData();
		formData.append('file', photoBlob, filename);

		const result: any = await withAutoRefresh(() =>
			directus.request(uploadFiles(formData)),
		);

		const fileId = result?.id || (Array.isArray(result) ? result[0]?.id : null);
		if (!fileId) {
			throw new Error('No se recibió el identificador del archivo subido.');
		}

		return String(fileId);
	} catch (error: any) {
		console.error('❌ Error subiendo foto de marcación a Directus:', error);
		throw new Error(
			error?.errors?.[0]?.message ||
			error?.message ||
			'Error al subir la fotografía de la marcación',
		);
	}
}
