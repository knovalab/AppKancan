import { ESTADO, type EstadoAsistencia } from './estados';
import { LOG_TYPE, MARCACIONES, type Marcacion } from './marcaciones';
import type { EmpleadoAsistencia } from './modelo';
import { MAX_PAUSAS_ACTIVAS } from './reglas';

/** Lo que la tarjeta sabe y el empleado no: estado local o de la página. */
export interface ContextoTarjeta {
	/** Hay una pausa activa con temporizador en curso. */
	pausaEnCurso: boolean;
	/** "Sin almuerzo" confirmado en esta sesión. */
	almuerzoOmitido: boolean;
	/** La página permite aceptar normas (política) y el empleado no las ha aceptado. */
	normasPorAceptar: boolean;
}

export interface EstadoMarcacion {
	marcacion: Marcacion;
	hora: string | null;
	/** R1: es la siguiente marcación de la jornada. */
	activa: boolean;
	/** Ya registrada (las de almuerzo omitido no cuentan como hechas). */
	hecha: boolean;
	/** El botón se pinta deshabilitado (R1, R5: no es la siguiente, jornada cerrada o pausa en curso). */
	deshabilitada: boolean;
	/** Se puede pulsar para registrarla (no hecha y no deshabilitada). */
	registrable: boolean;
	/** R6: la hora se edita una sola vez. */
	editable: boolean;
	editada: boolean;
	/** R7: solo se observa una marcación existente. */
	observable: boolean;
	observacion: string;
	/** R8: ofrece "Turno sin almuerzo" en esta fila. */
	permiteSinAlmuerzo: boolean;
}

export interface VistaTarjeta {
	estado: EstadoAsistencia;
	finalizado: boolean;
	marcaciones: EstadoMarcacion[];
	/** R2 */
	puedeRegistrarNovedad: boolean;
	/** R3 */
	puedeReportarEvento: boolean;
	/** R4 */
	mostrarAceptarNormas: boolean;
	pausas: {
		hechas: number;
		max: number;
		agotadas: boolean;
		/** La línea "Pausa activa…" del header: jornada en curso. */
		visibles: boolean;
	};
}

const MARCACIONES_ALMUERZO: readonly string[] = [
	LOG_TYPE.inicioAlmuerzo,
	LOG_TYPE.finAlmuerzo,
];

export const esMarcacionDeAlmuerzo = (m: Pick<Marcacion, 'logType'>) =>
	MARCACIONES_ALMUERZO.includes(m.logType);

export function calcularVistaTarjeta(
	empleado: Pick<
		EmpleadoAsistencia,
		'estadoActual' | 'registros' | 'pausasActivasCount'
	>,
	ctx: ContextoTarjeta,
): VistaTarjeta {
	const { estadoActual: estado, registros } = empleado;
	const finalizado = estado === ESTADO.jornadaFinalizada;
	const enJornada = estado !== ESTADO.entradaPendiente && !finalizado;
	const hechas = empleado.pausasActivasCount ?? 0;
	const agotadas = hechas >= MAX_PAUSAS_ACTIVAS;

	const marcaciones = MARCACIONES.map((marcacion): EstadoMarcacion => {
		const hora = registros[marcacion.key];
		const activa = estado === marcacion.habilitadaEn;
		const anulada = ctx.almuerzoOmitido && esMarcacionDeAlmuerzo(marcacion);
		const hecha = !!hora && !anulada;
		const bloqueada = (!activa && !hecha) || anulada;
		const editada = !!registros.horasOriginales[marcacion.key];
		const deshabilitada = bloqueada || finalizado || ctx.pausaEnCurso;
		return {
			marcacion,
			hora,
			activa,
			hecha,
			deshabilitada,
			registrable: !hecha && !deshabilitada,
			editable: hecha && !editada,
			editada,
			observable: hecha,
			observacion: registros.observaciones[marcacion.key] || '',
			permiteSinAlmuerzo:
				marcacion.logType === LOG_TYPE.inicioAlmuerzo &&
				activa &&
				!ctx.almuerzoOmitido,
		};
	});

	return {
		estado,
		finalizado,
		marcaciones,
		puedeRegistrarNovedad: estado === ESTADO.entradaPendiente,
		puedeReportarEvento: enJornada && !ctx.pausaEnCurso && !agotadas,
		mostrarAceptarNormas: ctx.normasPorAceptar,
		pausas: { hechas, max: MAX_PAUSAS_ACTIVAS, agotadas, visibles: enJornada },
	};
}
