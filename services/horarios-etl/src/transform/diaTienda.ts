import { sumarDias } from '../fecha.ts';

/** Texto de `com_time_records.log_type` (copia de src/apps/horarios/domain/registro/marcaciones.ts). */
export const FIN_JORNADA = 'Terminar Jornada';

/** Lo mínimo de una marcación que necesita el cálculo. */
export interface MarcacionDia {
	store_id: string | { id: string } | null;
	log_type: string;
	record_time: string | null;
}

/** Fila de `com_time_record_store` que escribe el ETL (sin id ni campos de sistema). */
export interface DiaTiendaCalculado {
	store: string;
	work_day: string;
	/** DateTime local de Bogotá, sin zona: 'YYYY-MM-DDTHH:mm:ss' */
	open_time: string;
	close_time: string | null;
	/** Minutos entre apertura y cierre; null si no hay cierre. */
	operative_time: number | null;
}

const idTienda = (s: MarcacionDia['store_id']) =>
	s == null ? null : String(typeof s === 'object' ? s.id : s);

/** 'H:mm' o 'HH:mm:ss' → 'HH:mm:ss'; null si no es una hora válida. */
function normalizarHora(h: string | null): string | null {
	const m = h?.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/);
	if (!m || Number(m[1]) > 23 || Number(m[2]) > 59) return null;
	return `${m[1].padStart(2, '0')}:${m[2]}:${m[3] ?? '00'}`;
}

const segundos = (h: string) => {
	const [a, b, c] = h.split(':').map(Number);
	return a * 3600 + b * 60 + c;
};

/**
 * Día operativo de cada tienda (ETL_HORAS_EXTRAS.md §6.1):
 * - apertura = primera marcación del día que no sea 'Terminar Jornada' (una salida no abre la tienda);
 * - cierre = última 'Terminar Jornada'; si no hay ninguna, cierre y tiempo operativo quedan en null;
 * - las tiendas cerradas ese día, sin marcaciones o con solo salidas no generan fila.
 */
export function calcularDiasTienda(
	fecha: string,
	marcaciones: MarcacionDia[],
	tiendasCerradas: ReadonlySet<string> = new Set(),
): DiaTiendaCalculado[] {
	const porTienda = new Map<
		string,
		{ apertura: string | null; cierre: string | null }
	>();

	for (const m of marcaciones) {
		const tienda = idTienda(m.store_id);
		const hora = normalizarHora(m.record_time);
		if (!tienda || !hora || tiendasCerradas.has(tienda)) continue;

		const actual = porTienda.get(tienda) ?? { apertura: null, cierre: null };
		if (m.log_type === FIN_JORNADA) {
			if (!actual.cierre || hora > actual.cierre) actual.cierre = hora;
		} else if (!actual.apertura || hora < actual.apertura) {
			actual.apertura = hora;
		}
		porTienda.set(tienda, actual);
	}

	return (
		[...porTienda.entries()]
			.sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
			// Solo salidas, sin ninguna entrada: no se puede saber cuándo abrió.
			.flatMap(([store, { apertura, cierre }]) =>
				apertura ? [{ store, apertura, cierre }] : [],
			)
			.map(({ store, apertura, cierre }) => {
				// shortcut: solo cruza la medianoche si TODOS los cierres son anteriores a la apertura; con turnos mixtos gana el cierre del mismo día. Revisar si hay tiendas 24 h.
				const cruza = cierre !== null && cierre < apertura;
				const diff =
					cierre === null
						? null
						: segundos(cierre) - segundos(apertura) + (cruza ? 86400 : 0);
				return {
					store,
					work_day: fecha,
					open_time: `${fecha}T${apertura}`,
					close_time:
						cierre === null
							? null
							: `${cruza ? sumarDias(fecha, 1) : fecha}T${cierre}`,
					operative_time: diff === null ? null : Math.floor(diff / 60),
				};
			})
	);
}
