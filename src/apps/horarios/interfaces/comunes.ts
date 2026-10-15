/** Resultado de toda acción de escritura: quien llama decide qué hacer con el error. */
export type Resultado =
	| { ok: true; id?: number }
	| { ok: false; error: string };

/** Festivos por fecha: `'YYYY-MM-DD' → nombre` (misma forma que `HolidayMap` de reservas/useHolidays). */
export type MapaFestivos = Record<string, string>;
