import CloseIcon from '@mui/icons-material/Close';
import DateRangeIcon from '@mui/icons-material/DateRange';
import EventNoteIcon from '@mui/icons-material/EventNote';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import HistoryIcon from '@mui/icons-material/History';
import PauseCircleOutlineIcon from '@mui/icons-material/PauseCircleOutline';
import PersonSearchIcon from '@mui/icons-material/PersonSearch';
import StorefrontIcon from '@mui/icons-material/Storefront';
import {
	Autocomplete,
	Box,
	Button,
	IconButton,
	InputAdornment,
	Paper,
	Stack,
	Tab,
	Tabs,
	TextField,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import dayjs, { type Dayjs } from 'dayjs';
import { useEffect, useMemo, useState } from 'react';
import Joyride, { type CallBackProps } from 'react-joyride';
import { getStoreNovedades, getStores } from '../api/directus/read';
import NovedadesTab from '../components/NovedadesTab';
import DateRangeFilter from '../components/reportes/DateRangeFilter';
import ExportUnificadoDialog from '../components/reportes/ExportUnificadoDialog';
import FakeExportModal from '../components/tour/FakeExportModal';
import { CustomTooltip } from '../components/tour/TourTooltip';
import { useReportePausas } from '../hooks/useReportePausas';
import { useReporteSemanal } from '../hooks/useReporteSemanal';
import { useReporteTiendasData } from '../hooks/useReporteTiendasData';
import type { NovedadTienda } from '../interfaces/novedades';
import type { Tienda } from '../interfaces/tiendas';
import { exportarRegistroTiendaExcel } from '../utils/exportarRegistroTienda';
import HistorialPage from './HistorialPage';
import ReportePausasTab from './reporte/ReportePausasTab';
import ReporteSemanalTab from './reporte/ReporteSemanalTab';
import ReporteTiendasTab from './reporte/ReporteTiendasTab';
import {
	getTourSteps,
	STEP_FAKE_END,
	STEP_FAKE_START,
	STEP_TAB_NOVEDADES,
	STEP_TAB_PAUSAS,
	STEP_TAB_REGISTROS,
} from './reporte/ReporteTourConfig';

export interface ReportePageProps {
	storeSel: number | null;
	onStoreChange: (id: number | null) => void;
	novedades?: NovedadTienda[];
	esAdmin: boolean;
	tiendasPermitidas?: Tienda[];
}

export default function ReportePage({
	storeSel,
	onStoreChange,
	novedades: _,
	esAdmin,
	tiendasPermitidas,
}: ReportePageProps) {
	const [rangoInicio, setRangoInicio] = useState<Dayjs | null>(
		dayjs().subtract(6, 'day'),
	);
	const [rangoFin, setRangoFin] = useState<Dayjs | null>(dayjs());
	const [searchNombre, setSearchNombre] = useState('');
	const [visualizarTab, setVisualizarTab] = useState<
		'registros' | 'novedades' | 'pausas' | 'semanal' | 'tiendas'
	>('registros');

	const [exportUnificadoOpen, setExportUnificadoOpen] = useState(false);

	// --- Tour guiado ---
	const [runTour, setRunTour] = useState(false);
	const [stepIndex, setStepIndex] = useState(0);
	const [showFakeExport, setShowFakeExport] = useState(false);

	useEffect(() => {
		if (!runTour) return;

		const main = document.querySelector<HTMLElement>('main');
		if (!main) return;

		main.scrollTop = 0;
		const block = (e: Event) => e.preventDefault();
		main.addEventListener('wheel', block, { passive: false });
		main.addEventListener('touchmove', block, { passive: false });

		return () => {
			main.removeEventListener('wheel', block);
			main.removeEventListener('touchmove', block);
		};
	}, [runTour]);

	const tiendaTourTarget = tiendasPermitidas
		? '[data-tour="reporte-tour-tienda-header"]'
		: '[data-tour="reporte-tour-tienda"]';

	const tourSteps = useMemo(
		() => getTourSteps(tiendaTourTarget),
		[tiendaTourTarget],
	);

	const handleJoyrideCallback = (data: CallBackProps) => {
		const { status, type, action, index } = data;

		if (status === 'finished' || status === 'skipped' || action === 'close') {
			setRunTour(false);
			setStepIndex(0);
			setShowFakeExport(false);
			return;
		}

		if (type === 'step:after') {
			const nextIndex = index + (action === 'prev' ? -1 : 1);
			const fakeDebeEstar =
				nextIndex >= STEP_FAKE_START && nextIndex <= STEP_FAKE_END;

			let tabParaMostrar: typeof visualizarTab | null = null;
			if (nextIndex === STEP_TAB_REGISTROS) tabParaMostrar = 'registros';
			else if (nextIndex === STEP_TAB_NOVEDADES) tabParaMostrar = 'novedades';
			else if (nextIndex === STEP_TAB_PAUSAS) tabParaMostrar = 'pausas';

			const necesitaEspera =
				fakeDebeEstar !== showFakeExport || tabParaMostrar !== null;

			if (fakeDebeEstar !== showFakeExport) setShowFakeExport(fakeDebeEstar);
			if (tabParaMostrar) setVisualizarTab(tabParaMostrar);

			if (necesitaEspera) {
				setTimeout(() => setStepIndex(nextIndex), 120);
				return;
			}

			setStepIndex(nextIndex);
		}
	};

	// --- Stores Data ---
	const { data: tiendas = [] } = useQuery<Tienda[]>({
		queryKey: ['adminTiendas'],
		queryFn: getStores,
		staleTime: 30 * 60 * 1000,
	});

	const tiendasAMostrar = tiendasPermitidas || tiendas;
	const OPCION_TODAS: Tienda = { id: -1, name: 'Todas las tiendas' };
	const opcionesTienda = [OPCION_TODAS, ...tiendasAMostrar];

	const queryStoreId =
		storeSel !== null
			? storeSel
			: tiendasPermitidas
				? tiendasAMostrar.map((t) => Number(t.id))
				: null;

	const allStoreIds = useMemo(
		() => tiendasAMostrar.map((t) => Number(t.id)),
		[tiendasAMostrar],
	);

	const targetStores = useMemo(() => {
		if (storeSel !== null) return [storeSel];
		return allStoreIds;
	}, [storeSel, allStoreIds]);

	// --- Novedades query ---
	const { data: storeNovedades = [] } = useQuery<NovedadTienda[]>({
		queryKey: ['storeNovedadesHistory', queryStoreId],
		queryFn: () => getStoreNovedades(queryStoreId),
		enabled: visualizarTab === 'novedades' || visualizarTab === 'semanal',
		staleTime: 5 * 60 * 1000,
	});

	const novedadesFiltradas = useMemo(() => {
		return storeNovedades.filter((n) => {
			const matchNombre = (n.empleadoNombre || '')
				.toLowerCase()
				.includes(searchNombre.toLowerCase());
			let matchFecha = true;
			if (rangoInicio || rangoFin) {
				const fechaNov = dayjs(n.fecha);
				if (rangoInicio && fechaNov.isBefore(rangoInicio, 'day'))
					matchFecha = false;
				if (rangoFin && fechaNov.isAfter(rangoFin, 'day')) matchFecha = false;
			}
			return matchNombre && matchFecha;
		});
	}, [storeNovedades, searchNombre, rangoInicio, rangoFin]);

	// --- Tab-Specific Extracted Hooks ---
	const pausasData = useReportePausas({
		queryStoreId,
		rangoInicio,
		rangoFin,
		searchNombre,
		enabled: visualizarTab === 'pausas',
	});

	const semanalData = useReporteSemanal({
		storeSel,
		tiendasAMostrar,
		tiendasPermitidas,
		searchNombre,
		enabled: visualizarTab === 'semanal',
	});

	const tiendasData = useReporteTiendasData({
		targetStores,
		rangoInicio,
		rangoFin,
		tiendasAMostrar,
		enabled: visualizarTab === 'tiendas',
	});

	return (
		<Box
			sx={{
				p: { xs: 1.5, sm: 3 },
				display: 'flex',
				flexDirection: 'column',
				gap: 3,
			}}
		>
			{showFakeExport && <FakeExportModal />}
			<Paper
				elevation={0}
				sx={{
					p: { xs: 2, sm: 3 },
					borderRadius: 4,
					border: '1px solid #e2e8f0',
					boxShadow: '0 4px 12px rgba(0,0,0,0.02)',
					bgcolor: '#fff',
				}}
			>
				<Box
					sx={{
						display: 'flex',
						justifyContent: 'space-between',
						alignItems: { xs: 'stretch', md: 'center' },
						flexDirection: { xs: 'column', md: 'row' },
						gap: 2.5,
					}}
				>
					{/* Left Filters */}
					<Box
						sx={{
							display: 'flex',
							alignItems: 'center',
							gap: 2,
							flex: 1,
							flexWrap: 'wrap',
						}}
					>
						{!tiendasPermitidas && (
							<Box
								data-tour="reporte-tour-tienda"
								sx={{ width: { xs: '100%', sm: 220 } }}
							>
								<Autocomplete
									size="small"
									options={opcionesTienda}
									getOptionLabel={(option) => option.name}
									isOptionEqualToValue={(option, value) =>
										Number(option.id) === Number(value.id)
									}
									value={
										storeSel !== null
											? opcionesTienda.find(
													(t) => Number(t.id) === Number(storeSel),
												) || null
											: OPCION_TODAS
									}
									onChange={(_, newValue) => {
										onStoreChange(
											newValue && Number(newValue.id) !== -1
												? Number(newValue.id)
												: null,
										);
									}}
									renderInput={(params) => (
										<TextField
											{...params}
											label="Tienda"
											sx={{
												'& .MuiOutlinedInput-root': {
													borderRadius: 2,
													bgcolor: '#f1f7fe',
													height: 40,
												},
											}}
										/>
									)}
								/>
							</Box>
						)}

						<Box
							data-tour="reporte-tour-fechas"
							sx={{ width: { xs: '100%', sm: 300 } }}
						>
							<DateRangeFilter
								fechaInicio={rangoInicio}
								fechaFin={rangoFin}
								onChange={(inicio, fin) => {
									setRangoInicio(inicio);
									setRangoFin(fin);
								}}
							/>
						</Box>

						<TextField
							data-tour="reporte-tour-buscar"
							size="small"
							placeholder="Buscar por nombre..."
							value={searchNombre}
							onChange={(e) => setSearchNombre(e.target.value)}
							slotProps={{
								input: {
									startAdornment: (
										<InputAdornment position="start">
											<PersonSearchIcon sx={{ color: '#004680' }} />
										</InputAdornment>
									),
									endAdornment: searchNombre ? (
										<InputAdornment position="end">
											<IconButton
												size="small"
												onClick={() => setSearchNombre('')}
												edge="end"
												sx={{ color: '#94a3b8', p: 0.5 }}
												title="Limpiar búsqueda"
											>
												<CloseIcon sx={{ fontSize: 16 }} />
											</IconButton>
										</InputAdornment>
									) : null,
								},
							}}
							sx={{
								width: { xs: '100%', sm: 220 },
								'& .MuiOutlinedInput-root': {
									borderRadius: 2,
									bgcolor: '#f1f7fe',
									height: 40,
								},
							}}
						/>
					</Box>

					{/* Right Actions */}
					<Stack
						direction={{ xs: 'row', sm: 'row' }}
						spacing={1.5}
						sx={{
							width: { xs: '100%', sm: 'auto' },
							justifyContent: { xs: 'stretch', sm: 'flex-end' },
						}}
					>
						<Button
							onClick={() => {
								setStepIndex(0);
								setRunTour(true);
							}}
							disabled={runTour}
							variant="contained"
							startIcon={<HelpOutlineIcon sx={{ fontSize: 18 }} />}
							sx={{
								flex: { xs: 1, sm: 'none' },
								backgroundColor: runTour ? '#9CA3AF' : '#004680',
								color: '#ffffff',
								borderRadius: 2,
								textTransform: 'none',
								fontWeight: 700,
								px: 2,
								height: 40,
								boxShadow: 'none',
								opacity: runTour ? 0.6 : 0.9,
								transition: 'all 0.2s ease-in-out',
								'&:hover': {
									backgroundColor: runTour ? '#9CA3AF' : '#003366',
									boxShadow: 'none',
									transform: runTour ? 'none' : 'translateY(-1px)',
								},
								'&:disabled': { backgroundColor: '#9CA3AF', color: '#ffffff' },
							}}
						>
							{runTour ? 'Tutorial...' : 'Tutorial'}
						</Button>

						<Button
							data-tour="reporte-tour-export-unificado"
							variant="contained"
							disableElevation
							startIcon={<FileDownloadIcon />}
							onClick={() => setExportUnificadoOpen(true)}
							sx={{
								flex: { xs: 1, sm: 'none' },
								bgcolor: '#004680',
								color: '#fff',
								borderRadius: 2,
								textTransform: 'none',
								fontWeight: 700,
								height: 40,
								px: 2.5,
								'&:hover': { bgcolor: '#003366' },
							}}
						>
							Exportar Reportes
						</Button>
					</Stack>
				</Box>
			</Paper>

			<Paper
				elevation={0}
				sx={{
					borderRadius: 4,
					border: '1px solid #e2e8f0',
					boxShadow: '0 4px 12px rgba(0,0,0,0.02)',
					bgcolor: '#fff',
					overflow: 'hidden',
				}}
			>
				{/* Modern Scrollable Tab Bar with Icons & Touch Navigation */}
				<Box
					sx={{
						borderBottom: '1px solid #eef2f6',
						bgcolor: '#f8fafc',
						px: { xs: 1, sm: 2 },
					}}
				>
					<Tabs
						value={visualizarTab}
						onChange={(_, val) => setVisualizarTab(val)}
						variant="scrollable"
						scrollButtons="auto"
						allowScrollButtonsMobile
						textColor="primary"
						indicatorColor="primary"
						sx={{
							minHeight: { xs: 46, sm: 50 },
							'& .MuiTabs-scrollButtons': {
								color: '#004680',
								width: { xs: 36, sm: 40 },
								'&.Mui-disabled': { opacity: 0.25 },
							},
							'& .MuiTabs-flexContainer': {
								gap: { xs: 0.5, sm: 1 },
							},
							'& .MuiTab-root': {
								fontWeight: 700,
								textTransform: 'none',
								minHeight: { xs: 46, sm: 50 },
								minWidth: 'auto',
								px: { xs: 1.5, sm: 2 },
								py: { xs: 0.75, sm: 1.25 },
								fontSize: { xs: '0.82rem', sm: '0.875rem' },
								whiteSpace: 'nowrap',
								transition: 'all 0.2s ease',
								borderRadius: '8px 8px 0 0',
								'&:hover': {
									bgcolor: 'rgba(0, 70, 128, 0.04)',
								},
								'&.Mui-selected': {
									color: '#004680',
								},
								'& .MuiTab-iconWrapper': {
									mb: '0 !important',
									mr: { xs: 0.75, sm: 1 },
								},
							},
						}}
					>
						<Tab
							value="registros"
							data-tour="reporte-tour-tab-registros"
							icon={<HistoryIcon sx={{ fontSize: { xs: 17, sm: 19 } }} />}
							iconPosition="start"
							label="Visualizar Registros"
						/>
						<Tab
							value="novedades"
							data-tour="reporte-tour-tab-novedades"
							icon={<EventNoteIcon sx={{ fontSize: { xs: 17, sm: 19 } }} />}
							iconPosition="start"
							label="Visualizar Novedades"
						/>
						<Tab
							value="pausas"
							data-tour="reporte-tour-tab-pausas"
							icon={
								<PauseCircleOutlineIcon sx={{ fontSize: { xs: 17, sm: 19 } }} />
							}
							iconPosition="start"
							label="Visualizar Pausas Activas"
						/>
						<Tab
							value="semanal"
							data-tour="reporte-tour-tab-semanal"
							icon={<DateRangeIcon sx={{ fontSize: { xs: 17, sm: 19 } }} />}
							iconPosition="start"
							label="Reporte Horas Semanal"
						/>
						<Tab
							value="tiendas"
							data-tour="reporte-tour-tab-tiendas"
							icon={<StorefrontIcon sx={{ fontSize: { xs: 17, sm: 19 } }} />}
							iconPosition="start"
							label="Registro de Tienda"
						/>
					</Tabs>
				</Box>

				{/* Tab Panels */}
				{visualizarTab === 'registros' ? (
					<HistorialPage
						storeIdAdmin={queryStoreId}
						hideHeader={true}
						fechaInicioExternal={rangoInicio}
						fechaFinExternal={rangoFin}
						searchNombreExternal={searchNombre}
						esReporte={true}
					/>
				) : visualizarTab === 'novedades' ? (
					<Box sx={{ p: 0 }}>
						<NovedadesTab
							novedades={novedadesFiltradas}
							esAdmin={esAdmin}
							storeOverride={storeSel ?? undefined}
							esReporte={true}
						/>
					</Box>
				) : visualizarTab === 'semanal' ? (
					<ReporteSemanalTab {...semanalData} todasNovedades={storeNovedades} />
				) : visualizarTab === 'tiendas' ? (
					<ReporteTiendasTab
						registrosTienda={tiendasData.registrosTiendaCalculados}
						loading={tiendasData.cargandoRecordsTiendas}
						searchNombre={searchNombre}
						onExportExcel={() =>
							exportarRegistroTiendaExcel({
								registros: tiendasData.registrosTiendaCalculados,
							})
						}
					/>
				) : (
					<ReportePausasTab {...pausasData} />
				)}
			</Paper>

			{/* Unified Export Dialog */}
			<ExportUnificadoDialog
				open={exportUnificadoOpen}
				onClose={() => setExportUnificadoOpen(false)}
				tabInicial={visualizarTab}
				storeSel={storeSel}
				rangoInicioDefault={rangoInicio}
				rangoFinDefault={rangoFin}
				searchNombre={searchNombre}
				tiendasPermitidas={tiendasAMostrar}
				diaInicioSemana={semanalData.diaInicioSemana}
				diaFinSemana={semanalData.diaFinSemana}
			/>

			{/* Guided Tutorial (Joyride) */}
			<Joyride
				steps={tourSteps}
				run={runTour}
				stepIndex={stepIndex}
				continuous
				callback={handleJoyrideCallback}
				tooltipComponent={CustomTooltip}
				disableOverlayClose
				disableScrolling
				disableScrollParentFix
				styles={{
					options: {
						zIndex: 10000,
						arrowColor: '#fff',
						overlayColor: 'rgba(0, 0, 0, 0.5)',
						primaryColor: '#004680',
					},
					overlay: { transition: 'none' },
					spotlight: {
						borderRadius: 8,
						boxShadow: '0 0 0 3px #004680, 0 0 25px rgba(0, 74, 153, 0.4)',
						transition: 'all 0.2s ease-in-out',
					},
					beaconInner: { backgroundColor: '#004680' },
					beaconOuter: {
						backgroundColor: 'rgba(0, 70, 128, 0.3)',
						border: '2px solid #004680',
					},
				}}
				floaterProps={{ disableAnimation: true }}
			/>
		</Box>
	);
}
