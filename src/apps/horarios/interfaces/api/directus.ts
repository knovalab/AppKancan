/**
 * Tipos genéricos de la API de Directus que no pertenecen a ninguna colección.
 */

/**
 * Filtro de una consulta (`readItems(…, { filter })`). Directus acepta operadores
 * por campo (`{ store_id: { _in: [1, 2] } }`) y grupos (`{ _and: [...] }`).
 * El SDK sin esquema no tipa los campos, así que se usa un objeto abierto con `unknown`.
 */
export type FiltroDirectus = { [campo: string]: unknown };

/** Operadores de un campo dentro de un filtro: `{ _gte: '2026-01-01', _lte: … }`. */
export type OperadoresDirectus = { [operador: string]: unknown };

/** Un error tal como lo devuelve la API REST de Directus (lo que lanza el SDK). */
export interface DirectusErrorDto {
	errors?: {
		message?: string;
		extensions?: { code?: string; field?: string; [extra: string]: unknown };
	}[];
	response?: { status?: number };
	status?: number;
	message?: string;
}

/** Item que devuelven `createItem` / `updateItem` (la fila guardada). */
export type ItemGuardado = { id?: number | string; [campo: string]: unknown };
