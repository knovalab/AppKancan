import type { EstadoHoraExtra } from '../domain/horasExtras';

/** Fila de la tabla de horas extras, ya resuelta para mostrar. */
export interface HoraExtraFila {
	id: number;
	/** YYYY-MM-DD (para ordenar y filtrar). */
	fecha: string;
	empleadoId: number | null;
	empleado: string;
	documento: string;
	tiendaId: number | null;
	tienda: string;
	/** La tienda donde trabajó no es la del empleado (rotación). */
	rotacion: boolean;
	minutos: number;
	observacion: string;
	estado: EstadoHoraExtra;
	creadaPor: string;
	/** ISO, o '' si no viene. */
	creadaEl: string;
	/** Periodo de nómina vinculado; `null` = sin vincular. Fechas YYYY-MM-DD ('' si no se expandieron). */
	periodo: { id: number; inicio: string; fin: string } | null;
}
