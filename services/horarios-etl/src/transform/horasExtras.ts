/** Fila de `com_over_time` que generaría el ETL (sin id ni campos de sistema). */
export interface HoraExtraCalculada {
	employee_id: number;
	store_id: string | null;
	period_id: number;
	minutes: number;
}

/**
 * Horas extras de un periodo.
 * shortcut: regla de horas extras sin definir (las declaran los líderes de zona; ETL_HORAS_EXTRAS.md §8.1), implementar cuando el negocio la fije.
 */
export function calcularHorasExtras(): HoraExtraCalculada[] {
	return [];
}
