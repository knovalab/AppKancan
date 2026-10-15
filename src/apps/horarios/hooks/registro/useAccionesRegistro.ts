import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import { useGlobalSnackbar } from '@/shared/components/SnackbarsPosition/SnackbarContext';
import {
	createEventReport,
	createTimeRecord,
	updateTimeRecord,
	upsertRecordReason,
} from '../../api/directus/create';
import {
	getMarcacionExistenteId,
	idRelacion,
} from '../../api/directus/read';
import type { Resultado } from '../../interfaces/comunes';
import type {
	EditarHoraInput,
	ObservarInput,
	RegistrarInput,
	ReportarEventoInput,
} from '../../interfaces/registro';
import { hora24 } from '../../utils/format';
import { getRealColombiaTime } from '../../utils/timeSync';
import { horariosKeys } from './keys';

// Contratos en interfaces/ (se reexportan para no romper imports existentes).
export type { Resultado } from '../../interfaces/comunes';
export type {
	EditarHoraInput,
	ObservarInput,
	RegistrarInput,
	ReportarEventoInput,
} from '../../interfaces/registro';
import type { TimeRecordDto } from '../../interfaces/api/timeRecords';

export const MENSAJE_MARCACION_REPETIDA =
	'Esta marcación ya está registrada hoy. Para cambiar la hora usa "Editar hora".';
const MENSAJE_SIN_TIENDA =
	'No hay una tienda seleccionada: no se puede guardar el registro.';

const mensajeDe = (err: unknown, porDefecto: string) =>
	err instanceof Error && err.message ? err.message : porDefecto;

/**
 * Acciones de escritura del registro de horarios. Ninguna lanza: todas devuelven
 * `Resultado` y muestran su snackbar. Sustituyen a la lógica que estaba en useHorarios.
 *
 * - `registrar` SIEMPRE crea. Si la marcación ya existe (en la caché o en Directus),
 *   se rechaza (decisión de negocio del 2026-10-14).
 * - `editarHora` actualiza por id, sin buscar en la caché por fecha del dispositivo.
 */
export function useAccionesRegistro(storeId: number | null) {
	const queryClient = useQueryClient();
	const { showSnackbar } = useGlobalSnackbar();

	const fallo = useCallback(
		(error: string): Resultado => {
			showSnackbar(error, 'error');
			return { ok: false, error };
		},
		[showSnackbar],
	);

	/** Registro de la caché de la tienda (cualquier fecha) por id. */
	const buscarEnCache = useCallback(
		(recordId: number): TimeRecordDto | undefined => {
			const consultas = queryClient.getQueriesData<TimeRecordDto[]>({
				queryKey: horariosKeys.timeRecords.tienda(storeId),
			});
			for (const [, records] of consultas) {
				const r = records?.find((x) => x.id === recordId);
				if (r) return r;
			}
			return undefined;
		},
		[queryClient, storeId],
	);

	const invalidarMarcaciones = useCallback(
		() =>
			queryClient.invalidateQueries({
				queryKey: horariosKeys.timeRecords.tienda(storeId),
			}),
		[queryClient, storeId],
	);

	const registrar = useCallback(
		async ({
			empleadoId,
			marcacion,
			verificacion,
			observacion,
		}: RegistrarInput): Promise<Resultado> => {
			if (storeId == null) return fallo(MENSAJE_SIN_TIENDA);
			const ahora = getRealColombiaTime();
			const fecha = ahora.format('YYYY-MM-DD');

			// 1) Caché del día: respuesta inmediata en el caso normal.
			const enCache = queryClient
				.getQueryData<TimeRecordDto[]>(
					horariosKeys.timeRecords.dia(storeId, fecha),
				)
				?.some(
					(r) =>
						idRelacion(r.employee_id) === empleadoId &&
						r.log_type === marcacion,
				);
			if (enCache) return fallo(MENSAJE_MARCACION_REPETIDA);

			try {
				// 2) Directus: cubre otro dispositivo o una caché sin refrescar.
				const existente = await getMarcacionExistenteId(
					empleadoId,
					marcacion,
					fecha,
				);
				if (existente != null) {
					void invalidarMarcaciones();
					return fallo(MENSAJE_MARCACION_REPETIDA);
				}

				const creado = (await createTimeRecord({
					employee_id: empleadoId,
					store_id: storeId,
					log_type: marcacion,
					record_date: fecha,
					record_time: ahora.format('HH:mm:ss'),
					observations: observacion ?? '',
					latitude: verificacion?.latitude,
					longitude: verificacion?.longitude,
					accuracy: verificacion?.accuracy,
					photo: verificacion?.photo,
				})) as { id?: number | string } | null;

				void invalidarMarcaciones();
				showSnackbar(
					`Registro de "${marcacion}" guardado con éxito`,
					'success',
				);
				return {
					ok: true,
					id: creado?.id != null ? Number(creado.id) : undefined,
				};
			} catch (err) {
				console.error('Error al registrar marcación:', err);
				return fallo(
					mensajeDe(err, 'Error al guardar el registro de asistencia'),
				);
			}
		},
		[storeId, queryClient, fallo, invalidarMarcaciones, showSnackbar],
	);

	const editarHora = useCallback(
		async ({
			recordId,
			hora,
			motivoId,
			observacion,
		}: EditarHoraInput): Promise<Resultado> => {
			const recordTime = hora24(hora);
			if (!recordTime) return fallo(`Hora no válida: "${hora}"`);

			const actual = buscarEnCache(recordId);
			// La hora original solo se guarda la primera vez (después ya no se puede editar).
			const originalTime = actual
				? actual.original_record_time || actual.record_time
				: undefined;

			try {
				await updateTimeRecord(recordId, {
					record_time: recordTime,
					original_record_time: originalTime,
					observations: observacion,
				});
				if (motivoId != null) await upsertRecordReason(recordId, motivoId);
				void invalidarMarcaciones();
				showSnackbar('Registro actualizado correctamente', 'success');
				return { ok: true, id: recordId };
			} catch (err) {
				console.error('Error al editar la hora:', err);
				return fallo(mensajeDe(err, 'Error al actualizar el registro'));
			}
		},
		[buscarEnCache, fallo, invalidarMarcaciones, showSnackbar],
	);

	const observar = useCallback(
		async ({ recordId, texto }: ObservarInput): Promise<Resultado> => {
			try {
				await updateTimeRecord(recordId, { observations: texto });
				void invalidarMarcaciones();
				showSnackbar('Registro actualizado correctamente', 'success');
				return { ok: true, id: recordId };
			} catch (err) {
				console.error('Error al guardar observación:', err);
				return fallo(mensajeDe(err, 'Error al actualizar el registro'));
			}
		},
		[fallo, invalidarMarcaciones, showSnackbar],
	);

	const reportarEvento = useCallback(
		async ({
			empleadoId,
			tipo,
			observacion,
		}: ReportarEventoInput): Promise<Resultado> => {
			if (storeId == null) return fallo(MENSAJE_SIN_TIENDA);
			try {
				const ahora = getRealColombiaTime();
				await createEventReport({
					employee_id: empleadoId,
					event_type: tipo,
					observations: observacion,
					store_id: storeId,
					date: ahora.format('YYYY-MM-DD'),
					hour: ahora.format('HH:mm:ss'),
				});
				showSnackbar('Evento reportado con éxito', 'success');
				void queryClient.invalidateQueries({
					queryKey: horariosKeys.eventosHoy.tienda(storeId),
				});
				return { ok: true };
			} catch (err) {
				return fallo(mensajeDe(err, 'Error al reportar el evento'));
			}
		},
		[storeId, queryClient, fallo, showSnackbar],
	);

	return useMemo(
		() => ({ registrar, editarHora, observar, reportarEvento }),
		[registrar, editarHora, observar, reportarEvento],
	);
}

export type AccionesRegistro = ReturnType<typeof useAccionesRegistro>;
