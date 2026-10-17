import { readItems } from '@directus/sdk';
import { withAutoRefresh } from '@/auth/services/directusInterceptor';
import directus from '@/services/directus/directus';

// LEGACY: salió de api/directus/create.ts (2026-10-17). Sin llamadores y con un campo
// que no existe: en com_time_record_store la tienda es `store`, no `store_id`, así que
// devolvía siempre null (403 atrapado). Ahora com_time_record_store lo escribe el ETL
// (services/horarios-etl); ver results/ETL_DIRECTUS_ESQUEMA_ANALISIS.md.

/**
 * Obtiene el ID del registro en `com_time_record_store` para una tienda y fecha dada, si existe.
 */
export async function getTimeRecordStoreId(
	storeId: number,
	workDay: string,
): Promise<number | null> {
	try {
		const items = (await withAutoRefresh(() =>
			directus.request(
				readItems('com_time_record_store' as any, {
					fields: ['id'],
					filter: {
						_and: [
							{ store_id: { _eq: storeId } },
							{ work_day: { _eq: workDay } },
						],
					},
					limit: 1,
				}),
			),
		)) as { id: number }[];
		return items[0]?.id != null ? Number(items[0].id) : null;
	} catch (_error) {
		return null;
	}
}
