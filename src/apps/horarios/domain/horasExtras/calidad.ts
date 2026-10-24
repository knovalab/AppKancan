import { ESTADO_HORA_EXTRA, type EstadoHoraExtra } from './estados';

/** Registrada más de estos días después de trabajada = registro tardío. */
export const DIAS_REGISTRO_TARDIO = 3;

/** Una hora extra con lo que mide la calidad del proceso (ya normalizada). */
export interface HoraCalidad {
	storeId: number | null;
	empleadoId: number | null;
	/** Quién la registró (nombre). */
	registrador: string | null;
	/** `work_date` YYYY-MM-DD */
	fecha: string;
	estado: EstadoHoraExtra;
	/** `created_at` y `reviewed_at` como YYYY-MM-DD HH:mm en hora local. */
	creada: string | null;
	revisada: string | null;
	/** Inicio del periodo al que se vinculó (si se liquidó). */
	inicioPeriodo: string | null;
	minutos: number;
}

export interface CalidadGrupo {
	clave: string;
	registros: number;
	revisadas: number;
	rechazadas: number;
	/** rechazadas / revisadas; `null` sin revisadas. */
	tasaRechazo: number | null;
	/** Mediana de `revisada − creada`, en horas. */
	medianaAprobacion: number | null;
	/** Mediana de `creada − fecha trabajada`, en días. */
	medianaAtraso: number | null;
	/** Registradas más de `DIAS_REGISTRO_TARDIO` días después. */
	tardias: number;
	/** Pagadas en un periodo posterior a su fecha. */
	rezagadas: number;
	minutosRezagados: number;
}

export interface CalidadProceso {
	total: CalidadGrupo;
	/** Más rechazo primero, luego más atraso. */
	porTienda: CalidadGrupo[];
	porRegistrador: CalidadGrupo[];
	/** Registros de más: misma persona y día con más de una activa. */
	duplicados: number;
}

// Las sugeridas (servicio) y las descartadas por el líder no pasaron por el flujo.
const DEL_FLUJO: readonly EstadoHoraExtra[] = [
	ESTADO_HORA_EXTRA.pendiente,
	ESTADO_HORA_EXTRA.aprobada,
	ESTADO_HORA_EXTRA.descartadaComercial,
];

const mediana = (xs: number[]) => {
	if (xs.length === 0) return null;
	const o = [...xs].sort((a, b) => a - b);
	const m = Math.floor(o.length / 2);
	return o.length % 2 ? o[m] : (o[m - 1] + o[m]) / 2;
};
const DIA = 24 * 60 * 60 * 1000;
// Mediodía para no cruzar de día por zona horaria.
const dias = (desde: string, hasta: string) =>
	Math.round(
		(Date.parse(`${hasta.slice(0, 10)}T12:00:00`) -
			Date.parse(`${desde.slice(0, 10)}T12:00:00`)) /
			DIA,
	);
const horas = (desde: string, hasta: string) =>
	(Date.parse(hasta.replace(' ', 'T')) - Date.parse(desde.replace(' ', 'T'))) /
	(60 * 60 * 1000);

function grupo(clave: string, hs: readonly HoraCalidad[]): CalidadGrupo {
	const revisadas = hs.filter(
		(h) => h.estado !== ESTADO_HORA_EXTRA.pendiente && h.revisada,
	);
	const rechazadas = revisadas.filter(
		(h) => h.estado === ESTADO_HORA_EXTRA.descartadaComercial,
	).length;
	const atrasos = hs
		.filter((h) => h.creada)
		.map((h) => dias(h.fecha, h.creada as string));
	const rezagadas = hs.filter(
		(h) =>
			h.estado === ESTADO_HORA_EXTRA.aprobada &&
			h.inicioPeriodo != null &&
			h.fecha < h.inicioPeriodo,
	);
	return {
		clave,
		registros: hs.length,
		revisadas: revisadas.length,
		rechazadas,
		tasaRechazo: revisadas.length ? rechazadas / revisadas.length : null,
		medianaAprobacion: mediana(
			revisadas
				.filter((h) => h.creada)
				.map((h) => horas(h.creada as string, h.revisada as string)),
		),
		medianaAtraso: mediana(atrasos),
		tardias: atrasos.filter((d) => d > DIAS_REGISTRO_TARDIO).length,
		rezagadas: rezagadas.length,
		minutosRezagados: rezagadas.reduce((s, h) => s + h.minutos, 0),
	};
}

function agrupar(
	hs: readonly HoraCalidad[],
	clave: (h: HoraCalidad) => string,
): CalidadGrupo[] {
	const grupos = new Map<string, HoraCalidad[]>();
	for (const h of hs) {
		const k = clave(h);
		grupos.set(k, [...(grupos.get(k) ?? []), h]);
	}
	return [...grupos]
		.map(([k, g]) => grupo(k, g))
		.sort(
			(a, b) =>
				(b.tasaRechazo ?? -1) - (a.tasaRechazo ?? -1) ||
				(b.medianaAtraso ?? -1) - (a.medianaAtraso ?? -1),
		);
}

/**
 * Calidad del proceso (R5): tiempo de aprobación, registro tardío, tasa de
 * rechazo, rezagadas y duplicados, en total, por tienda y por quién registra.
 */
export function calidadProceso(
	horasExtras: readonly HoraCalidad[],
): CalidadProceso {
	const hs = horasExtras.filter((h) => DEL_FLUJO.includes(h.estado));
	const activas = new Map<string, number>();
	for (const h of hs) {
		if (h.estado === ESTADO_HORA_EXTRA.descartadaComercial) continue;
		if (h.empleadoId == null) continue;
		const k = `${h.empleadoId}|${h.fecha}`;
		activas.set(k, (activas.get(k) ?? 0) + 1);
	}
	return {
		total: grupo('total', hs),
		porTienda: agrupar(hs, (h) => String(h.storeId ?? '')),
		porRegistrador: agrupar(hs, (h) => h.registrador ?? ''),
		duplicados: [...activas.values()].reduce(
			(s, n) => s + Math.max(0, n - 1),
			0,
		),
	};
}
