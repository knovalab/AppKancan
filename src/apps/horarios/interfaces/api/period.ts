import type { EstadoPeriodo } from '../../domain/horasExtras';
import type { Relacion } from './relacion';

/** Fila de `com_period` (periodo de nómina, duración variable). */
export interface PeriodDto {
	id: number;
	name?: string | null;
	/** YYYY-MM-DD, ambos incluidos. */
	start_date: string;
	end_date: string;
	status: EstadoPeriodo;
	/** Instante de la liquidación (Timestamp, UTC). */
	liquidacion_at?: string | null;
	created_at?: string | null;
	updated_at?: string | null;
	updated_by?: Relacion<{
		id: string;
		first_name?: string | null;
		last_name?: string | null;
	}>;
}

/** Entrada de `crearPeriodo`: nace en `preliquidado`. */
export interface CreatePeriodDto {
	name?: string;
	start_date: string;
	end_date: string;
}
