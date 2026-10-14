import AssignmentIcon from '@mui/icons-material/Assignment';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import { Alert, Box, Button, Chip, Tooltip, Typography } from '@mui/material';
import dayjs from 'dayjs';
import { useEffect, useMemo, useState } from 'react';
import LoadingSpinner from '@/shared/components/LoadingSpinner';
import { useTutorial } from '@/shared/hooks/TutorialContext';
import { botonHeaderSx } from '../components/botonHeaderSx';
import EmployeeCard from '../components/EmployeeCard';
import { HeaderActions } from '../components/HeaderActions';
import ExportEventosDialog from '../components/reportes/ExportEventosDialog';
import { useHorariosTour } from '../components/tour/HorariosTourContext';
import {
	crearRegistrosVacios,
	ESTADO,
	EVENTO,
	type EventoTipo,
	ID_EMPLEADO_DEMO,
	keyPorLogType,
	type LogType,
	MAX_PAUSAS_ACTIVAS,
	marcacionPorLogType,
} from '../domain/registro';
import { useAceptacionNormasEmpleados } from '../hooks/useAceptacionNormasEmpleados';
import { useHorarios } from '../hooks/useHorarios';
import { useHorariosLayout } from '../hooks/useHorariosLayout';
import type { EmpleadoAsistencia } from '../interfaces/horarios.interface';

/**
 * Sección "Registros" (/horarios/registros): marcación de asistencia del día.
 * Header, pestañas, selector de tienda, normas y tour viven en layouts/HorariosLayout.
 */
export default function RegistrosPage() {
	const { tienda, acceso } = useHorariosLayout();
	const { startTour } = useHorariosTour();
	const { activeTutorial, endTutorial } = useTutorial();
	const [modoDemo, setModoDemo] = useState(false);
	const [exportEventosOpen, setExportEventosOpen] = useState(false);

	const {
		empleados,
		tiposNovedad,
		reasons,
		loading,
		error,
		registrarEvento,
		eliminarEmpleado,
		guardarObservacion,
		agregarNovedad,
		reportarEvento,
	} = useHorarios(tienda.storeId);

	// Una sola consulta de aceptación de normas para toda la tienda (antes, una por tarjeta).
	const empleadoIds = useMemo(() => empleados.map((e) => e.id), [empleados]);
	const {
		normas,
		yaAcepto: yaAceptoNormas,
		marcarAceptado: marcarNormasAceptadas,
		verificarAceptacion: verificarAceptacionNormas,
	} = useAceptacionNormasEmpleados(empleadoIds);

	const [demoEmpleado, setDemoEmpleado] = useState<EmpleadoAsistencia>({
		id: ID_EMPLEADO_DEMO,
		documento: '0000000000',
		nombre: 'USUARIO DE EJEMPLO',
		cargo: '',
		estadoActual: ESTADO.entradaPendiente,
		pausasActivasCount: 0,
		registros: crearRegistrosVacios(),
	});

	// Demo en memoria: usa el mismo catálogo de marcaciones que el registro real.
	const registrarEventoDemo = (
		_idEmpleado: string,
		tipoEvento: LogType,
		horaOverride?: string,
		observacionOverride?: string,
	) => {
		const marcacion = marcacionPorLogType(tipoEvento);
		if (!marcacion) return;
		const ahora = horaOverride || dayjs().format('HH:mm');
		setDemoEmpleado((prev) => ({
			...prev,
			estadoActual: marcacion.estadoResultante,
			registros: {
				...prev.registros,
				[marcacion.key]: ahora,
				observaciones: observacionOverride
					? {
							...prev.registros.observaciones,
							[marcacion.key]: observacionOverride,
						}
					: { ...prev.registros.observaciones },
			},
		}));
	};

	const reportarEventoDemo = (
		_idEmpleado: string,
		eventType: EventoTipo,
		_observaciones?: string,
	) => {
		if (eventType === EVENTO.terminarPausaActiva) {
			setDemoEmpleado((prev) => ({
				...prev,
				pausasActivasCount: Math.min(
					(prev.pausasActivasCount ?? 0) + 1,
					MAX_PAUSAS_ACTIVAS,
				),
			}));
		}
		return true;
	};

	const guardarObservacionDemo = (
		_idEmpleado: string,
		evento: LogType,
		texto: string,
	) => {
		const key = keyPorLogType(evento);
		if (!key) return;
		setDemoEmpleado((prev) => ({
			...prev,
			registros: {
				...prev.registros,
				observaciones: { ...prev.registros.observaciones, [key]: texto },
			},
		}));
	};

	// Tutorial lanzado desde el PeekButton global (navega a /horarios/registros).
	useEffect(() => {
		if (activeTutorial === 'horarios' && !loading) {
			const t = setTimeout(() => {
				startTour();
				endTutorial();
			}, 350);
			return () => clearTimeout(t);
		}
	}, [activeTutorial, loading, startTour, endTutorial]);

	return (
		<>
			{/* Header: Normas · Demo · Tutorial · Actualizar */}
			<HeaderActions slot="header">
				{acceso.puedeVerDemo && (
					<Tooltip title="Activar/Desactivar Empleado de Prueba (Local)">
						<Button
							onClick={() => setModoDemo((v) => !v)}
							variant={modoDemo ? 'contained' : 'outlined'}
							disableElevation
							startIcon={<AssignmentIcon />}
							sx={{
								...botonHeaderSx,
								color: modoDemo ? '#fff' : '#0284c7',
								bgcolor: modoDemo ? '#0284c7' : 'transparent',
								borderColor: '#7dd3fc',
								'&:hover': {
									bgcolor: modoDemo ? '#0369a1' : '#f0f9ff',
									borderColor: '#38bdf8',
								},
							}}
						>
							Demo
						</Button>
					</Tooltip>
				)}
			</HeaderActions>

			{/* Final de la fila de pestañas */}
			<HeaderActions slot="tabs">
				<Button
					className="tour-export-eventos"
					onClick={() => setExportEventosOpen(true)}
					variant="contained"
					disableElevation
					startIcon={<FileDownloadIcon />}
					sx={{
						bgcolor: '#004680',
						textTransform: 'none',
						fontWeight: 700,
						borderRadius: 2,
						height: 32,
						'&:hover': { bgcolor: '#003a6b' },
					}}
				>
					Exportar
				</Button>
				<Chip
					label={`Total Empleados: ${empleados.length}`}
					sx={{
						bgcolor: '#eaf2fb',
						color: '#004680',
						fontWeight: 700,
						fontSize: '0.8rem',
						borderRadius: '8px',
						border: '1px solid #d6e6f7',
						height: 32,
						px: 0.5,
					}}
				/>
			</HeaderActions>

			{error && (
				<Alert severity="warning" sx={{ mb: 2, mx: { xs: 0.5, sm: 0 } }}>
					{error}
				</Alert>
			)}

			{loading ? (
				<LoadingSpinner message="Cargando datos del servidor..." />
			) : (
				<Box
					sx={{
						display: 'grid',
						gridTemplateColumns: {
							xs: '1fr',
							sm: 'repeat(2, 1fr)',
							md: 'repeat(3, 1fr)',
						},
						gap: { xs: 1.5, sm: 3 },
						width: '100%',
						mt: { xs: 0.5, sm: 0 },
					}}
				>
					{modoDemo && (
						<EmployeeCard
							key={`demo-${ID_EMPLEADO_DEMO}`}
							empleado={demoEmpleado}
							tiposNovedad={tiposNovedad}
							reasons={reasons}
							onRegistrarEvento={registrarEventoDemo}
							onEliminarEmpleado={() => {}}
							onGuardarObservacion={guardarObservacionDemo}
							onAgregarNovedad={async () => true}
							onReportarEvento={reportarEventoDemo}
							normas={normas}
							yaAceptoNormas
							onNormasAceptadas={marcarNormasAceptadas}
							verificarAceptacionNormas={verificarAceptacionNormas}
						/>
					)}
					{empleados.map((empleado) => (
						<EmployeeCard
							key={empleado.id}
							empleado={empleado}
							tiposNovedad={tiposNovedad}
							reasons={reasons}
							onRegistrarEvento={registrarEvento}
							onEliminarEmpleado={eliminarEmpleado}
							onGuardarObservacion={guardarObservacion}
							onAgregarNovedad={agregarNovedad}
							onReportarEvento={reportarEvento}
							normas={normas}
							yaAceptoNormas={yaAceptoNormas(empleado.id)}
							onNormasAceptadas={marcarNormasAceptadas}
							verificarAceptacionNormas={verificarAceptacionNormas}
						/>
					))}
					{empleados.length === 0 && !modoDemo && (
						<Typography variant="body1" sx={{ color: '#64748b', mt: 4 }}>
							No hay empleados pendientes por gestionar.
						</Typography>
					)}
				</Box>
			)}

			<ExportEventosDialog
				open={exportEventosOpen}
				onClose={() => setExportEventosOpen(false)}
				storeId={tienda.storeId}
			/>
		</>
	);
}
