import type { Relacion } from './relacion';

/** Fila de `com_store_closed_days` (día de tienda cerrada). */
export interface StoreClosedDayDto {
	id: number;
	store_id: number;
	date: string;
	status?: boolean;
	user_created?: string;
	date_created?: string;
}

/** `com_store_closed_days` tal como llega (antes de normalizar `store_id`). */
export type StoreClosedDayRawDto = Omit<StoreClosedDayDto, 'store_id'> & {
	store_id: Relacion;
};
