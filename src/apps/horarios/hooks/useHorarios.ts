import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { useCallback, useMemo, useState } from 'react';
import { useAvisos } from './useAvisos';
import { createNovedades } from '../api/directus/create';
import {
	getEmpleados,
	getNovedades,
	getStoreEventReportsToday,
	getTimeRecords,
	idRelacion,
} from '../api/directus/read';
import {
	agruparPorEmpleado,
	calcularEstado,
	EVENTO,
	type EventoTipo,
	keyPorLogType,
	type LogType,
	mapearRegistros,
} from '../domain/registro';
import type { EmpleadoAsistencia } from '../domain/registro/modelo';
import type { EmployeeDto } from '../interfaces/api/employees';
import type { EventReportHoyDto } from '../interfaces/api/eventReports';
import type { CreateNewnessReportDto } from '../interfaces/api/newness';
import type { TimeRecordDto } from '../interfaces/api/timeRecords';
import type { NovedadMapeada, NovedadTienda } from '../interfaces/novedades';
import type { VerificationData } from '../interfaces/verificacion';
import { mensajeDeError } from '../utils/errores';
import { getRealColombiaTime } from '../utils/timeSync';
import { horariosKeys } from './registro/keys';
import { useAccionesRegistro } from './registro/useAccionesRegistro';
import { useCatalogosHorarios } from './registro/useCatalogosHorarios';
import { useTiendaActual } from './registro/useTiendaActual';

/**
 * Novedad tal como la consume el mapeo: la de `getNovedades` (relaciones expandidas)
 * o una fila sin expandir, donde las relaciones llegan como id (caso que cubren los tests).
 */
type NovedadEntrada = Omit<
	Partial<NovedadTienda>,
	'id' | 'employee_id' | 'newness_id' | 'store_id'
> & {
	id: number | string;
	employee_id?: Partial<EmployeeDto> | number | string | null;
	newness_id?: { name?: string | null; nombre?: string } | number | null;
	store_id?: { name?: string | null } | number | null;
};

/** La relación expandida (objeto) o null si llegó como id o vacía. */
const relacion = <T extends object>(
	valor: T | number | string | null | undefined,
): T | null => (valor != null && typeof valor === 'object' ? valor : null);

export const useHorarios = (storeOverride?: number | null) => {
	const queryClient = useQueryClient();
	const [error, setError] = useState<string | null>(null);
	const { showSnackbar } = useAvisos();
	const hoy = getRealColombiaTime().format('YYYY-MM-DD');

	const STORE_ID = useTiendaActual(storeOverride);
	const tieneTienda = STORE_ID != null;
	const { reasons, tiposNovedad, errorTipos: errorT } = useCatalogosHorarios();
	const acciones = useAccionesRegistro(STORE_ID);

	const {
		data: empleadosDB = [],
		isLoading: loadingEmpleados,
		error: errorE,
	} = useQuery<EmpleadoAsistencia[]>({
		queryKey: horariosKeys.empleados.tienda(STORE_ID),
		queryFn: () => getEmpleados(STORE_ID as number),
		enabled: tieneTienda,
		staleTime: 5 * 60 * 1000,
		refetchOnWindowFocus: false,
	});

	const { data: novedadesDB = [], error: errorN } = useQuery<NovedadEntrada[]>({
		queryKey: horariosKeys.novedades.tienda(STORE_ID),
		queryFn: () => getNovedades(STORE_ID as number),
		enabled: tieneTienda,
	});

	const {
		data: timeRecords = [],
		isLoading: loadingTimeRecords,
		error: errorTime,
	} = useQuery<TimeRecordDto[]>({
		queryKey: horariosKeys.timeRecords.dia(STORE_ID, hoy),
		queryFn: () => getTimeRecords(STORE_ID as number, hoy),
		enabled: tieneTienda,
	});

	const { data: eventReportsToday = [] } = useQuery<EventReportHoyDto[]>({
		queryKey: horariosKeys.eventosHoy.dia(STORE_ID, hoy),
		queryFn: () => getStoreEventReportsToday(STORE_ID as number, hoy),
		enabled: tieneTienda,
	});

	const idsConNovedadHoy = useMemo(() => {
		const ids = new Set<string>();
		for (const nov of novedadesDB) {
			const empId = relacion(nov.employee_id)?.id || nov.employee_id;
			const fechaReporte = nov.report_date
				? dayjs(nov.report_date).format('YYYY-MM-DD')
				: nov.date_created
					? dayjs(nov.date_created).format('YYYY-MM-DD')
					: '';
			if (fechaReporte === hoy) ids.add(String(empId));
		}
		return ids;
	}, [novedadesDB, hoy]);

	// Una pasada por colección (antes: un filter por empleado en cada render).
	const empleadosMapeados = useMemo<EmpleadoAsistencia[]>(() => {
		const marcacionesPorEmpleado = agruparPorEmpleado(timeRecords, (r) =>
			idRelacion(r.employee_id),
		);
		const pausasPorEmpleado = agruparPorEmpleado(
			eventReportsToday.filter(
				(r) => r.event_type === EVENTO.terminarPausaActiva,
			),
			(r) => idRelacion(r.employee_id),
		);
		return empleadosDB.map((emp) => {
			const registros = mapearRegistros(
				marcacionesPorEmpleado.get(Number(emp.id)) ?? [],
			);
			return {
				...emp,
				estadoActual: calcularEstado(registros),
				registros,
				pausasActivasCount: pausasPorEmpleado.get(Number(emp.id))?.length ?? 0,
			};
		});
	}, [empleadosDB, timeRecords, eventReportsToday]);

	const empleados = useMemo(
		() =>
			empleadosMapeados.filter((emp) => !idsConNovedadHoy.has(String(emp.id))),
		[empleadosMapeados, idsConNovedadHoy],
	);

	const noveltyMutation = useMutation({
		mutationFn: createNovedades,
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: horariosKeys.novedades.todos });
			queryClient.invalidateQueries({ queryKey: horariosKeys.empleados.todos });
			showSnackbar('Novedad registrada con éxito', 'success');
		},
		onError: (err: unknown) => {
			const mensaje = mensajeDeError(err, 'Error al guardar la novedad');
			setError(mensaje);
			showSnackbar(mensaje, 'error');
		},
	});

	const registroIdDe = useCallback(
		(idEmpleado: string, tipoEvento: LogType): number | undefined => {
			const key = keyPorLogType(tipoEvento);
			const emp = empleadosMapeados.find(
				(e) => String(e.id) === String(idEmpleado),
			);
			return key ? emp?.registros.ids[key] : undefined;
		},
		[empleadosMapeados],
	);

	const registrarEvento = async (
		idEmpleado: string,
		tipoEvento: LogType,
		horaOverride?: string,
		observacionOverride?: string,
		reasonId?: number | null,
		metadata?: VerificationData,
	): Promise<void> => {
		let resultado: Awaited<ReturnType<typeof acciones.registrar>>;
		if (horaOverride) {
			const recordId = registroIdDe(idEmpleado, tipoEvento);
			if (recordId == null) {
				showSnackbar(
					'No se encontró el registro para editar la hora.',
					'error',
				);
				throw new Error('No se encontró el registro para editar la hora.');
			}
			resultado = await acciones.editarHora({
				recordId,
				hora: horaOverride,
				motivoId: reasonId,
				observacion: observacionOverride,
			});
		} else {
			resultado = await acciones.registrar({
				empleadoId: Number(idEmpleado),
				marcacion: tipoEvento,
				verificacion: metadata,
				observacion: observacionOverride,
			});
		}
		if (!resultado.ok) throw new Error(resultado.error);
	};

	const guardarObservacion = async (
		idEmpleado: string,
		tipoEvento: LogType,
		texto: string,
	): Promise<boolean> => {
		const recordId = registroIdDe(idEmpleado, tipoEvento);
		if (recordId == null) {
			showSnackbar(
				'No se encontró el registro de tiempo para actualizar la observación.',
				'error',
			);
			return false;
		}
		const resultado = await acciones.observar({ recordId, texto });
		return resultado.ok;
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
		if (STORE_ID == null) {
			setError(
				'No hay una tienda seleccionada: no se puede guardar la novedad.',
			);
			return false;
		}
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

			const reportes: CreateNewnessReportDto[] = [];
			let current = inicio;
			while (current.isBefore(fin) || current.isSame(fin, 'day')) {
				reportes.push({
					employee_id: Number(novedad.empleadoId),
					newness_id: Number(tipoEncontrado.id),
					report_date: current.format('YYYY-MM-DD'),
					observations: novedad.observaciones || '',
					store_id: STORE_ID,
				});
				current = current.add(1, 'day');
			}

			await noveltyMutation.mutateAsync(reportes);
			return true;
		} catch (err) {
			setError(mensajeDeError(err, 'Error al guardar'));
			return false;
		}
	};

	const reportarEvento = async (
		idEmpleado: string,
		eventType: EventoTipo,
		observaciones?: string,
	): Promise<boolean> => {
		const resultado = await acciones.reportarEvento({
			empleadoId: Number(idEmpleado),
			tipo: eventType,
			observacion: observaciones,
		});
		return resultado.ok;
	};

	const novedadesMapped: NovedadMapeada[] = (novedadesDB || []).map((nov) => {
		const empleadoRel = relacion(nov.employee_id);
		const tipoRel = relacion(nov.newness_id);
		const tiendaRel = relacion(nov.store_id);
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
				tipo: nov.tipo || tipoRel?.name || 'Novedad',
				observaciones: nov.observaciones || nov.observations || '',
				empleadoActivo: nov.empleadoActivo ?? true,
				tiendaNombre: nov.tiendaNombre || tiendaRel?.name || 'Sin tienda',
			};
		}

		const empId = empleadoRel?.id || nov.employee_id;
		const empLocal = empleadosDB.find((e) => String(e.id) === String(empId));

		let nombreEmpleado = `Empleado #${empId || ''}`;
		if (empleadoRel?.first_name) {
			const parts = [
				empleadoRel.first_name,
				empleadoRel.middle_name,
				empleadoRel.last_name,
				empleadoRel.second_last_name,
			].filter((part) => part && part.trim() !== '');
			nombreEmpleado = parts.join(' ').trim() || `Empleado #${empId || ''}`;
		} else if (empLocal) {
			nombreEmpleado = empLocal.nombre;
		}

		let tipoNovedadName = 'Novedad';
		if (tipoRel?.name) {
			tipoNovedadName = tipoRel.name;
		} else if (tipoRel?.nombre) {
			tipoNovedadName = tipoRel.nombre;
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
			empleadoDocumento: empleadoRel?.document_number
				? String(empleadoRel.document_number)
				: empLocal?.documento
					? String(empLocal.documento)
					: undefined,
			tipo: tipoNovedadName,
			observaciones: nov.observations || '',
			empleadoActivo: !!empLocal,
			tiendaNombre: tiendaRel?.name || 'Sin tienda',
		};
	});

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
		guardarObservacion,
		agregarNovedad,
		reportarEvento,
	};
};
