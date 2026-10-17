import type { ClienteDirectus } from '../directus/client.ts';
import type { HoraExtraCalculada } from '../transform/horasExtras.ts';

/**
 * Guarda horas extras en `com_over_time`.
 * shortcut: sin implementar hasta que exista la regla (ETL_HORAS_EXTRAS.md §8.1). Al hacerlo:
 * upsert por (employee_id, period_id) y no tocar filas que no estén en 'Gen' (la política también lo impide).
 */
export async function guardarHorasExtras(
	_directus: ClienteDirectus,
	_filas: HoraExtraCalculada[],
): Promise<{ creadas: number; actualizadas: number }> {
	return { creadas: 0, actualizadas: 0 };
}
