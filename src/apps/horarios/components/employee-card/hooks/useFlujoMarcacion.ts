import { useCallback, useRef, useState } from 'react';
import {
	type ContextoPasos,
	type LogType,
	type PasoPrevio,
	pasosPrevios,
} from '../../../domain/registro';
import type { Resultado } from '../../../interfaces/comunes';
import type { AccionesTarjeta } from '../../../interfaces/registro';
import type { VerificationData } from '../../../interfaces/verificacion';

interface PasoEnCurso {
	/** null = normas abiertas a mano (botón "Aceptar normas"), sin marcación detrás. */
	marcacion: LogType | null;
	paso: PasoPrevio;
	/** Pasos que faltan después del actual. */
	resto: PasoPrevio[];
}

export function useFlujoMarcacion(
	empleadoId: string,
	acciones: AccionesTarjeta,
	ctx: ContextoPasos,
) {
	const [actual, setActual] = useState<PasoEnCurso | null>(null);
	const [guardando, setGuardando] = useState<LogType | null>(null);
	const [aceptandoNormas, setAceptandoNormas] = useState(false);

	// Refs: los callbacks son estables aunque cambien acciones/contexto (memo de las filas).
	const accionesRef = useRef(acciones);
	accionesRef.current = acciones;
	const ctxRef = useRef(ctx);
	ctxRef.current = ctx;
	const actualRef = useRef(actual);
	actualRef.current = actual;

	const registrar = useCallback(
		async (
			marcacion: LogType,
			verificacion?: VerificationData,
		): Promise<Resultado> => {
			setGuardando(marcacion);
			try {
				return await accionesRef.current.registrar({
					empleadoId,
					marcacion,
					verificacion,
				});
			} finally {
				setGuardando(null);
			}
		},
		[empleadoId],
	);

	/** Recorre los pasos pendientes; abre el primero que necesita al usuario o registra. */
	const avanzar = useCallback(
		async (
			marcacion: LogType,
			pasos: PasoPrevio[],
			verificacion?: VerificationData,
		): Promise<Resultado | null> => {
			let pendientes = pasos;
			while (pendientes.length > 0) {
				const [paso, ...resto] = pendientes;
				if (paso === 'normas') {
					// Consulta fresca a Directus: una aceptación borrada o hecha en otro dispositivo cuenta ya.
					setGuardando(marcacion);
					const acepto = await accionesRef.current.verificarNormas(empleadoId);
					setGuardando(null);
					if (acepto) {
						pendientes = resto;
						continue;
					}
				}
				setActual({ marcacion, paso, resto });
				return null;
			}
			return registrar(marcacion, verificacion);
		},
		[empleadoId, registrar],
	);

	const iniciar = useCallback(
		(marcacion: LogType) => {
			void avanzar(marcacion, pasosPrevios(marcacion, ctxRef.current));
		},
		[avanzar],
	);

	/** Lo llama el modal de foto + GPS. Lanza si falla, para que el modal muestre el error. */
	const confirmarVerificacion = useCallback(
		async (datos: VerificationData) => {
			const enCurso = actualRef.current;
			if (!enCurso?.marcacion || enCurso.paso !== 'verificacion') return;
			const resultado = await avanzar(enCurso.marcacion, enCurso.resto, datos);
			if (resultado && !resultado.ok) throw new Error(resultado.error);
		},
		[avanzar],
	);

	/** El modal de foto se cierra solo tras confirmar o al cancelar. */
	const cerrarVerificacion = useCallback(() => {
		setActual((a) => (a?.paso === 'verificacion' ? null : a));
	}, []);

	const aceptarNormas = useCallback(async () => {
		setAceptandoNormas(true);
		const resultado = await accionesRef.current.aceptarNormas(empleadoId);
		setAceptandoNormas(false);
		if (!resultado.ok) return; // el modal obligatorio sigue abierto; el error va en el snackbar
		const enCurso = actualRef.current;
		setActual(null);
		// Si venía de "Comenzar Jornada", sigue con el siguiente paso (foto + GPS).
		if (enCurso?.marcacion) void avanzar(enCurso.marcacion, enCurso.resto);
	}, [empleadoId, avanzar]);

	const abrirNormas = useCallback(() => {
		setActual({ marcacion: null, paso: 'normas', resto: [] });
	}, []);

	const cancelar = useCallback(() => setActual(null), []);

	return {
		paso: actual?.paso ?? null,
		marcacion: actual?.marcacion ?? null,
		guardando,
		aceptandoNormas,
		iniciar,
		registrar,
		confirmarVerificacion,
		cerrarVerificacion,
		aceptarNormas,
		abrirNormas,
		cancelar,
	};
}
