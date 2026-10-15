import { describe, expect, it } from 'vitest';
import {
	type ContextoTarjeta,
	calcularVistaTarjeta,
	crearRegistrosVacios,
	ESTADO,
	type EstadoAsistencia,
	LOG_TYPE,
	MAX_PAUSAS_ACTIVAS,
} from '@/apps/horarios/domain/registro';
import type { RegistrosAsistencia } from '../../domain/registro/modelo';

const CTX: ContextoTarjeta = {
	pausaEnCurso: false,
	almuerzoOmitido: false,
	normasPorAceptar: false,
};

function vista(
	estado: EstadoAsistencia,
	parcial: Partial<RegistrosAsistencia> = {},
	ctx: Partial<ContextoTarjeta> = {},
	pausas = 0,
) {
	const registros = { ...crearRegistrosVacios(), ...parcial };
	return calcularVistaTarjeta(
		{ estadoActual: estado, registros, pausasActivasCount: pausas },
		{ ...CTX, ...ctx },
	);
}

const fila = (v: ReturnType<typeof vista>, logType: string) => {
	const encontrada = v.marcaciones.find((m) => m.marcacion.logType === logType);
	if (!encontrada) throw new Error(`Sin fila para ${logType}`);
	return encontrada;
};

describe('calcularVistaTarjeta', () => {
	it('R1: solo la siguiente marcación está activa y registrable', () => {
		const v = vista(ESTADO.entradaPendiente);
		expect(v.marcaciones.map((m) => m.activa)).toEqual([
			true,
			false,
			false,
			false,
		]);
		expect(fila(v, LOG_TYPE.inicioJornada).registrable).toBe(true);
		expect(fila(v, LOG_TYPE.finJornada).deshabilitada).toBe(true);
	});

	it('R1: una marcación hecha no es registrable pero tampoco se pinta deshabilitada', () => {
		const v = vista(ESTADO.jornadaIniciada, { inicioJornada: '08:00' });
		const entrada = fila(v, LOG_TYPE.inicioJornada);
		expect(entrada.hecha).toBe(true);
		expect(entrada.registrable).toBe(false);
		expect(entrada.deshabilitada).toBe(false);
		expect(fila(v, LOG_TYPE.inicioAlmuerzo).activa).toBe(true);
	});

	it('R2: la novedad solo se registra con la entrada pendiente', () => {
		expect(vista(ESTADO.entradaPendiente).puedeRegistrarNovedad).toBe(true);
		expect(vista(ESTADO.jornadaIniciada).puedeRegistrarNovedad).toBe(false);
	});

	it('R3: la pausa se reporta en jornada, sin pausa en curso y con pausas disponibles', () => {
		expect(vista(ESTADO.entradaPendiente).puedeReportarEvento).toBe(false);
		expect(vista(ESTADO.jornadaIniciada).puedeReportarEvento).toBe(true);
		expect(
			vista(ESTADO.jornadaIniciada, {}, { pausaEnCurso: true })
				.puedeReportarEvento,
		).toBe(false);
		expect(
			vista(ESTADO.jornadaIniciada, {}, {}, MAX_PAUSAS_ACTIVAS)
				.puedeReportarEvento,
		).toBe(false);
		expect(vista(ESTADO.jornadaFinalizada).puedeReportarEvento).toBe(false);
	});

	it('R3: contador de pausas visible solo con la jornada en curso', () => {
		const v = vista(ESTADO.enAlmuerzo, {}, {}, 1);
		expect(v.pausas).toEqual({
			hechas: 1,
			max: MAX_PAUSAS_ACTIVAS,
			agotadas: false,
			visibles: true,
		});
		expect(vista(ESTADO.jornadaFinalizada).pausas.visibles).toBe(false);
	});

	it('R4: "Aceptar normas" sigue al contexto', () => {
		expect(
			vista(ESTADO.entradaPendiente, {}, { normasPorAceptar: true })
				.mostrarAceptarNormas,
		).toBe(true);
		expect(vista(ESTADO.entradaPendiente).mostrarAceptarNormas).toBe(false);
	});

	it('R5: con una pausa en curso no se puede marcar nada', () => {
		const v = vista(
			ESTADO.jornadaIniciada,
			{ inicioJornada: '08:00' },
			{ pausaEnCurso: true },
		);
		expect(v.marcaciones.every((m) => !m.registrable)).toBe(true);
		expect(fila(v, LOG_TYPE.inicioAlmuerzo).deshabilitada).toBe(true);
	});

	it('R6: la hora se edita una sola vez', () => {
		const sinEditar = vista(ESTADO.jornadaIniciada, { inicioJornada: '08:00' });
		expect(fila(sinEditar, LOG_TYPE.inicioJornada).editable).toBe(true);
		const editada = vista(ESTADO.jornadaIniciada, {
			inicioJornada: '08:10',
			horasOriginales: { inicioJornada: '08:00' },
		});
		expect(fila(editada, LOG_TYPE.inicioJornada).editable).toBe(false);
		expect(fila(editada, LOG_TYPE.inicioJornada).editada).toBe(true);
	});

	it('R7: solo se observa una marcación existente', () => {
		const v = vista(ESTADO.jornadaIniciada, {
			inicioJornada: '08:00',
			observaciones: { inicioJornada: 'Llegó tarde' },
		});
		expect(fila(v, LOG_TYPE.inicioJornada).observable).toBe(true);
		expect(fila(v, LOG_TYPE.inicioJornada).observacion).toBe('Llegó tarde');
		expect(fila(v, LOG_TYPE.finJornada).observable).toBe(false);
	});

	it('R8: "sin almuerzo" solo en inicio de almuerzo activo y no omitido', () => {
		expect(
			fila(vista(ESTADO.jornadaIniciada), LOG_TYPE.inicioAlmuerzo)
				.permiteSinAlmuerzo,
		).toBe(true);
		expect(
			fila(vista(ESTADO.entradaPendiente), LOG_TYPE.inicioAlmuerzo)
				.permiteSinAlmuerzo,
		).toBe(false);
		expect(
			fila(
				vista(ESTADO.jornadaIniciada, {}, { almuerzoOmitido: true }),
				LOG_TYPE.inicioAlmuerzo,
			).permiteSinAlmuerzo,
		).toBe(false);
	});

	it('R8: con el almuerzo omitido las casillas de almuerzo no cuentan como hechas y quedan bloqueadas', () => {
		const v = vista(
			ESTADO.regresoAlmuerzo,
			{ inicioJornada: '08:00', inicioAlmuerzo: '12:00', finAlmuerzo: '12:00' },
			{ almuerzoOmitido: true },
		);
		const almuerzo = fila(v, LOG_TYPE.inicioAlmuerzo);
		expect(almuerzo.hecha).toBe(false);
		expect(almuerzo.deshabilitada).toBe(true);
		expect(almuerzo.observable).toBe(false);
		expect(fila(v, LOG_TYPE.finJornada).registrable).toBe(true);
	});

	it('jornada finalizada: nada registrable', () => {
		const v = vista(ESTADO.jornadaFinalizada, {
			inicioJornada: '08:00',
			inicioAlmuerzo: '12:00',
			finAlmuerzo: '13:00',
			finJornada: '17:00',
		});
		expect(v.finalizado).toBe(true);
		expect(v.marcaciones.every((m) => !m.registrable)).toBe(true);
	});
});
