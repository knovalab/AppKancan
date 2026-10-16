import { useMemo, useRef } from 'react';
import { useGlobalSnackbar } from '@/shared/components/SnackbarsPosition/SnackbarContext';
import { getRecordReasonId } from '../../api/directus/read';
import {
	registrarAceptacionNormasEmpleado,
} from '../../api/directus/rules';
import { keyPorLogType, type LogType } from '../../domain/registro';
import type { Resultado } from '../../interfaces/comunes';
import type { NuevaNovedadInput } from '../../interfaces/novedades';
import type { AccionesTarjeta } from '../../interfaces/registro';
import { mensajeDeError } from '../../utils/errores';
import { useAccionesRegistro } from './useAccionesRegistro';
import type { Normas } from '../../interfaces/normas';
import type { EmpleadoAsistencia } from '../../domain/registro/modelo';

interface Opciones {
	storeId: number | null;
	/** Empleados del día: de aquí sale el id de cada marcación (registros.ids). */
	empleados: EmpleadoAsistencia[];
	agregarNovedad: (input: NuevaNovedadInput) => Promise<boolean> | boolean;
	normas: Normas | null;
	verificarAceptacion: (empleadoId: string) => Promise<boolean>;
	marcarAceptado: (empleadoId: string) => void;
}

const MENSAJE_SIN_REGISTRO_HORA =
	'No se encontró el registro para editar la hora.';
const MENSAJE_SIN_REGISTRO_OBS =
	'No se encontró el registro de tiempo para actualizar la observación.';

/**
 * `AccionesTarjeta` contra Directus. Traduce lo que pide la tarjeta (empleado + marcación)
 * a las acciones del registro (por id de registro) y concentra aquí las llamadas que
 * antes hacía el componente: aceptar normas y leer el motivo de una edición (E7).
 *
 * El objeto devuelto es estable: lee las dependencias de refs, así las filas
 * memorizadas de la tarjeta no se re-renderizan por un cambio de la página.
 */
export function useAccionesTarjeta(opciones: Opciones): AccionesTarjeta {
	const registro = useAccionesRegistro(opciones.storeId);
	const { showSnackbar } = useGlobalSnackbar();

	const ref = useRef({ ...opciones, registro, showSnackbar });
	ref.current = { ...opciones, registro, showSnackbar };

	return useMemo<AccionesTarjeta>(() => {
		const recordIdDe = (empleadoId: string, marcacion: LogType) => {
			const key = keyPorLogType(marcacion);
			const empleado = ref.current.empleados.find(
				(e) => String(e.id) === String(empleadoId),
			);
			return key ? empleado?.registros.ids[key] : undefined;
		};
		const fallo = (error: string): Resultado => {
			ref.current.showSnackbar(error, 'error');
			return { ok: false, error };
		};

		return {
			registrar: ({ empleadoId, marcacion, verificacion }) =>
				ref.current.registro.registrar({
					empleadoId: Number(empleadoId),
					marcacion,
					verificacion,
				}),

			editarHora: async ({
				empleadoId,
				marcacion,
				hora,
				motivoId,
				observacion,
			}) => {
				const recordId = recordIdDe(empleadoId, marcacion);
				if (recordId == null) return fallo(MENSAJE_SIN_REGISTRO_HORA);
				return ref.current.registro.editarHora({
					recordId,
					hora,
					motivoId,
					observacion,
				});
			},

			observar: async ({ empleadoId, marcacion, texto }) => {
				const recordId = recordIdDe(empleadoId, marcacion);
				if (recordId == null) return fallo(MENSAJE_SIN_REGISTRO_OBS);
				return ref.current.registro.observar({ recordId, texto });
			},

			reportarEvento: ({ empleadoId, tipo, observacion }) =>
				ref.current.registro.reportarEvento({
					empleadoId: Number(empleadoId),
					tipo,
					observacion,
				}),

			// agregarNovedad ya muestra su error (snackbar o alerta de la página).
			agregarNovedad: async (input) =>
				(await ref.current.agregarNovedad(input))
					? { ok: true }
					: { ok: false, error: 'No se pudo registrar la novedad.' },

			verificarNormas: (empleadoId) =>
				ref.current.verificarAceptacion(empleadoId),

			aceptarNormas: async (empleadoId) => {
				const { normas } = ref.current;
				if (!normas) return { ok: false, error: 'No hay normas vigentes.' };
				try {
					await registrarAceptacionNormasEmpleado(
						Number(empleadoId),
						normas.version,
						normas.id,
					);
					ref.current.marcarAceptado(empleadoId);
					return { ok: true };
				} catch (err) {
					console.error(
						'Error al registrar aceptación de normas del empleado:',
						err,
					);
					// Antes solo quedaba en consola (E2).
					return fallo(mensajeDeError(err, 'Error al guardar aceptación de normas'));
				}
			},

			motivoDeMarcacion: async ({ empleadoId, marcacion }) => {
				const recordId = recordIdDe(empleadoId, marcacion);
				return recordId == null ? null : getRecordReasonId(recordId);
			},
		};
	}, []);
}
