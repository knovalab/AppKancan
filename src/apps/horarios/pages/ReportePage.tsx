import FileDownloadIcon from '@mui/icons-material/FileDownload';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import PersonSearchIcon from '@mui/icons-material/PersonSearch';
import {
	Autocomplete,
	Box,
	Button,
	InputAdornment,
	Paper,
	Stack,
	TextField,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import dayjs, { type Dayjs } from 'dayjs';
import { useEffect, useMemo, useState } from 'react';
import Joyride from 'react-joyride';
import {
	fetchTimeRecordStore,
	getEmpleadosBulk,
	getPrimerPeriodoRegistro,
	getStoreEventReports,
	getStoreNovedades,
	getStores,
	getTimeRecordsBulkRange,
} from '../api/directus/read';
import NovedadesTab from '../components/NovedadesTab';
import DateRangeFilter from '../components/reportes/DateRangeFilter';
import ExportEventosDialog from '../components/reportes/ExportEventosDialog';
import ExportHistorialDialog from '../components/reportes/ExportHistorialDialog';
import ExportNovedadesDialog from '../components/reportes/ExportNovedadesDialog';
import ExportSemanalDialog from '../components/reportes/ExportSemanalDialog';
import ExportUnificadoDialog from '../components/reportes/ExportUnificadoDialog';
import FakeExportModal from '../components/tour/FakeExportModal';
import { CustomTooltip } from '../components/tour/TourTooltip';
import type { Tienda } from '../interfaces/tiendas';
import { exportarRegistroTiendaExcel } from '../utils/exportarRegistroTienda';
import { mapearTimeRecordStoreDtoARegistroTienda } from '../utils/registroTienda';
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
import { getSemanasDelMes, NOMBRES_MESES } from './reporte/ReporteUtils';

interface ReportePageProps {
	storeSel: number | null;
	onStoreChange: (id: number | null) => void;
	novedades: any[];
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

	// Estados para reporte semanal
	const [selectedYear, setSelectedYear] = useState(dayjs().year());
	const [selectedMonth, setSelectedMonth] = useState(dayjs().month()); // 0-indexed
	const [diaInicioSemana, setDiaInicioSemana] = useState<number>(1); // 1 = Lunes por defecto
	const [diaFinSemana, setDiaFinSemana] = useState<number>(0); // 0 = Domingo por defecto
	const [pageSemanal, setPageSemanal] = useState(0);
	const ROWS_PER_PAGE_SEMANAL = 10;
	const [reporteSemanalModo, setReporteSemanalModo] = useState<
		'tienda' | 'empleado'
	>('tienda');
	const [selectedEmpleadoId, setSelectedEmpleadoId] = useState<number | null>(
		null,
	);

	const [exportHistorialOpen, setExportHistorialOpen] = useState(false);
	const [exportNovedadesOpen, setExportNovedadesOpen] = useState(false);
	const [exportEventosOpen, setExportEventosOpen] = useState(false);
	const [exportSemanalOpen, setExportSemanalOpen] = useState(false);
	const [exportUnificadoOpen, setExportUnificadoOpen] = useState(false);

	const [pagePausas, setPagePausas] = useState(0);
	const [rowsPerPagePausas, setRowsPerPagePausas] = useState(5);

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

	const handleJoyrideCallback = (data: any) => {
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

	const { data: eventReports = [] } = useQuery<any[]>({
		queryKey: [
			'storeEventReportsHistory',
			queryStoreId,
			rangoInicio?.format('YYYY-MM-DD'),
			rangoFin?.format('YYYY-MM-DD'),
		],
		queryFn: () =>
			getStoreEventReports(
				queryStoreId,
				rangoInicio ? rangoInicio.format('YYYY-MM-DD') : undefined,
				rangoFin ? rangoFin.format('YYYY-MM-DD') : undefined,
			),
		enabled: visualizarTab === 'pausas',
		staleTime: 5 * 60 * 1000,
	});

	useEffect(() => {
		setPagePausas(0);
	}, [queryStoreId, rangoInicio, rangoFin, searchNombre]);

	const { data: storeNovedades = [] } = useQuery<any[]>({
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

	const eventReportsFiltrados = useMemo(() => {
		return eventReports.filter((r) => {
			const first = r.employee_id?.first_name || '';
			const middle = r.employee_id?.middle_name || '';
			const last = r.employee_id?.last_name || '';
			const second = r.employee_id?.second_last_name || '';
			const fullName = [first, middle, last, second]
				.filter(Boolean)
				.join(' ')
				.trim();
			return fullName.toLowerCase().includes(searchNombre.toLowerCase());
		});
	}, [eventReports, searchNombre]);

	const paginatedPausas = eventReportsFiltrados.slice(
		pagePausas * rowsPerPagePausas,
		pagePausas * rowsPerPagePausas + rowsPerPagePausas,
	);
	const totalPagesPausas = Math.max(
		1,
		Math.ceil(eventReportsFiltrados.length / rowsPerPagePausas),
	);

	const semanasDelMes = useMemo(() => {
		return getSemanasDelMes(
			selectedYear,
			selectedMonth,
			diaInicioSemana,
			diaFinSemana,
		);
	}, [selectedYear, selectedMonth, diaInicioSemana, diaFinSemana]);

	const startRange = semanasDelMes[0]?.start;
	const endRange = semanasDelMes[semanasDelMes.length - 1]?.end;

	const allStoreIds = useMemo(
		() => tiendasAMostrar.map((t) => Number(t.id)),
		[tiendasAMostrar],
	);

	const targetStores = useMemo(() => {
		if (storeSel !== null) return [storeSel];
		return allStoreIds;
	}, [storeSel, allStoreIds]);

	const { data: recordsMensuales = [], isLoading: cargandoRecords } = useQuery({
		queryKey: ['recordsMensuales', targetStores, startRange, endRange],
		queryFn: () => {
			if (targetStores.length === 0 || !startRange || !endRange)
				return Promise.resolve([]);
			return getTimeRecordsBulkRange(targetStores, startRange, endRange);
		},
		enabled:
			visualizarTab === 'semanal' &&
			reporteSemanalModo === 'tienda' &&
			targetStores.length > 0 &&
			!!startRange &&
			!!endRange,
		staleTime: 5 * 60 * 1000,
	});

	const { data: empleadosStore = [], isLoading: cargandoEmpleados } = useQuery({
		queryKey: ['empleadosStore', targetStores],
		queryFn: () => {
			if (targetStores.length === 0) return Promise.resolve([]);
			return getEmpleadosBulk(targetStores);
		},
		enabled:
			visualizarTab === 'semanal' &&
			reporteSemanalModo === 'tienda' &&
			targetStores.length > 0,
		staleTime: 5 * 60 * 1000,
	});

	const { data: todosEmpleados = [], isLoading: cargandoTodosEmpleados } =
		useQuery({
			queryKey: [
				'todosEmpleadosAutocomplete',
				tiendasPermitidas ? allStoreIds : [],
			],
			queryFn: () => getEmpleadosBulk(tiendasPermitidas ? allStoreIds : []),
			enabled: visualizarTab === 'semanal',
			staleTime: 30 * 60 * 1000,
		});

	const {
		data: recordsMensualesGlobal = [],
		isLoading: cargandoRecordsGlobal,
	} = useQuery({
		queryKey: ['recordsMensualesGlobal', allStoreIds, startRange, endRange],
		queryFn: () => {
			if (allStoreIds.length === 0 || !startRange || !endRange)
				return Promise.resolve([]);
			return getTimeRecordsBulkRange(allStoreIds, startRange, endRange);
		},
		enabled:
			visualizarTab === 'semanal' &&
			reporteSemanalModo === 'empleado' &&
			allStoreIds.length > 0 &&
			!!startRange &&
			!!endRange,
		staleTime: 5 * 60 * 1000,
	});

	const recordsSelectedEmp = useMemo(() => {
		if (!selectedEmpleadoId) return [];
		return recordsMensualesGlobal.filter(
			(r) =>
				Number(r.employee_id?.id || r.employee_id) ===
				Number(selectedEmpleadoId),
		);
	}, [recordsMensualesGlobal, selectedEmpleadoId]);

	const storesTrabajadas = useMemo(() => {
		if (recordsSelectedEmp.length === 0) return [];
		const storesMap = new Map<number, string>(
			tiendasAMostrar.map((t) => [Number(t.id), t.name]),
		);
		const uniqueIds = Array.from(
			new Set(recordsSelectedEmp.map((r) => Number(r.store_id))),
		);
		return uniqueIds.map((id) => ({
			id,
			name: storesMap.get(id) || `Tienda #${id}`,
		}));
	}, [recordsSelectedEmp, tiendasAMostrar]);

	const fechaInicioStr = rangoInicio
		? rangoInicio.format('YYYY-MM-DD')
		: undefined;
	const fechaFinStr = rangoFin ? rangoFin.format('YYYY-MM-DD') : undefined;

	const { data: dbRecordsTienda = [], isLoading: cargandoRecordsTiendas } =
		useQuery({
			queryKey: [
				'timeRecordStoreDirectus',
				targetStores,
				fechaInicioStr,
				fechaFinStr,
			],
			queryFn: () => {
				if (targetStores.length === 0) return Promise.resolve([]);
				return fetchTimeRecordStore(fechaInicioStr, fechaFinStr, targetStores);
			},
			enabled: visualizarTab === 'tiendas' && targetStores.length > 0,
			staleTime: 5 * 60 * 1000,
		});

	const registrosTiendaCalculados = useMemo(() => {
		if (visualizarTab !== 'tiendas') return [];
		const storesMap = new Map<number, string>(
			tiendasAMostrar.map((t) => [Number(t.id), t.name]),
		);
		return dbRecordsTienda.map((r) =>
			mapearTimeRecordStoreDtoARegistroTienda(r, storesMap),
		);
	}, [visualizarTab, dbRecordsTienda, tiendasAMostrar]);

	const empleadosFiltradosSemanales = useMemo(() => {
		return empleadosStore.filter((emp: any) => {
			const fullName = emp.nombre || '';
			return fullName.toLowerCase().includes(searchNombre.toLowerCase());
		});
	}, [empleadosStore, searchNombre]);

	const paginatedEmpleadosSemanal = useMemo(() => {
		const start = pageSemanal * ROWS_PER_PAGE_SEMANAL;
		return empleadosFiltradosSemanales.slice(
			start,
			start + ROWS_PER_PAGE_SEMANAL,
		);
	}, [empleadosFiltradosSemanales, pageSemanal]);

	const totalPagesSemanal = Math.max(
		1,
		Math.ceil(empleadosFiltradosSemanales.length / ROWS_PER_PAGE_SEMANAL),
	);

	const { data: primerPeriodo = { year: dayjs().year(), month: 0 } } = useQuery(
		{
			queryKey: ['primerPeriodoRegistro'],
			queryFn: getPrimerPeriodoRegistro,
			staleTime: Infinity,
		},
	);

	const listadoAnios = useMemo(() => {
		const currentYear = dayjs().year();
		const years = [];
		const startY = primerPeriodo.year;
		for (let y = startY; y <= currentYear; y++) {
			years.push(y);
		}
		if (years.length === 0) {
			years.push(currentYear);
		}
		return years;
	}, [primerPeriodo.year]);

	const listadoMeses = useMemo(() => {
		const startM =
			selectedYear === primerPeriodo.year ? primerPeriodo.month : 0;
		const endM = selectedYear === dayjs().year() ? dayjs().month() : 11;
		const months = [];
		for (let m = startM; m <= endM; m++) {
			months.push({ value: m, label: NOMBRES_MESES[m] });
		}
		return months;
	}, [selectedYear, primerPeriodo]);

	useEffect(() => {
		const minM = selectedYear === primerPeriodo.year ? primerPeriodo.month : 0;
		const maxM = selectedYear === dayjs().year() ? dayjs().month() : 11;
		if (selectedMonth < minM) {
			setSelectedMonth(minM);
		} else if (selectedMonth > maxM) {
			setSelectedMonth(maxM);
		}
	}, [selectedYear, primerPeriodo, selectedMonth]);

	useEffect(() => {
		setPageSemanal(0);
	}, [storeSel, selectedMonth, selectedYear, searchNombre]);

	return (
		<Box
			sx={{
				display: 'flex',
				flexDirection: 'column',
				gap: 3,
				position: 'relative',
			}}
		>
			{showFakeExport && <FakeExportModal />}
			<Paper
				elevation={0}
				sx={{
					p: 3,
					borderRadius: 4,
					border: '1px solid #f0e2e2ff',
					boxShadow: '0 4px 12px rgba(0,0,0,0.02)',
					bgcolor: '#fff',
				}}
			>
				<Box
					sx={{
						display: 'flex',
						justifyContent: 'space-between',
						alignItems: 'center',
						flexWrap: 'wrap',
						gap: 3,
					}}
				>
					<Box
						sx={{
							display: 'flex',
							alignItems: 'center',
							gap: 2,
							flex: 1,
							minWidth: 300,
							flexWrap: 'wrap',
						}}
					>
						{!tiendasPermitidas && (
							<Box data-tour="reporte-tour-tienda">
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
									sx={{ width: { xs: '100%', sm: 220 } }}
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

					<Stack
						direction={{ xs: 'column', sm: 'row' }}
						spacing={1.5}
						sx={{ width: { xs: '100%', sm: 'auto' } }}
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
								backgroundColor: runTour ? '#9CA3AF' : '#004680',
								color: '#ffffff',
								borderRadius: 1.5,
								textTransform: 'none',
								fontWeight: 'bold',
								px: 2,
								py: 0.75,
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
								bgcolor: '#004680',
								color: '#fff',
								borderRadius: 2,
								textTransform: 'none',
								fontWeight: 'bold',
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
					border: '1px solid #f0e2e2ff',
					boxShadow: '0 4px 12px rgba(0,0,0,0.02)',
					bgcolor: '#fff',
					overflow: 'hidden',
				}}
			>
				<Box
					sx={{
						display: 'flex',
						borderBottom: '1px solid #eef2f6',
						px: 2,
						bgcolor: '#f8fafc',
						gap: 2,
					}}
				>
					<Button
						data-tour="reporte-tour-tab-registros"
						onClick={() => setVisualizarTab('registros')}
						sx={{
							color: visualizarTab === 'registros' ? '#004680' : '#64748b',
							borderBottom:
								visualizarTab === 'registros'
									? '3px solid #004680'
									: '3px solid transparent',
							borderRadius: 0,
							py: 1.5,
							fontWeight: 700,
							textTransform: 'none',
							fontSize: '0.85rem',
							'&:hover': { bgcolor: 'transparent', color: '#004680' },
						}}
					>
						Visualizar Registros
					</Button>
					<Button
						data-tour="reporte-tour-tab-novedades"
						onClick={() => setVisualizarTab('novedades')}
						sx={{
							color: visualizarTab === 'novedades' ? '#004680' : '#64748b',
							borderBottom:
								visualizarTab === 'novedades'
									? '3px solid #004680'
									: '3px solid transparent',
							borderRadius: 0,
							py: 1.5,
							fontWeight: 700,
							textTransform: 'none',
							fontSize: '0.85rem',
							'&:hover': { bgcolor: 'transparent', color: '#004680' },
						}}
					>
						Visualizar Novedades
					</Button>
					<Button
						data-tour="reporte-tour-tab-pausas"
						onClick={() => setVisualizarTab('pausas')}
						sx={{
							color: visualizarTab === 'pausas' ? '#004680' : '#64748b',
							borderBottom:
								visualizarTab === 'pausas'
									? '3px solid #004680'
									: '3px solid transparent',
							borderRadius: 0,
							py: 1.5,
							fontWeight: 700,
							textTransform: 'none',
							fontSize: '0.85rem',
							'&:hover': { bgcolor: 'transparent', color: '#004680' },
						}}
					>
						Visualizar Pausas Activas
					</Button>
					<Button
						data-tour="reporte-tour-tab-semanal"
						onClick={() => setVisualizarTab('semanal')}
						sx={{
							color: visualizarTab === 'semanal' ? '#004680' : '#64748b',
							borderBottom:
								visualizarTab === 'semanal'
									? '3px solid #004680'
									: '3px solid transparent',
							borderRadius: 0,
							py: 1.5,
							fontWeight: 700,
							textTransform: 'none',
							fontSize: '0.85rem',
							'&:hover': { bgcolor: 'transparent', color: '#004680' },
						}}
					>
						Reporte Horas Semanal
					</Button>
					<Button
						data-tour="reporte-tour-tab-tiendas"
						onClick={() => setVisualizarTab('tiendas')}
						sx={{
							color: visualizarTab === 'tiendas' ? '#004680' : '#64748b',
							borderBottom:
								visualizarTab === 'tiendas'
									? '3px solid #004680'
									: '3px solid transparent',
							borderRadius: 0,
							py: 1.5,
							fontWeight: 700,
							textTransform: 'none',
							fontSize: '0.85rem',
							'&:hover': { bgcolor: 'transparent', color: '#004680' },
						}}
					>
						Registro de Tienda
					</Button>
				</Box>

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
					<ReporteSemanalTab
						reporteSemanalModo={reporteSemanalModo}
						setReporteSemanalModo={setReporteSemanalModo}
						storeSel={storeSel}
						selectedMonth={selectedMonth}
						setSelectedMonth={setSelectedMonth}
						selectedYear={selectedYear}
						setSelectedYear={setSelectedYear}
						listadoMeses={listadoMeses}
						listadoAnios={listadoAnios}
						cargandoRecords={cargandoRecords}
						cargandoEmpleados={cargandoEmpleados}
						semanasDelMes={semanasDelMes}
						paginatedEmpleadosSemanal={paginatedEmpleadosSemanal}
						empleadosFiltradosSemanales={empleadosFiltradosSemanales}
						recordsMensuales={recordsMensuales}
						pageSemanal={pageSemanal}
						setPageSemanal={setPageSemanal}
						totalPagesSemanal={totalPagesSemanal}
						todosEmpleados={todosEmpleados}
						selectedEmpleadoId={selectedEmpleadoId}
						setSelectedEmpleadoId={setSelectedEmpleadoId}
						recordsSelectedEmp={recordsSelectedEmp}
						cargandoTodosEmpleados={cargandoTodosEmpleados}
						cargandoRecordsGlobal={cargandoRecordsGlobal}
						storesTrabajadas={storesTrabajadas}
						todasNovedades={storeNovedades}
						diaInicioSemana={diaInicioSemana}
						setDiaInicioSemana={setDiaInicioSemana}
						diaFinSemana={diaFinSemana}
						setDiaFinSemana={setDiaFinSemana}
						tiendas={tiendasAMostrar}
					/>
				) : visualizarTab === 'tiendas' ? (
					<ReporteTiendasTab
						registrosTienda={registrosTiendaCalculados}
						loading={cargandoRecordsTiendas}
						searchNombre={searchNombre}
						onExportExcel={() =>
							exportarRegistroTiendaExcel({
								registros: registrosTiendaCalculados,
							})
						}
					/>
				) : (
					<ReportePausasTab
						paginatedPausas={paginatedPausas}
						eventReportsFiltrados={eventReportsFiltrados}
						pagePausas={pagePausas}
						setPagePausas={setPagePausas}
						totalPagesPausas={totalPagesPausas}
						rowsPerPagePausas={rowsPerPagePausas}
						setRowsPerPagePausas={setRowsPerPagePausas}
					/>
				)}
			</Paper>

			<ExportUnificadoDialog
				open={exportUnificadoOpen}
				onClose={() => setExportUnificadoOpen(false)}
				tabInicial={visualizarTab}
				storeSel={storeSel}
				rangoInicioDefault={rangoInicio}
				rangoFinDefault={rangoFin}
				searchNombre={searchNombre}
				tiendasPermitidas={tiendasAMostrar}
				diaInicioSemana={diaInicioSemana}
				diaFinSemana={diaFinSemana}
			/>

			<ExportHistorialDialog
				open={exportHistorialOpen}
				onClose={() => setExportHistorialOpen(false)}
				tiendaDefault={storeSel}
				fechaInicio={rangoInicio ? rangoInicio.format('YYYY-MM-DD') : undefined}
				fechaFin={rangoFin ? rangoFin.format('YYYY-MM-DD') : undefined}
				searchNombre={searchNombre}
			/>
			<ExportNovedadesDialog
				open={exportNovedadesOpen}
				onClose={() => setExportNovedadesOpen(false)}
				tiendaDefault={storeSel}
				fechaInicio={rangoInicio ? rangoInicio.format('YYYY-MM-DD') : undefined}
				fechaFin={rangoFin ? rangoFin.format('YYYY-MM-DD') : undefined}
				searchNombre={searchNombre}
			/>
			<ExportEventosDialog
				open={exportEventosOpen}
				onClose={() => setExportEventosOpen(false)}
				storeId={storeSel}
				fechaInicio={rangoInicio ? rangoInicio.format('YYYY-MM-DD') : undefined}
				fechaFin={rangoFin ? rangoFin.format('YYYY-MM-DD') : undefined}
			/>
			<ExportSemanalDialog
				open={exportSemanalOpen}
				onClose={() => setExportSemanalOpen(false)}
				fechaInicioDefault={rangoInicio}
				fechaFinDefault={rangoFin}
				tiendasPermitidas={tiendasPermitidas}
				diaInicioSemana={diaInicioSemana}
				diaFinSemana={diaFinSemana}
			/>

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
