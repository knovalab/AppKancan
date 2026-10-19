import { Box, Button, Container, Typography } from '@mui/material';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs, { Dayjs } from 'dayjs';
import { useEffect, useMemo, useState } from 'react';
import 'dayjs/locale/es';
import { useHolidays } from '../../reservas/hooks/useHolidays';
import { LOG_TYPE } from '../domain/registro';

dayjs.locale('es');

import { obtenerTiendasIdsUsuarioActual } from '@/services/directus/userStores';
import { useAvisos } from '../hooks/useAvisos';
import {
	createTimeRecord,
	updateTimeRecord,
	upsertRecordReason,
} from '../api/directus/create';
import {
	getEmpleadosBulk,
	getNovedades,
	getRecordReasonId,
	getStores,
	getTimeRecordsBulkRange,
} from '../api/directus/read';
import CreateHourModal from '../components/detalle-tienda/CreateHourModal';
import EditHourModal from '../components/EditHourModal';
import { horariosKeys } from '../hooks/registro/keys';
import { useMotivosEdicion } from '../hooks/registro/useCatalogosHorarios';
import { useHorariosPolicies } from '../hooks/useHorariosPolicies';
import { DetallePlanillaTabla } from './planilla/DetallePlanillaTabla';
import {
	calcularMinutosDia,
	formatearHoras,
} from './planilla/DetallePlanillaUtils';
import type { Tienda } from '../interfaces/tiendas';

interface FilaEmpleadoPlanilla {
	id: string;
	nombre: string;
	cargo: string;
	tienda: string;
	tiendaId: number;
	inicioJornada: string | null;
	inicioAlmuerzo: string | null;
	finAlmuerzo: string | null;
	finJornada: string | null;
	recordIdInicioJornada: number | null;
	recordIdInicioAlmuerzo: number | null;
	recordIdFinAlmuerzo: number | null;
	recordIdFinJornada: number | null;
	tieneNovedad: boolean;
	novedadTipo?: string;
	horasDia: string;
}

interface DetallePlanillaPageProps {
	storeId?: number | null;
}

export default function DetallePlanillaPage({
	storeId: propStoreId,
}: DetallePlanillaPageProps) {
	const { esAdmin, esAreaManager } = useHorariosPolicies();
	const isAreaMgr = esAreaManager() && !esAdmin();
	const queryClient = useQueryClient();
	const { showSnackbar } = useAvisos();

	const [searchTerm, setSearchTerm] = useState('');
	const [fechaSeleccionada, setFechaSeleccionada] = useState<Dayjs>(dayjs());
	const [page, setPage] = useState(0);
	const rowsPerPage = 10;
	const [calendarYear, setCalendarYear] = useState(() => dayjs().year());
	const { data: festivosMap = {} } = useHolidays(calendarYear);

	const [editHourModalOpen, setEditHourModalOpen] = useState(false);
	const [editData, setEditData] = useState<any>(null);
	const [createHourOpen, setCreateHourOpen] = useState(false);
	const [createData, setCreateData] = useState<{
		employeeId: string;
		employeeName: string;
		eventName: string;
		tiendaId: number;
	} | null>(null);

	const { data: todasLasTiendas = [] } = useQuery<Tienda[]>({
		queryKey: ['adminTiendas'],
		queryFn: getStores,
		enabled: esAdmin() || isAreaMgr,
		staleTime: 30 * 60 * 1000,
	});

	const { data: tiendasAcceso = [] } = useQuery<number[]>({
		queryKey: ['tiendasAccesoUsuario'],
		queryFn: obtenerTiendasIdsUsuarioActual,
		enabled: isAreaMgr,
		staleTime: 30 * 60 * 1000,
	});

	const tiendasFiltradas = useMemo(() => {
		if (isAreaMgr) {
			const idsPermitidos = tiendasAcceso
				.map((id) =>
					Number(
						id && typeof id === 'object'
							? ((id as any).id ?? (id as any).store_id)
							: id,
					),
				)
				.filter(Boolean);
			return todasLasTiendas.filter(
				(t) => idsPermitidos.includes(Number(t.id)) && Number(t.id) !== 5,
			);
		}
		return todasLasTiendas;
	}, [todasLasTiendas, tiendasAcceso, isAreaMgr]);

	const tiendasAConsultar = useMemo(() => {
		if (propStoreId)
			return tiendasFiltradas.filter((t) => t.id === propStoreId);
		return tiendasFiltradas;
	}, [tiendasFiltradas, propStoreId]);

	const [fechaDebounced, setFechaDebounced] =
		useState<Dayjs>(fechaSeleccionada);

	useEffect(() => {
		const timer = setTimeout(() => {
			setFechaDebounced(fechaSeleccionada);
		}, 400);
		return () => clearTimeout(timer);
	}, [fechaSeleccionada]);

	const fechaStr = fechaDebounced.format('YYYY-MM-DD');

	const handleFechaChange = (newDate: Dayjs | null) => {
		if (newDate) {
			setFechaSeleccionada(newDate);
			setPage(0);
		}
	};

	const CustomActionBar = (props: any) => {
		const { setOpen } = props;

		const handleAyer = () => {
			handleFechaChange(dayjs().subtract(1, 'day'));
			setOpen(false);
		};

		const handleAnteayer = () => {
			handleFechaChange(fechaSeleccionada.subtract(1, 'day'));
		};

		const handleHoy = () => {
			handleFechaChange(dayjs());
			setOpen(false);
		};

		return (
			<Box
				sx={{
					p: 2,
					bgcolor: '#fafbfc',
					borderRight: '1px solid #e0e0e0',
					display: 'flex',
					flexDirection: 'column',
					justifyContent: 'center',
					alignItems: 'center',
					gap: 2,
					minWidth: 140,
				}}
			>
				<Typography
					variant="caption"
					fontWeight={700}
					color="#004680"
					sx={{
						fontSize: '0.75rem',
						letterSpacing: '0.5px',
						textAlign: 'center',
					}}
				>
					RANGOS RÁPIDOS
				</Typography>
				<Box
					sx={{
						display: 'flex',
						flexDirection: 'column',
						gap: 1.5,
						width: '100%',
					}}
				>
					<Button
						size="small"
						variant="contained"
						fullWidth
						sx={{
							bgcolor: '#004680',
							'&:hover': { bgcolor: '#003366' },
							fontWeight: 600,
							py: 1,
						}}
						onClick={handleHoy}
					>
						Hoy
					</Button>
					<Button
						size="small"
						variant="contained"
						fullWidth
						sx={{
							bgcolor: '#004680',
							'&:hover': { bgcolor: '#003366' },
							fontWeight: 600,
							py: 1,
						}}
						onClick={handleAyer}
					>
						Ayer
					</Button>
					<Button
						size="small"
						variant="contained"
						fullWidth
						sx={{
							bgcolor: '#004680',
							'&:hover': { bgcolor: '#003366' },
							fontWeight: 600,
							py: 1,
						}}
						onClick={handleAnteayer}
					>
						Día Anterior
					</Button>
				</Box>
			</Box>
		);
	};

	const { data: empleadosPorTienda = {}, isLoading: loadingEmpleados } =
		useQuery({
			queryKey: [
				'empleadosBulkMulti',
				tiendasAConsultar.map((t) => t.id).join(','),
			],
			queryFn: async () => {
				const result: Record<number, any[]> = {};
				for (const tienda of tiendasAConsultar) {
					const emps = await getEmpleadosBulk([tienda.id]);
					result[tienda.id] = emps;
				}
				return result;
			},
			enabled: tiendasAConsultar.length > 0,
			staleTime: 5 * 60 * 1000,
		});

	const { data: recordsPorTienda = {}, isLoading: loadingRecords } = useQuery({
		queryKey: [
			'recordsDiaMulti',
			tiendasAConsultar.map((t) => t.id).join(','),
			fechaStr,
		],
		queryFn: async () => {
			const result: Record<number, any[]> = {};
			for (const tienda of tiendasAConsultar) {
				const recs = await getTimeRecordsBulkRange(
					[tienda.id],
					fechaStr,
					fechaStr,
				);
				result[tienda.id] = recs;
			}
			return result;
		},
		enabled: tiendasAConsultar.length > 0,
		staleTime: 5 * 60 * 1000,
	});

	const { data: novedadesPorTienda = {} } = useQuery({
		queryKey: ['novedadesMulti', tiendasAConsultar.map((t) => t.id).join(',')],
		queryFn: async () => {
			const result: Record<number, any[]> = {};
			for (const tienda of tiendasAConsultar) {
				const novs = await getNovedades(tienda.id);
				result[tienda.id] = novs;
			}
			return result;
		},
		enabled: tiendasAConsultar.length > 0,
		staleTime: 5 * 60 * 1000,
	});

	// Solo necesita los motivos: 1 query en lugar de las 7 de useHorarios.
	const reasons = useMotivosEdicion();

	const filasEmpleadosBase: FilaEmpleadoPlanilla[] = useMemo(() => {
		const rows: FilaEmpleadoPlanilla[] = [];

		tiendasAConsultar.forEach((tienda) => {
			const empleados = empleadosPorTienda[tienda.id] || [];
			const recordsDia = recordsPorTienda[tienda.id] || [];
			const novedadesDia = (novedadesPorTienda[tienda.id] || []).filter(
				(n: any) => n.report_date === fechaStr,
			);

			const empMap = new Map<
				string,
				{ id: string; nombre: string; cargo: string }
			>();

			empleados.forEach((e: any) => {
				empMap.set(String(e.id), {
					id: String(e.id),
					nombre: e.nombre,
					cargo: e.cargo || 'Sin cargo',
				});
			});

			recordsDia.forEach((r: any) => {
				const empId = r.employee_id?.id;
				if (empId && !empMap.has(String(empId))) {
					const parts = [
						r.employee_id.first_name,
						r.employee_id.middle_name,
						r.employee_id.last_name,
						r.employee_id.second_last_name,
					].filter((p) => p && p.trim());
					const fullName = parts.join(' ').trim() || 'Empleado Sin Nombre';
					empMap.set(String(empId), {
						id: String(empId),
						nombre: fullName,
						cargo: 'Sin cargo',
					});
				}
			});

			const getHora = (empId: string | number, logType: string) => {
				const record = recordsDia.find(
					(r) =>
						Number(r.employee_id?.id || r.employee_id) === Number(empId) &&
						r.log_type === logType,
				);
				return record ? (record.record_time || '').substring(0, 5) : null;
			};

			const getRecordId = (empId: string | number, logType: string) => {
				const record = recordsDia.find(
					(r) =>
						Number(r.employee_id?.id || r.employee_id) === Number(empId) &&
						r.log_type === logType,
				);
				return record ? record.id : null;
			};

			const getNovedadEmpleado = (empId: string | number) => {
				const novedad = novedadesDia.find(
					(n) => Number(n.employee_id?.id || n.employee_id) === Number(empId),
				);
				return novedad
					? { tiene: true, tipo: novedad.newness_id?.name || 'Novedad' }
					: null;
			};

			empMap.forEach((emp) => {
				const empId = emp.id;
				const inicioJornada = getHora(empId, LOG_TYPE.inicioJornada);
				const inicioAlmuerzo = getHora(empId, LOG_TYPE.inicioAlmuerzo);
				const finAlmuerzo = getHora(empId, LOG_TYPE.finAlmuerzo);
				const finJornada = getHora(empId, LOG_TYPE.finJornada);

				const recordIdInicioJornada = getRecordId(
					empId,
					LOG_TYPE.inicioJornada,
				);
				const recordIdInicioAlmuerzo = getRecordId(
					empId,
					LOG_TYPE.inicioAlmuerzo,
				);
				const recordIdFinAlmuerzo = getRecordId(empId, LOG_TYPE.finAlmuerzo);
				const recordIdFinJornada = getRecordId(empId, LOG_TYPE.finJornada);

				const novedad = getNovedadEmpleado(empId);
				const minutosDia = calcularMinutosDia(recordsDia, empId);
				const horasDia = formatearHoras(minutosDia);

				rows.push({
					id: `${tienda.id}_${empId}`,
					nombre: emp.nombre,
					cargo: emp.cargo,
					tienda: tienda.name,
					tiendaId: tienda.id,
					inicioJornada,
					inicioAlmuerzo,
					finAlmuerzo,
					finJornada,
					recordIdInicioJornada,
					recordIdInicioAlmuerzo,
					recordIdFinAlmuerzo,
					recordIdFinJornada,
					tieneNovedad: !!novedad,
					novedadTipo: novedad?.tipo,
					horasDia,
				});
			});
		});

		rows.sort((a, b) => {
			if (a.tienda !== b.tienda) return a.tienda.localeCompare(b.tienda);
			return a.nombre.localeCompare(b.nombre);
		});

		return rows;
	}, [
		tiendasAConsultar,
		empleadosPorTienda,
		recordsPorTienda,
		novedadesPorTienda,
		fechaStr,
	]);

	const filasEmpleados = useMemo(() => {
		if (!searchTerm.trim()) return filasEmpleadosBase;
		return filasEmpleadosBase.filter((fila) =>
			fila.nombre.toLowerCase().includes(searchTerm.toLowerCase()),
		);
	}, [filasEmpleadosBase, searchTerm]);

	const totalFilas = filasEmpleados.length;
	const filasPagina = useMemo(() => {
		const start = page * rowsPerPage;
		return filasEmpleados.slice(start, start + rowsPerPage);
	}, [filasEmpleados, page]);

	const handleOpenEditHour = async (
		fila: FilaEmpleadoPlanilla,
		evento: string,
		recordId: number,
		horaActual: string | null,
	) => {
		if (!esAdmin() && !isAreaMgr) return;

		const numericRecordId = Number(recordId);
		if (isNaN(numericRecordId) || numericRecordId <= 0) {
			console.error('RecordId inválido:', recordId);
			return;
		}

		const tiendaId = fila.tiendaId;
		const recordsStore = recordsPorTienda[tiendaId] || [];
		const observacionActual =
			recordsStore.find((r) => r.id === numericRecordId)?.observations || '';

		let reasonId: number | null = null;
		try {
			reasonId = await getRecordReasonId(numericRecordId);
		} catch (e) {
			console.error('Error al obtener motivo:', e);
		}

		const registros = {
			inicioJornada: fila.inicioJornada,
			inicioAlmuerzo: fila.inicioAlmuerzo,
			finAlmuerzo: fila.finAlmuerzo,
			finJornada: fila.finJornada,
			observaciones: {},
			ids: {
				inicioJornada: fila.recordIdInicioJornada,
				inicioAlmuerzo: fila.recordIdInicioAlmuerzo,
				finAlmuerzo: fila.recordIdFinAlmuerzo,
				finJornada: fila.recordIdFinJornada,
			},
			horasOriginales: {},
			horasEditadas: {},
		};

		setEditData({
			employeeName: fila.nombre,
			eventName: evento,
			initialTimeStr: horaActual,
			initialObservation: observacionActual,
			reasons: reasons || [],
			initialReasonId: reasonId,
			recordId: numericRecordId,
			registros: registros,
		});
		setEditHourModalOpen(true);
	};

	const handleCloseEditHour = () => {
		setEditHourModalOpen(false);
		setEditData(null);
	};

	const handleConfirmEdit = async (
		horaFormateada: string,
		observacion: string,
		reasonId: number | null,
	) => {
		if (!editData || !editData.recordId) {
			console.error('No hay datos de edición o recordId ausente');
			return;
		}

		try {
			const parsed = dayjs(horaFormateada, 'hh:mm A');
			const recordTime = parsed.format('HH:mm:ss');

			await updateTimeRecord(editData.recordId, {
				record_time: recordTime,
				observations: observacion,
			});

			if (reasonId) {
				await upsertRecordReason(editData.recordId, reasonId);
			}

			queryClient.invalidateQueries({ queryKey: ['recordsDiaMulti'] });
			queryClient.invalidateQueries({
				queryKey: horariosKeys.timeRecords.todos,
			});

			showSnackbar('Hora actualizada correctamente', 'success');
			handleCloseEditHour();
		} catch (error) {
			console.error('Error al editar hora:', error);
			showSnackbar('Error al editar la hora', 'error');
			throw error;
		}
	};

	const handleOpenCreateHour = (
		empleadoId: string,
		empleadoNombre: string,
		evento: string,
		tiendaId: number,
	) => {
		if (!esAdmin() && !isAreaMgr) return;
		setCreateData({
			employeeId: empleadoId,
			employeeName: empleadoNombre,
			eventName: evento,
			tiendaId: tiendaId,
		});
		setCreateHourOpen(true);
	};

	const handleCloseCreateHour = () => {
		setCreateHourOpen(false);
		setCreateData(null);
	};

	const handleConfirmCreate = async (
		horaFormateada: string,
		observacion: string,
	) => {
		if (!createData) return;
		try {
			const parsed = dayjs(horaFormateada, 'hh:mm A');
			const recordTime = parsed.format('HH:mm:ss');
			const recordDate = fechaStr;

			await createTimeRecord({
				employee_id: Number(createData.employeeId),
				store_id: createData.tiendaId,
				log_type: createData.eventName,
				record_date: recordDate,
				record_time: recordTime,
				observations: observacion,
			});

			queryClient.invalidateQueries({ queryKey: ['recordsDiaMulti'] });
			queryClient.invalidateQueries({
				queryKey: horariosKeys.timeRecords.todos,
			});

			showSnackbar('Hora registrada correctamente', 'success');
			handleCloseCreateHour();
		} catch (error) {
			console.error('Error al crear hora:', error);
			showSnackbar('Error al crear la hora', 'error');
			throw error;
		}
	};

	const isLoading = loadingEmpleados || loadingRecords;

	if (tiendasAConsultar.length === 0) {
		return (
			<Container sx={{ mt: 4, textAlign: 'center' }}>
				<Typography variant="h6" color="text.secondary">
					No tienes tiendas asignadas para ver el detalle de planilla.
				</Typography>
			</Container>
		);
	}

	return (
		<>
			<DetallePlanillaTabla
				fechaSeleccionada={fechaSeleccionada}
				handleFechaChange={handleFechaChange}
				setCalendarYear={setCalendarYear}
				festivosMap={festivosMap}
				CustomActionBar={CustomActionBar}
				searchTerm={searchTerm}
				setSearchTerm={setSearchTerm}
				isLoading={isLoading}
				filasPagina={filasPagina}
				recordsPorTienda={recordsPorTienda}
				esAdmin={esAdmin()}
				isAreaMgr={isAreaMgr}
				handleOpenEditHour={handleOpenEditHour}
				handleOpenCreateHour={handleOpenCreateHour}
				filasFiltradasLength={totalFilas}
				rowsPerPage={rowsPerPage}
				page={page}
				setPage={setPage}
			/>

			{editData && (
				<EditHourModal
					open={editHourModalOpen}
					onClose={handleCloseEditHour}
					employeeName={editData.employeeName}
					eventName={editData.eventName}
					initialTimeStr={editData.initialTimeStr}
					initialObservation={editData.initialObservation}
					reasons={editData.reasons}
					initialReasonId={editData.initialReasonId}
					registros={editData.registros || {}}
					onConfirm={handleConfirmEdit}
					motivoRequerido={!esAdmin()}
				/>
			)}

			{createData && (
				<CreateHourModal
					open={createHourOpen}
					onClose={handleCloseCreateHour}
					employeeName={createData.employeeName}
					eventName={createData.eventName}
					onConfirm={handleConfirmCreate}
				/>
			)}
		</>
	);
}
