import dayjs from 'dayjs';
import { useMemo, useState } from 'react';
import {
	crearRegistrosVacios,
	ESTADO,
	EVENTO,
	ID_EMPLEADO_DEMO,
	keyPorLogType,
	MAX_PAUSAS_ACTIVAS,
	marcacionPorLogType,
} from '../../domain/registro';
import type { EmpleadoAsistencia } from '../../interfaces/horarios.interface';
import type { AccionesTarjeta } from '../../interfaces/registro';

const OK = { ok: true } as const;

/**
 * `AccionesTarjeta` en memoria para la tarjeta del tour. Mismo contrato que la real:
 * la tarjeta no necesita saber que es demo. Replica el comportamiento que tenían
 * los handlers *Demo de RegistrosPage.
 */
export function useAccionesDemo() {
	const [empleado, setEmpleado] = useState<EmpleadoAsistencia>(() => ({
		id: ID_EMPLEADO_DEMO,
		documento: '0000000000',
		nombre: 'USUARIO DE EJEMPLO',
		cargo: '',
		estadoActual: ESTADO.entradaPendiente,
		pausasActivasCount: 0,
		registros: crearRegistrosVacios(),
	}));

	const acciones = useMemo<AccionesTarjeta>(() => {
		/** Igual que antes: marcar (o editar) fija la hora y el estado de esa marcación. */
		const marcar = (logType: string, hora: string, observacion?: string) => {
			const marcacion = marcacionPorLogType(logType);
			if (!marcacion) return;
			setEmpleado((prev) => ({
				...prev,
				estadoActual: marcacion.estadoResultante,
				registros: {
					...prev.registros,
					[marcacion.key]: hora,
					observaciones: observacion
						? { ...prev.registros.observaciones, [marcacion.key]: observacion }
						: { ...prev.registros.observaciones },
				},
			}));
		};

		return {
			registrar: async ({ marcacion }) => {
				marcar(marcacion, dayjs().format('HH:mm'));
				return OK;
			},
			editarHora: async ({ marcacion, hora, observacion }) => {
				marcar(marcacion, hora, observacion);
				return OK;
			},
			observar: async ({ marcacion, texto }) => {
				const key = keyPorLogType(marcacion);
				if (key) {
					setEmpleado((prev) => ({
						...prev,
						registros: {
							...prev.registros,
							observaciones: { ...prev.registros.observaciones, [key]: texto },
						},
					}));
				}
				return OK;
			},
			reportarEvento: async ({ tipo }) => {
				if (tipo === EVENTO.terminarPausaActiva) {
					setEmpleado((prev) => ({
						...prev,
						pausasActivasCount: Math.min(
							(prev.pausasActivasCount ?? 0) + 1,
							MAX_PAUSAS_ACTIVAS,
						),
					}));
				}
				return OK;
			},
			agregarNovedad: async () => OK,
			verificarNormas: async () => true,
			aceptarNormas: async () => OK,
			motivoDeMarcacion: async () => null,
		};
	}, []);

	return { empleado, acciones };
}
