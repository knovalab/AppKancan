import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { useState } from 'react';
import { useGlobalSnackbar } from '@/shared/components/SnackbarsPosition/SnackbarContext';
import {
	createEventReport,
	createNovedades,
	createTimeRecord,
	updateTimeRecord,
	upsertRecordReason,
} from '../api/directus/create';
import {
	getEmpleados,
	getNovedades,
	getReasons,
	getStoreEventReportsToday,
	getStoreIdUsuarioActual,
	getTimeRecords,
	getTiposNovedad,
	idRelacion,
	type TimeRecord,
} from '../api/directus/read';
import {
	crearRegistrosVacios,
	ESTADO,
	type EstadoAsistencia,
	EVENTO,
	type EventoTipo,
	keyPorLogType,
	type LogType,
	MARCACIONES,
} from '../domain/registro';
import type {
	EmpleadoAsistencia,
	EventReportHoy,
	Motivo,
	NovedadMapeada,
	TipoNovedad,
} from '../interfaces/horarios.interface';
import { getRealColombiaTime } from '../utils/timeSync';

export const useHorarios = (storeOverride?: number | null) => {
	const queryClient = useQueryClient();
	const [error, setError] = useState<string | null>(null);
	const { showSnackbar } = useGlobalSnackbar();
	const hoy = getRealColombiaTime().format('YYYY-MM-DD');

	const { data: storeUsuario = null } = useQuery<number | null>({
		queryKey: ['horariosStoreId'],
		queryFn: getStoreIdUsuarioActual,
		staleTime: 30 * 60 * 1000,
	});
	const STORE_ID = storeOverride != null ? storeOverride : storeUsuario;
	const tieneTienda = STORE_ID != null;

	const {
		data: empleadosDB = [],
		isLoading: loadingEmpleados,
		error: errorE,
	} = useQuery<EmpleadoAsistencia[]>({
		queryKey: ['empleados', STORE_ID],
		queryFn: () => getEmpleados(STORE_ID as number),
		enabled: tieneTienda,
		staleTime: 5 * 60 * 1000,
		refetchOnWindowFocus: false,
	});

	const { data: tiposNovedad = [], error: errorT } = useQuery<TipoNovedad[]>({
		queryKey: ['tiposNovedad'],
		queryFn: getTiposNovedad,
		staleTime: 10 * 60 * 1000,
	});

	const { data: reasons = [] } = useQuery<Motivo[]>({
		queryKey: ['reasons'],
		queryFn: getReasons,
		staleTime: 10 * 60 * 1000,
	});

	const { data: novedadesDB = [], error: errorN } = useQuery<any[]>({
		queryKey: ['novedades', STORE_ID],
		queryFn: () => getNovedades(STORE_ID as number),
		enabled: tieneTienda,
	});

	const {
		data: timeRecords = [],
		isLoading: loadingTimeRecords,
		error: errorTime,
	} = useQuery<TimeRecord[]>({
		queryKey: ['timeRecords', STORE_ID, hoy],
		queryFn: () => getTimeRecords(STORE_ID as number, hoy),
		enabled: tieneTienda,
	});

	const { data: eventReportsToday = [] } = useQuery<EventReportHoy[]>({
		queryKey: ['eventReportsToday', STORE_ID, hoy],
		queryFn: () => getStoreEventReportsToday(STORE_ID as number, hoy),
		enabled: tieneTienda,
	});

	const idsConNovedadHoy = (novedadesDB || [])
		.map((nov: any) => {
			const empId = nov.employee_id?.id || nov.employee_id;
			const fechaReporte = nov.report_date
				? dayjs(nov.report_date).format('YYYY-MM-DD')
				: nov.date_created
					? dayjs(nov.date_created).format('YYYY-MM-DD')
					: '';
			return fechaReporte === hoy ? String(empId) : null;
		})
		.filter(Boolean);

	const empleadosMapeados: EmpleadoAsistencia[] = empleadosDB.map((emp) => {
		const records = timeRecords.filter(
			(r) => idRelacion(r.employee_id) === Number(emp.id),
		);

		const registros = crearRegistrosVacios();
		for (const r of records) {
			const key = keyPorLogType(r.log_type);
			if (!key) continue;
			registros[key] = r.record_time ? r.record_time.substring(0, 5) : '';
			registros.observaciones[key] = r.observations || '';
			registros.ids[key] = r.id;
			registros.horasOriginales[key] = r.original_record_time
				? r.original_record_time.substring(0, 5)
				: null;
			registros.horasEditadas[key] = r.original_record_time
				? r.record_time.substring(0, 5)
				: null;
		}

		// El estado es el que deja la última marcación registrada (en orden de jornada).
		const ultima = [...MARCACIONES].reverse().find((m) => registros[m.key]);
		const estadoActual: EstadoAsistencia =
			ultima?.estadoResultante ?? ESTADO.entradaPendiente;

		const pausasActivasCount = eventReportsToday.filter(
			(r) =>
				idRelacion(r.employee_id) === Number(emp.id) &&
				r.event_type === EVENTO.terminarPausaActiva,
		).length;

		return {
			...emp,
			estadoActual,
			registros,
			pausasActivasCount,
		};
	});

	const empleados = empleadosMapeados.filter(
		(emp) => !idsConNovedadHoy.includes(String(emp.id)),
	);

	const noveltyMutation = useMutation({
		mutationFn: createNovedades,
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['novedades'] });
			queryClient.invalidateQueries({ queryKey: ['empleados'] });
			showSnackbar('Novedad registrada con éxito', 'success');
		},
		onError: (err: any) => {
			setError(err?.message || 'Error al guardar la novedad');
			showSnackbar(err?.message || 'Error al guardar la novedad', 'error');
		},
	});

	const createTimeRecordMutation = useMutation({
		mutationFn: createTimeRecord,
		onSuccess: (data: any) => {
			queryClient.invalidateQueries({ queryKey: ['timeRecords'] });
			showSnackbar(
				`Registro de "${data?.log_type || 'asistencia'}" guardado con éxito`,
				'success',
			);
		},
		onError: (err: any) => {
			setError(err?.message || 'Error al guardar el registro de asistencia');
			showSnackbar(
				err?.message || 'Error al guardar el registro de asistencia',
				'error',
			);
		},
	});

	const updateTimeRecordMutation = useMutation({
		mutationFn: ({
			id,
			observations,
			record_time,
			original_record_time,
		}: {
			id: number;
			observations?: string;
			record_time?: string;
			original_record_time?: string;
		}) =>
			updateTimeRecord(id, { observations, record_time, original_record_time }),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['timeRecords'] });
			showSnackbar('Registro actualizado correctamente', 'success');
		},
		onError: (err: any) => {
			setError(err?.message || 'Error al actualizar el registro');
			showSnackbar(err?.message || 'Error al actualizar el registro', 'error');
		},
	});

	const registrarEvento = async (
		idEmpleado: string,
		tipoEvento: LogType,
		horaOverride?: string,
		observacionOverride?: string,
		reasonId?: number | null,
		metadata?: {
			latitude?: number | null;
			longitude?: number | null;
			accuracy?: number | null;
			photo?: string | null;
		},
	) => {
		setError(null);
		try {
			const ahora = horaOverride
				? dayjs(horaOverride, 'hh:mm A')
				: getRealColombiaTime();
			const recordDate = ahora.format('YYYY-MM-DD');
			const recordTime = ahora.format('HH:mm:ss');
			const observacion = observacionOverride || '';

			const existingRecord = timeRecords.find(
				(r) =>
					idRelacion(r.employee_id) === Number(idEmpleado) &&
					r.log_type === tipoEvento &&
					r.record_date === recordDate,
			);

			let recordId: number | null = null;
			if (existingRecord) {
				const originalTime =
					existingRecord.original_record_time || existingRecord.record_time;
				await updateTimeRecordMutation.mutateAsync({
					id: existingRecord.id,
					record_time: recordTime,
					original_record_time: originalTime,
					observations: observacion,
				});
				recordId = existingRecord.id;
			} else {
				const creado = await createTimeRecordMutation.mutateAsync({
					employee_id: Number(idEmpleado),
					store_id: STORE_ID as number,
					log_type: tipoEvento,
					record_date: recordDate,
					record_time: recordTime,
					observations: observacion,
					latitude: metadata?.latitude,
					longitude: metadata?.longitude,
					accuracy: metadata?.accuracy,
					photo: metadata?.photo,
				});
				recordId = creado?.id != null ? Number(creado.id) : null;
			}

			if (reasonId != null && recordId != null) {
				await upsertRecordReason(recordId, reasonId);
			}
		} catch (err: any) {
			console.error('Error al registrar evento:', err);
		}
	};

	const guardarObservacion = async (
		idEmpleado: string,
		tipoEvento: LogType,
		texto: string,
	) => {
		setError(null);
		try {
			const emp = empleadosMapeados.find(
				(e) => String(e.id) === String(idEmpleado),
			);
			if (!emp) return;

			const key = keyPorLogType(tipoEvento);
			const recordId = key ? emp.registros.ids[key] : undefined;

			if (recordId) {
				await updateTimeRecordMutation.mutateAsync({
					id: recordId,
					observations: texto,
				});
			} else {
				setError(
					'No se encontró el registro de tiempo para actualizar la observación.',
				);
			}
		} catch (err: any) {
			console.error('Error al guardar observación:', err);
		}
	};

	const eliminarEmpleado = (_idEmpleado: string) => {};

	const resetHorarios = async () => {
		setError(null);
		await queryClient.invalidateQueries();
		await queryClient.refetchQueries({ type: 'active' });
	};

	const agregarNovedad = async (novedad: {
		empleadoId: string;
		empleadoNombre: string;
		tipo: string;
		fechaInicio: string;
		fechaFin: string;
		observaciones: string;
		fechaRegistro: string;
	}) => {
		setError(null);
		try {
			const tipoEncontrado = tiposNovedad.find(
				(t) => t.name === novedad.tipo || t.nombre === novedad.tipo,
			);
			if (!tipoEncontrado) {
				setError(`Tipo de novedad "${novedad.tipo}" no válido.`);
				return false;
			}

			const inicio = dayjs(novedad.fechaInicio);
			const fin = dayjs(novedad.fechaFin);

			if (!inicio.isValid() || !fin.isValid()) {
				setError('Las fechas seleccionadas no son válidas.');
				return false;
			}

			if (fin.isBefore(inicio, 'day')) {
				setError('La fecha fin debe ser igual o posterior a la de inicio.');
				return false;
			}

			const reportes: any[] = [];
			let current = inicio;
			while (current.isBefore(fin) || current.isSame(fin, 'day')) {
				reportes.push({
					employee_id: Number(novedad.empleadoId),
					newness_id: Number(tipoEncontrado.id),
					report_date: current.format('YYYY-MM-DD'),
					observations: novedad.observaciones || '',
					store_id: STORE_ID as number,
				});
				current = current.add(1, 'day');
			}

			await noveltyMutation.mutateAsync(reportes);
			return true;
		} catch (err: any) {
			setError(err?.message || 'Error al guardar');
			return false;
		}
	};

	const reportarEvento = async (
		idEmpleado: string,
		eventType: EventoTipo,
		observaciones?: string,
	) => {
		try {
			const ahora = getRealColombiaTime();
			await createEventReport({
				employee_id: Number(idEmpleado),
				event_type: eventType,
				observations: observaciones,
				store_id: STORE_ID as number,
				date: ahora.format('YYYY-MM-DD'),
				hour: ahora.format('HH:mm:ss'),
			});
			showSnackbar('Evento reportado con éxito', 'success');
			queryClient.invalidateQueries({ queryKey: ['eventReportsToday'] });
			return true;
		} catch (err: any) {
			showSnackbar(err?.message || 'Error al reportar el evento', 'error');
			return false;
		}
	};

	const novedadesMapped: NovedadMapeada[] = (novedadesDB || []).map(
		(nov: any) => {
			if (
				nov.empleadoNombre &&
				nov.empleadoNombre !== 'Empleado #' &&
				nov.empleadoNombre !== 'Empleado Sin Nombre'
			) {
				return {
					id: nov.id,
					fecha:
						nov.fecha ||
						nov.report_date ||
						(nov.date_created
							? dayjs(nov.date_created).format('YYYY-MM-DD')
							: new Date().toISOString()),
					empleadoNombre: nov.empleadoNombre,
					empleadoDocumento: nov.empleadoDocumento,
					tipo: nov.tipo || nov.newness_id?.name || 'Novedad',
					observaciones: nov.observaciones || nov.observations || '',
					empleadoActivo: nov.empleadoActivo ?? true,
					tiendaNombre: nov.tiendaNombre || nov.store_id?.name || 'Sin tienda',
				};
			}

			const empId = nov.employee_id?.id || nov.employee_id;
			const empLocal = empleadosDB.find((e) => String(e.id) === String(empId));

			let nombreEmpleado = `Empleado #${empId || ''}`;
			if (nov.employee_id?.first_name) {
				const parts = [
					nov.employee_id.first_name,
					nov.employee_id.middle_name,
					nov.employee_id.last_name,
					nov.employee_id.second_last_name,
				].filter((part) => part && part.trim() !== '');
				nombreEmpleado = parts.join(' ').trim() || `Empleado #${empId || ''}`;
			} else if (empLocal) {
				nombreEmpleado = empLocal.nombre;
			}

			let tipoNovedadName = 'Novedad';
			if (nov.newness_id?.name) {
				tipoNovedadName = nov.newness_id.name;
			} else if (nov.newness_id?.nombre) {
				tipoNovedadName = nov.newness_id.nombre;
			} else {
				const tipoLocal = tiposNovedad.find(
					(t) => String(t.id) === String(nov.newness_id),
				);
				if (tipoLocal) tipoNovedadName = tipoLocal.nombre || tipoLocal.name;
			}

			return {
				id: nov.id,
				fecha:
					nov.report_date ||
					(nov.date_created
						? dayjs(nov.date_created).format('YYYY-MM-DD')
						: new Date().toISOString()),
				empleadoNombre: nombreEmpleado,
				empleadoDocumento: nov.employee_id?.document_number
					? String(nov.employee_id.document_number)
					: empLocal?.documento
						? String(empLocal.documento)
						: undefined,
				tipo: tipoNovedadName,
				observaciones: nov.observations || '',
				empleadoActivo: !!empLocal,
				tiendaNombre: nov.store_id?.name || 'Sin tienda',
			};
		},
	);

	return {
		empleados,
		novedades: novedadesMapped,
		tiposNovedad,
		reasons,
		loading: loadingEmpleados || loadingTimeRecords,
		error:
			error ||
			(errorE || errorT || errorN || errorTime ? 'Sincronizando...' : null),
		registrarEvento,
		resetHorarios,
		eliminarEmpleado,
		guardarObservacion,
		agregarNovedad,
		reportarEvento,
	};
};
