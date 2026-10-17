import type { ClienteDirectus } from '../directus/client.ts';
import { conReintentos, describirError } from '../directus/errors.ts';
import { marcacionesDelDia, tiendasCerradas } from '../extract/dia.ts';
import { ayerBogota, hoyBogota } from '../fecha.ts';
import { asegurarPeriodo } from '../load/periodo.ts';
import { guardarDiasTienda } from '../load/registroTienda.ts';
import {
	calcularDiasTienda,
	type DiaTiendaCalculado,
} from '../transform/diaTienda.ts';
import { periodoDe } from '../transform/periodo.ts';

export interface Opciones {
	/** Calcula y devuelve las filas sin escribir en Directus. */
	dryRun?: boolean;
}

export interface ResultadoDiaTienda {
	fecha: string;
	marcaciones: number;
	tiendas: number;
	sinCierre: number;
	cerradas: number;
	creadas: number;
	actualizadas: number;
	filas?: DiaTiendaCalculado[];
}

/** Calcula y guarda el día operativo de todas las tiendas para `fecha`. */
export async function ejecutarDiaTienda(
	directus: ClienteDirectus,
	fecha: string,
	{ dryRun = false }: Opciones = {},
): Promise<ResultadoDiaTienda> {
	const [marcaciones, cerradas] = await Promise.all([
		conReintentos(() => marcacionesDelDia(directus, fecha)),
		conReintentos(() => tiendasCerradas(directus, fecha)),
	]);
	const filas = calcularDiasTienda(fecha, marcaciones, cerradas);
	const resumen = {
		fecha,
		marcaciones: marcaciones.length,
		tiendas: filas.length,
		sinCierre: filas.filter((f) => f.close_time === null).length,
		cerradas: cerradas.size,
	};
	if (dryRun) return { ...resumen, creadas: 0, actualizadas: 0, filas };

	// Sin reintentos en la escritura: un reintento tras un timeout podría crear la fila dos veces.
	const guardado = await guardarDiasTienda(directus, fecha, filas);
	return { ...resumen, ...guardado };
}

/** Lo que hace el cron cada noche: asegurar el periodo de hoy y cerrar el día de ayer. */
export async function ejecutarNocturno(
	directus: ClienteDirectus,
	opciones: Opciones = {},
) {
	const rango = periodoDe(hoyBogota());
	// Pasos independientes: si falla el periodo (p. ej. 403 sin permiso de Crear), el día de tienda se calcula igual.
	const [periodo, dia] = await Promise.allSettled([
		opciones.dryRun
			? Promise.resolve({ ...rango, creado: false })
			: asegurarPeriodo(directus, rango).then((p) => ({ ...rango, ...p })),
		ejecutarDiaTienda(directus, ayerBogota(), opciones),
	]);
	const resultado = <T>(r: PromiseSettledResult<T>) =>
		r.status === 'fulfilled' ? r.value : { error: describirError(r.reason) };
	if (periodo.status === 'rejected' && dia.status === 'rejected')
		throw dia.reason;
	return { periodo: resultado(periodo), dia: resultado(dia) };
}
