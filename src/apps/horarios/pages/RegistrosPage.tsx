import AssignmentIcon from '@mui/icons-material/Assignment';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import {
	Alert,
	Box,
	Button,
	Chip,
	Tooltip,
	Typography,
	useMediaQuery,
	useTheme,
} from '@mui/material';
import { useEffect, useMemo, useState } from 'react';
import LoadingSpinner from '@/shared/components/LoadingSpinner';
import { useTutorial } from '@/shared/hooks/TutorialContext';
import { botonHeaderSx } from '../components/botonHeaderSx';
import EmployeeCard from '../components/employee-card/EmployeeCard';
import { HeaderActions } from '../components/HeaderActions';
import { BarraAccionesTarjetas } from '../components/registro/BarraAccionesTarjetas';
import ExportEventosDialog from '../components/reportes/ExportEventosDialog';
import { useHorariosTour } from '../components/tour/HorariosTourContext';
import { calcularEstado, ESTADO, ID_EMPLEADO_DEMO } from '../domain/registro';
import { useAccionesDemo } from '../hooks/registro/useAccionesDemo';
import { useAccionesTarjeta } from '../hooks/registro/useAccionesTarjeta';
import { useTarjetasColapsables } from '../hooks/registro/useTarjetasColapsables';
import { useAceptacionNormasEmpleados } from '../hooks/useAceptacionNormasEmpleados';
import { useHorarios } from '../hooks/useHorarios';
import { useHorariosLayout } from '../hooks/useHorariosLayout';

/**
 * Sección "Registros" (/horarios/registros): marcación de asistencia del día.
 * Header, pestañas, selector de tienda, normas y tour viven en layouts/HorariosLayout.
 */
export default function RegistrosPage() {
	const { tienda, acceso } = useHorariosLayout();
	// Perfil tienda: vista limpia sin Exportar/Total ni textos auxiliares de la barra.
	const vistaTienda = acceso.rolPrincipal === 'tienda';
	const { startTour } = useHorariosTour();
	const { activeTutorial, endTutorial } = useTutorial();
	const [modoDemo, setModoDemo] = useState(false);
	const [exportEventosOpen, setExportEventosOpen] = useState(false);

	const { empleados, tiposNovedad, reasons, loading, error, agregarNovedad } =
		useHorarios(tienda.storeId);

	// Una sola consulta de aceptación de normas para toda la tienda (antes, una por tarjeta).
	const empleadoIds = useMemo(() => empleados.map((e) => e.id), [empleados]);
	const {
		normas,
		puedeAceptar: puedeAceptarNormas,
		yaAcepto: yaAceptoNormas,
		marcarAceptado,
		verificarAceptacion,
	} = useAceptacionNormasEmpleados(empleadoIds);

	// Mismo contrato para las tarjetas reales (Directus) y la del tour (en memoria).
	const acciones = useAccionesTarjeta({
		storeId: tienda.storeId,
		empleados,
		agregarNovedad,
		normas,
		verificarAceptacion,
		marcarAceptado,
	});
	const demo = useAccionesDemo();
	const catalogos = useMemo(
		() => ({ tiposNovedad, motivos: reasons }),
		[tiposNovedad, reasons],
	);

	// Control de tarjetas colapsables con persistencia por tienda
	const colapso = useTarjetasColapsables(tienda.storeId, empleados);

	const conteos = useMemo(() => {
		let activas = 0;
		let pendientes = 0;
		let finalizadas = 0;
		for (const emp of empleados) {
			const estado = calcularEstado(emp.registros);
			if (
				estado === ESTADO.jornadaIniciada ||
				estado === ESTADO.enAlmuerzo ||
				estado === ESTADO.regresoAlmuerzo
			) {
				activas++;
			} else if (estado === ESTADO.entradaPendiente) {
				pendientes++;
			} else if (estado === ESTADO.jornadaFinalizada) {
				finalizadas++;
			}
		}
		return { activas, pendientes, finalizadas };
	}, [empleados]);

	const theme = useTheme();
	const isMd = useMediaQuery(theme.breakpoints.up('md'));
	const isSm = useMediaQuery(theme.breakpoints.up('sm'));
	const numCols = isMd ? 3 : isSm ? 2 : 1;

	const listaTarjetas = useMemo(() => {
		const items: React.ReactNode[] = [];
		if (modoDemo) {
			items.push(
				<EmployeeCard
					key={`demo-${ID_EMPLEADO_DEMO}`}
					demo
					empleado={demo.empleado}
					expandida={colapso.isExpanded(ID_EMPLEADO_DEMO)}
					onToggleExpandir={() => colapso.toggle(ID_EMPLEADO_DEMO)}
					catalogos={catalogos}
					normas={{
						vigentes: normas,
						aceptadas: true,
						puedeAceptar: false,
					}}
					acciones={demo.acciones}
				/>,
			);
		}
		for (const empleado of empleados) {
			items.push(
				<EmployeeCard
					key={empleado.id}
					empleado={empleado}
					expandida={colapso.isExpanded(empleado.id)}
					onToggleExpandir={() => colapso.toggle(empleado.id)}
					catalogos={catalogos}
					normas={{
						vigentes: normas,
						aceptadas: yaAceptoNormas(empleado.id),
						puedeAceptar: puedeAceptarNormas,
					}}
					acciones={acciones}
				/>,
			);
		}
		return items;
	}, [
		modoDemo,
		demo.empleado,
		demo.acciones,
		empleados,
		colapso,
		catalogos,
		normas,
		yaAceptoNormas,
		puedeAceptarNormas,
		acciones,
	]);

	const columnas = useMemo(() => {
		const cols: Array<{ id: string; items: React.ReactNode[] }> = Array.from(
			{ length: numCols },
			(_, i) => ({ id: `columna-tarjeta-${i + 1}`, items: [] }),
		);
		listaTarjetas.forEach((tarjeta, index) => {
			cols[index % numCols].items.push(tarjeta);
		});
		return cols;
	}, [listaTarjetas, numCols]);

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
			{!vistaTienda && (
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
			)}

			{error && (
				<Alert severity="warning" sx={{ mb: 2, mx: { xs: 0.5, sm: 0 } }}>
					{error}
				</Alert>
			)}

			{loading ? (
				<LoadingSpinner message="Cargando datos del servidor..." />
			) : (
				<>
					<BarraAccionesTarjetas
						totalEmpleados={colapso.totalEmpleados}
						totalExpandidas={colapso.totalExpandidas}
						totalColapsadas={colapso.totalColapsadas}
						todasExpandidas={colapso.todasExpandidas}
						todasColapsadas={colapso.todasColapsadas}
						conteos={conteos}
						onExpandirTodas={colapso.expandirTodas}
						onContraerTodas={colapso.contraerTodas}
						onExpandirPorEstado={colapso.expandirPorEstado}
						compacta={vistaTienda}
					/>
					{empleados.length === 0 && !modoDemo ? (
						<Typography variant="body1" sx={{ color: '#64748b', mt: 4 }}>
							No hay empleados pendientes por gestionar.
						</Typography>
					) : (
						<Box
							sx={{
								display: 'grid',
								gridTemplateColumns: {
									xs: '1fr',
									sm: 'repeat(2, minmax(0, 1fr))',
									md: 'repeat(3, minmax(0, 1fr))',
								},
								gap: { xs: 1.5, sm: 3 },
								alignItems: 'start',
								width: '100%',
								mt: { xs: 0.5, sm: 0 },
							}}
						>
							{columnas.map((columna) => (
								<Box
									key={columna.id}
									sx={{
										display: 'flex',
										flexDirection: 'column',
										gap: { xs: 1.5, sm: 3 },
										minWidth: 0,
									}}
								>
									{columna.items}
								</Box>
							))}
						</Box>
					)}
				</>
			)}

			<ExportEventosDialog
				open={exportEventosOpen}
				onClose={() => setExportEventosOpen(false)}
				storeId={tienda.storeId}
			/>
		</>
	);
}
