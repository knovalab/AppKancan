/** Fila de `com_store_closed_days` (día de tienda cerrada). */
export interface StoreClosedDayDto {
	id: number;
	store_id: number;
	date: string;
	status?: boolean;
	user_created?: string;
	date_created?: string;
}
