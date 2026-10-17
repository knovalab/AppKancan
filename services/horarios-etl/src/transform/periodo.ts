import { sumarDias } from '../fecha.ts';

export interface RangoPeriodo {
	start_date: string;
	end_date: string;
}

/** Quincena que contiene la fecha: del 1 al 15, o del 16 al último día del mes. */
export function periodoDe(fecha: string): RangoPeriodo {
	const mes = fecha.slice(0, 7);
	if (Number(fecha.slice(8, 10)) <= 15)
		return { start_date: `${mes}-01`, end_date: `${mes}-15` };
	// Último día del mes = día anterior al 1 del mes siguiente.
	const siguiente = sumarDias(`${mes}-28`, 4).slice(0, 7);
	return {
		start_date: `${mes}-16`,
		end_date: sumarDias(`${siguiente}-01`, -1),
	};
}
