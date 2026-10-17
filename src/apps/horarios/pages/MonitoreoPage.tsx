import {
	ArrowBackIos as ArrowBackIosIcon,
	ArrowDownward as ArrowDownwardIcon,
	ArrowForwardIos as ArrowForwardIosIcon,
	ArrowUpward as ArrowUpwardIcon,
	Assignment as AssignmentIcon,
	Block as BlockIcon,
	CalendarToday as CalendarTodayIcon,
	CheckCircle as CheckCircleIcon,
	Close as CloseIcon,
	EditNote as EditNoteIcon,
	Message as MessageIcon,
	Pending as PendingIcon,
	Person as PersonIcon,
	Search as SearchIcon,
	Sort as SortIcon,
	Storefront as StorefrontIcon,
	Today as TodayIcon,
	Visibility as VisibilityIcon,
	Warning as WarningIcon,
} from '@mui/icons-material';
import {
	Alert,
	Avatar,
	Box,
	Button,
	Chip,
	CircularProgress,
	Container,
	Dialog,
	DialogActions,
	DialogContent,
	DialogTitle,
	FormControl,
	Grid,
	IconButton,
	InputAdornment,
	InputLabel,
	List,
	ListItem,
	ListItemAvatar,
	ListItemText,
	MenuItem,
	OutlinedInput,
	Paper,
	Select,
	Tab,
	Table,
	TableBody,
	TableCell,
	TableContainer,
	TableHead,
	TableRow,
	Tabs,
	TextField,
	Tooltip,
	Typography,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import dayjs, { type Dayjs } from 'dayjs';
import { useEffect, useMemo, useState } from 'react';
import 'dayjs/locale/es';

dayjs.locale('es');

import { obtenerTiendasIdsUsuarioActual } from '@/services/directus/userStores';
import { getEditedTimeRecords, getStores } from '../api/directus/read';
import ModalCierreMasivo from '../components/ModalCierreMasivo';
import ModalDetalleTienda from '../components/ModalDetalleTienda';
import ModalRankingTiendas from '../components/ModalRankingTiendas';
import DateRangeFilter from '../components/reportes/DateRangeFilter';
import ReporteSemanalAreaManager from '../components/reportes/ReporteSemanalAreaManager';
import { useHorariosPolicies } from '../hooks/useHorariosPolicies';
import type { Tienda } from '../interfaces/tiendas';
import DetallePlanillaPage from '../pages/DetallePlanillaPage';
import {
	Paginador,
	TarjetaEstadistica,
	TarjetaResumen,
} from './monitoreo/MonitoreoComponents';
import MonitoreoFotosTab from './monitoreo/MonitoreoFotosTab';
import MonitoreoOperacionTab from './monitoreo/MonitoreoOperacionTab';
import {
	COLUMNAS_EDICIONES,
	COLUMNAS_TIENDAS,
	getColorForMotivo,
	type MonitoreoPageProps,
	OPCIONES_ORDEN,
	rowsPerPage,
	type SortField,
	TARJETAS_ESTADISTICAS,
} from './monitoreo/MonitoreoUtils';
import { useTiendasResumen } from './monitoreo/useTiendasResumen';

// ---------- COMPONENTE PRINCIPAL ----------
export default function MonitoreoGeneralPage({ storeId }: MonitoreoPageProps) {
	const { esAdmin, esReport, esAreaManager } = useHorariosPolicies();
	const isAreaMgr = esAreaManager() && !esAdmin();

	const [subTab, setSubTab] = useState(0);
	const [fechas, setFechas] = useState<{
		inicio: Dayjs | null;
		fin: Dayjs | null;
	}>({ inicio: dayjs().startOf('month'), fin: dayjs() });
	const [buscarEmpleado, setBuscarEmpleado] = useState('');
	const [paginaEdiciones, setPaginaEdiciones] = useState(0);
	const [motivosSeleccionados, setMotivosSeleccionados] = useState<string[]>(
		[],
	);
	const [modalObs, setModalObs] = useState({
		open: false,
		empleado: '',
		fecha: '',
		texto: '',
	});
	const [modalEmpleadosOpen, setModalEmpleadosOpen] = useState(false);
	const [tiendaSeleccionada, setTiendaSeleccionada] = useState<number | null>(
		null,
	);
	const [paginaTiendas, setPaginaTiendas] = useState(0);
	const [paginaRanking, setPaginaRanking] = useState(0);
	const [buscarEmpleadoRanking, setBuscarEmpleadoRanking] = useState('');
	const [rankingMotivos, setRankingMotivos] = useState<string[]>([]);
	const [rankingMes, setRankingMes] = useState<Dayjs>(dayjs());
	const [ordenTiendas, setOrdenTiendas] = useState<{
		by: SortField;
		dir: 'asc' | 'desc';
	}>({ by: 'nombre', dir: 'asc' });
	const [resumenMes, setResumenMes] = useState<Dayjs>(dayjs());
	const [ordenEdiciones, setOrdenEdiciones] = useState<'asc' | 'desc'>('desc');

	// ---------- ESTADOS PARA CALENDARIO (MODIFICADOS) ----------
	const [calendario, setCalendario] = useState<{
		empleadoId: number | null;
		mes: Dayjs;
		dia: string | null;
		open: boolean;
	}>({ empleadoId: null, mes: dayjs(), dia: null, open: false });
	const [calendarioData, setCalendarioData] = useState<any[]>([]); // Datos específicos del empleado para el mes seleccionado
	const [cargandoCalendario, setCargandoCalendario] = useState(false);

	// ---------- ESTADOS PARA RANKING DE TIENDAS ----------
	const [modalTiendasOpen, setModalTiendasOpen] = useState(false);
	const [rankingMesTiendas, setRankingMesTiendas] = useState<Dayjs>(dayjs());

	const { data: todasLasTiendas = [], isLoading: cargandoTiendas } = useQuery<
		Tienda[]
	>({
		queryKey: ['adminTiendas'],
		queryFn: getStores,
		enabled: esAdmin() || esReport() || isAreaMgr,
		staleTime: 30 * 60 * 1000,
	});
	const { data: tiendasAcceso = [] } = useQuery<number[]>({
		queryKey: ['tiendasAccesoUsuario'],
		queryFn: () => obtenerTiendasIdsUsuarioActual({ excludeOnline: true }),
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
			return todasLasTiendas.filter((t) =>
				idsPermitidos.includes(Number(t.id)),
			);
		}
		return todasLasTiendas;
	}, [todasLasTiendas, tiendasAcceso, isAreaMgr]);

	const tiendas = useMemo(() => {
		if (Array.isArray(storeId))
			return tiendasFiltradas.filter((t) =>
				(storeId as number[]).includes(Number(t.id)),
			);
		if (storeId != null)
			return tiendasFiltradas.filter((t) => Number(t.id) === Number(storeId));
		return tiendasFiltradas;
	}, [tiendasFiltradas, storeId]);

	const { data: editedRecords = [], isLoading: cargandoEdiciones } = useQuery({
		queryKey: [
			'editedRecords',
			storeId,
			fechas.inicio?.format('YYYY-MM-DD'),
			fechas.fin?.format('YYYY-MM-DD'),
			todasLasTiendas,
			tiendasFiltradas,
		],
		queryFn: () => {
			const storeIds = isAreaMgr
				? tiendasFiltradas.map((t) => Number(t.id))
				: storeId
					? Array.isArray(storeId)
						? storeId
						: [Number(storeId)]
					: todasLasTiendas.map((t) => Number(t.id));
			const inicio = fechas.inicio
				? fechas.inicio.format('YYYY-MM-DD')
				: dayjs().startOf('month').format('YYYY-MM-DD');
			const fin = fechas.fin
				? fechas.fin.format('YYYY-MM-DD')
				: dayjs().format('YYYY-MM-DD');
			return getEditedTimeRecords(storeIds, inicio, fin);
		},
		enabled: !!(isAreaMgr ? tiendasFiltradas.length : todasLasTiendas.length),
		staleTime: 5 * 60 * 1000,
	});

	const fechasResumen = useMemo(
		() => ({
			inicio: resumenMes.startOf('month'),
			fin: resumenMes.isSame(dayjs(), 'month')
				? dayjs()
				: resumenMes.endOf('month'),
		}),
		[resumenMes],
	);

	const {
		resumen: resumenTiendas,
		loading: cargandoResumen,
		error: errorResumen,
	} = useTiendasResumen(tiendas, fechasResumen);

	// ---------- DECLARACIONES DE useMemo ----------
	const motivosUnicos = useMemo(() => {
		const s = new Set<string>();
		editedRecords.forEach((r) => {
			if (r.motivo) s.add(r.motivo);
		});
		return Array.from(s).sort();
	}, [editedRecords]);
	const statsEdiciones = useMemo(() => {
		const uniqueEmpleados = new Set(editedRecords.map((r) => r.empleadoId));
		const storeCounts: Record<string, number> = {};
		editedRecords.forEach((r) => {
			storeCounts[r.tiendaNombre] = (storeCounts[r.tiendaNombre] || 0) + 1;
		});
		let topStore = 'Ninguna',
			max = 0;
		Object.entries(storeCounts).forEach(([name, count]) => {
			if (count > max) {
				max = count;
				topStore = `${name} (${count})`;
			}
		});
		return {
			total: editedRecords.length,
			empleados: uniqueEmpleados.size,
			topStore,
		};
	}, [editedRecords]);

	const rankingBase = useMemo(() => {
		const map = new Map<
			number,
			{ id: number; nombre: string; total: number; tienda: string }
		>();
		editedRecords.forEach((r) => {
			const coincideMotivo =
				rankingMotivos.length === 0 || rankingMotivos.includes(r.motivo);
			const coincideMes = dayjs(r.fecha).isSame(rankingMes, 'month');
			if (coincideMotivo && coincideMes) {
				if (!map.has(r.empleadoId))
					map.set(r.empleadoId, {
						id: r.empleadoId,
						nombre: r.empleadoNombre,
						total: 0,
						tienda: r.tiendaNombre,
					});
				map.get(r.empleadoId)!.total += 1;
			}
		});
		return Array.from(map.values());
	}, [editedRecords, rankingMotivos, rankingMes]);

	const rankingEmpleados = useMemo(() => {
		const ordenados = [...rankingBase];
		ordenados.sort((a, b) =>
			ordenEdiciones === 'asc' ? a.total - b.total : b.total - a.total,
		);
		return ordenados;
	}, [rankingBase, ordenEdiciones]);

	const rankingFiltrado = useMemo(() => {
		if (!buscarEmpleadoRanking.trim()) return rankingEmpleados;
		return rankingEmpleados.filter((e) =>
			e.nombre
				.toLowerCase()
				.includes(buscarEmpleadoRanking.toLowerCase().trim()),
		);
	}, [rankingEmpleados, buscarEmpleadoRanking]);

	const topEmpleado = useMemo(() => {
		if (!rankingBase.length) return 'Ninguno';
		const maxEmp = rankingBase.reduce((prev, current) =>
			prev.total > current.total ? prev : current,
		);
		return `${maxEmp.nombre} (${maxEmp.total})`;
	}, [rankingBase]);

	const edicionesFiltradas = useMemo(
		() =>
			editedRecords.filter((r) => {
				const coincideEmpleado = r.empleadoNombre
					.toLowerCase()
					.includes(buscarEmpleado.toLowerCase());
				const coincideMotivo =
					motivosSeleccionados.length === 0 ||
					motivosSeleccionados.includes(r.motivo);
				return coincideEmpleado && coincideMotivo;
			}),
		[editedRecords, buscarEmpleado, motivosSeleccionados],
	);

	const edicionesPagina = useMemo(() => {
		const start = paginaEdiciones * rowsPerPage.ediciones;
		return edicionesFiltradas.slice(start, start + rowsPerPage.ediciones);
	}, [edicionesFiltradas, paginaEdiciones]);

	const tiendasOrdenadas = useMemo(() => {
		const sorted = [...resumenTiendas];
		const { by, dir } = ordenTiendas;
		sorted.sort((a, b) => {
			const va = a[by],
				vb = b[by];
			if (typeof va === 'string')
				return dir === 'asc'
					? va.localeCompare(vb as string)
					: (vb as string).localeCompare(va);
			return dir === 'asc' ? va - (vb as number) : (vb as number) - va;
		});
		return sorted;
	}, [resumenTiendas, ordenTiendas]);

	const tiendasPagina = useMemo(
		() =>
			tiendasOrdenadas.slice(
				paginaTiendas * rowsPerPage.tiendas,
				(paginaTiendas + 1) * rowsPerPage.tiendas,
			),
		[tiendasOrdenadas, paginaTiendas],
	);

	// Calendario
	const edicionesPorEmpleado = useMemo(
		() =>
			calendario.empleadoId
				? editedRecords.filter((r) => r.empleadoId === calendario.empleadoId)
				: [],
		[editedRecords, calendario.empleadoId],
	);
	const diasConEdiciones = useMemo(() => {
		const s = new Set<string>();
		edicionesPorEmpleado.forEach((r) => {
			s.add(r.fecha);
		});
		return s;
	}, [edicionesPorEmpleado]);
	const edicionesDelDia = useMemo(
		() =>
			calendario.dia
				? edicionesPorEmpleado.filter((r) => r.fecha === calendario.dia)
				: [],
		[edicionesPorEmpleado, calendario.dia],
	);
	const conteoPorDia = useMemo(() => {
		const c: Record<string, number> = {};
		edicionesPorEmpleado.forEach((r) => {
			c[r.fecha] = (c[r.fecha] || 0) + 1;
		});
		return c;
	}, [edicionesPorEmpleado]);
	const edicionesDelMes = useMemo(() => {
		const inicioMes = calendario.mes.startOf('month').format('YYYY-MM-DD');
		const finMes = calendario.mes.endOf('month').format('YYYY-MM-DD');
		return edicionesPorEmpleado.filter(
			(r) => r.fecha >= inicioMes && r.fecha <= finMes,
		);
	}, [edicionesPorEmpleado, calendario.mes]);
	const diasConEdicionesMes = useMemo(() => {
		const s = new Set<string>();
		edicionesDelMes.forEach((r) => {
			s.add(r.fecha);
		});
		return s;
	}, [edicionesDelMes]);
	const promedioEdicionesMes = useMemo(
		() =>
			diasConEdicionesMes.size
				? edicionesDelMes.length / diasConEdicionesMes.size
				: 0,
		[edicionesDelMes, diasConEdicionesMes],
	);

	// ---------- EFECTOS PARA REINICIAR PÁGINAS ----------
	useEffect(() => {
		setPaginaTiendas(0);
	}, [resumenTiendas, storeId]);

	useEffect(() => {
		setPaginaEdiciones(0);
	}, [buscarEmpleado, fechas, motivosSeleccionados, storeId]);

	useEffect(() => {
		setPaginaRanking(0);
	}, [rankingFiltrado, storeId]);

	const handleOrdenTiendas = (field: SortField) => {
		if (ordenTiendas.by === field)
			setOrdenTiendas((prev) => ({
				...prev,
				dir: prev.dir === 'asc' ? 'desc' : 'asc',
			}));
		else setOrdenTiendas({ by: field, dir: 'asc' });
		setPaginaTiendas(0);
	};
	const handleCambiarMesRanking = (nuevoMes: Dayjs) => {
		setRankingMes(nuevoMes);
		setFechas({
			inicio: nuevoMes.startOf('month'),
			fin: nuevoMes.isSame(dayjs(), 'month')
				? dayjs()
				: nuevoMes.endOf('month'),
		});
		setPaginaRanking(0);
	};
	const handleCambiarMesRankingTiendas = (nuevoMes: Dayjs) => {
		setRankingMesTiendas(nuevoMes);
		setFechas({
			inicio: nuevoMes.startOf('month'),
			fin: nuevoMes.isSame(dayjs(), 'month')
				? dayjs()
				: nuevoMes.endOf('month'),
		});
	};
	const handleCambiarMesResumen = (nuevoMes: Dayjs) => {
		setResumenMes(nuevoMes);
		setPaginaTiendas(0);
	};

	// ---------- NUEVOS HANDLERS PARA CALENDARIO (MODIFICADO) ----------
	const cargarRegistrosCalendario = async (empleadoId: number, mes: Dayjs) => {
		if (!empleadoId) return;
		setCargandoCalendario(true);
		try {
			const inicio = mes.startOf('month').format('YYYY-MM-DD');
			const fin = mes.endOf('month').format('YYYY-MM-DD');
			const storeIds = isAreaMgr
				? tiendasFiltradas.map((t) => Number(t.id))
				: storeId
					? Array.isArray(storeId)
						? storeId
						: [Number(storeId)]
					: todasLasTiendas.map((t) => Number(t.id));
			const records = await getEditedTimeRecords(storeIds, inicio, fin);
			const filtrados = records.filter((r) => r.empleadoId === empleadoId);
			setCalendarioData(filtrados);
		} catch (error) {
			console.error('Error cargando registros del calendario:', error);
			setCalendarioData([]);
		} finally {
			setCargandoCalendario(false);
		}
	};

	const handleAbrirCalendario = (empleadoId: number) => {
		setCalendario({ empleadoId, mes: dayjs(), dia: null, open: true });
		cargarRegistrosCalendario(empleadoId, dayjs());
	};

	const handleCerrarCalendario = () => {
		setCalendario({ empleadoId: null, mes: dayjs(), dia: null, open: false });
		setCalendarioData([]);
	};

	const handleCambiarMesCalendario = (nuevoMes: Dayjs) => {
		setCalendario((prev) => ({ ...prev, mes: nuevoMes }));
		if (calendario.empleadoId) {
			cargarRegistrosCalendario(calendario.empleadoId, nuevoMes);
		}
	};

	// ---------- HANDLER PARA RANKING DE TIENDAS ----------
	const handleCambiarMesTiendas = (nuevoMes: Dayjs) => {
		setRankingMesTiendas(nuevoMes);
		setFechas({
			inicio: nuevoMes.startOf('month'),
			fin: nuevoMes.isSame(dayjs(), 'month')
				? dayjs()
				: nuevoMes.endOf('month'),
		});
	};

	const handleCloseModalTiendas = () => {
		setModalTiendasOpen(false);
	};

	const [cierreMasivoOpen, setCierreMasivoOpen] = useState(false);

	const totalTiendas = tiendas.length;
	const totalEmpleados = resumenTiendas.reduce(
		(acc, t) => acc + t.totalEmpleados,
		0,
	);
	const totalIncompletos = resumenTiendas.reduce(
		(acc, t) => acc + t.incompletos,
		0,
	);
	const totalSinRegistro = resumenTiendas.reduce(
		(acc, t) => acc + t.sinRegistro,
		0,
	);

	if (cargandoTiendas || (cargandoResumen && !resumenTiendas.length)) {
		return (
			<Box
				sx={{
					display: 'flex',
					flexDirection: 'column',
					gap: 2,
					justifyContent: 'center',
					alignItems: 'center',
					height: '60vh',
				}}
			>
				<CircularProgress size={40} sx={{ color: '#004680' }} />
				<Typography color="text.secondary" fontWeight={600}>
					Cargando métricas...
				</Typography>
			</Box>
		);
	}
	if (errorResumen) {
		return (
			<Container>
				<Alert
					severity="error"
					action={
						<Button color="inherit" size="small" onClick={() => {}}>
							Reintentar
						</Button>
					}
				>
					{errorResumen}
				</Alert>
			</Container>
		);
	}

	return (
		<Box sx={{ backgroundColor: 'transparent', pt: 0, pb: 2 }}>
			<Container maxWidth="xl" disableGutters>
				<Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
					<Tabs
						value={subTab}
						onChange={(_, v) => setSubTab(v)}
						textColor="primary"
						indicatorColor="primary"
					>
						<Tab
							label="Resumen de Asistencia"
							sx={{ fontWeight: 700, textTransform: 'none' }}
						/>
						<Tab
							label="Apertura y Cierre de Tiendas"
							sx={{ fontWeight: 700, textTransform: 'none' }}
						/>
						<Tab
							label="Fotos de Marcaciones"
							sx={{ fontWeight: 700, textTransform: 'none' }}
						/>
						<Tab
							label="Auditoría de Ediciones Manuales"
							sx={{ fontWeight: 700, textTransform: 'none' }}
						/>
						{isAreaMgr && (
							<Tab
								label="Control de Horas"
								sx={{ fontWeight: 700, textTransform: 'none' }}
							/>
						)}
						{isAreaMgr && (
							<Tab
								label="Editar registros"
								sx={{ fontWeight: 700, textTransform: 'none' }}
							/>
						)}
					</Tabs>
				</Box>

				{subTab === 0 && (
					<>
						<Paper
							elevation={0}
							sx={{
								p: 2,
								mb: 2,
								borderRadius: 3,
								border: '1px solid #e0e0e0',
								display: 'flex',
								flexWrap: 'wrap',
								alignItems: 'center',
								justifyContent: 'space-between',
								gap: 2,
							}}
						>
							{/* IZQUIERDA: TARJETAS DE ESTADÍSTICAS */}
							<Box
								sx={{
									display: 'flex',
									flexWrap: 'wrap',
									gap: 4,
									alignItems: 'center',
								}}
							>
								<Tooltip title="Número total de tiendas en el mes seleccionado">
									<TarjetaResumen
										icon={StorefrontIcon}
										label="TIENDAS"
										value={totalTiendas}
										color="#004680"
									/>
								</Tooltip>
								<Tooltip title="Total de empleados activos en todas las tiendas">
									<TarjetaResumen
										icon={PersonIcon}
										label="EMPLEADOS"
										value={totalEmpleados}
										color="#004680"
									/>
								</Tooltip>
								<Tooltip title="Días incompletos en el mes">
									<TarjetaResumen
										icon={WarningIcon}
										label="DÍAS INCOMPLETOS"
										value={totalIncompletos}
										color="#e65100"
									/>
								</Tooltip>
								<Tooltip title="Días sin marcar en el mes">
									<TarjetaResumen
										icon={PendingIcon}
										label="DÍAS SIN MARCAR"
										value={totalSinRegistro}
										color="#d32f2f"
									/>
								</Tooltip>
							</Box>
							<Box
								sx={{
									display: 'flex',
									alignItems: 'center',
									gap: 1.5,
									ml: 'auto',
									flexWrap: 'wrap',
								}}
							>
								{(isAreaMgr || esAdmin()) && (
									<Button
										variant="outlined"
										size="small"
										startIcon={<BlockIcon />}
										onClick={() => setCierreMasivoOpen(true)}
										sx={{
											borderColor: '#004680',
											color: '#004680',
											borderRadius: 2,
											textTransform: 'none',
											fontWeight: 600,
											'&:hover': {
												borderColor: '#003366',
												bgcolor: 'rgba(0,70,128,0.05)',
											},
										}}
									>
										Marcar Días de Cierre
									</Button>
								)}
								{/* DERECHA: FILTROS COMO SE MUESTRA EN LA IMAGEN */}
								<Box
									sx={{
										display: 'flex',
										alignItems: 'center',
										border: '1px solid #d0d7de',
										borderRadius: 2,
										px: 1.5,
										py: 0.5,
										bgcolor: '#ffffff',
									}}
								>
									<CalendarTodayIcon
										sx={{ color: '#004680', fontSize: 16, mr: 1 }}
									/>
									<Typography
										variant="body2"
										fontWeight={600}
										color="#004680"
										sx={{ textTransform: 'capitalize', minWidth: 90 }}
									>
										{resumenMes.format('MMMM YYYY')}
									</Typography>
									<IconButton
										size="small"
										onClick={() =>
											handleCambiarMesResumen(resumenMes.subtract(1, 'month'))
										}
										sx={{ color: '#004680', p: 0.5 }}
									>
										<ArrowBackIosIcon fontSize="small" sx={{ fontSize: 14 }} />
									</IconButton>
									<IconButton
										size="small"
										onClick={() =>
											handleCambiarMesResumen(resumenMes.add(1, 'month'))
										}
										disabled={resumenMes.isSame(dayjs(), 'month')}
										sx={{ color: '#004680', p: 0.5 }}
									>
										<ArrowForwardIosIcon
											fontSize="small"
											sx={{ fontSize: 14 }}
										/>
									</IconButton>
								</Box>
								<Typography
									variant="caption"
									fontWeight={600}
									color="#64748b"
									sx={{ letterSpacing: '0.5px' }}
								>
									Ordenar por
								</Typography>
								<FormControl size="small" sx={{ minWidth: 140 }}>
									<Select
										value={ordenTiendas.by}
										onChange={(e) =>
											handleOrdenTiendas(e.target.value as SortField)
										}
										variant="outlined"
										size="small"
										sx={{
											bgcolor: '#f8fafc',
											borderRadius: 1.5,
											'& .MuiSelect-select': { py: 0.5, fontSize: '0.8rem' },
										}}
									>
										{OPCIONES_ORDEN.map((opt) => (
											<MenuItem
												key={opt.value}
												value={opt.value}
												sx={{ fontSize: '0.8rem' }}
											>
												{opt.label}
											</MenuItem>
										))}
									</Select>
								</FormControl>
							</Box>
						</Paper>

						{/* Tabla con scroll horizontal para portátil */}
						<TableContainer
							component={Paper}
							elevation={0}
							sx={{
								borderRadius: 3,
								border: '1px solid #e0e0e0',
								overflowX: 'auto',
							}}
						>
							<Table size="medium" sx={{ minWidth: 700 }}>
								<TableHead sx={{ bgcolor: '#f8fafc' }}>
									<TableRow>
										{COLUMNAS_TIENDAS.map((col) => (
											<TableCell
												key={col.label}
												sx={{
													fontWeight: 700,
													color: '#546e7a',
													cursor: col.value ? 'pointer' : 'default',
													userSelect: 'none',
													'&:hover': col.value ? { color: '#004680' } : {},
												}}
												align={col.label === 'ACCIONES' ? 'center' : 'left'}
												onClick={() =>
													col.value &&
													handleOrdenTiendas(col.value as SortField)
												}
											>
												<Box
													sx={{
														display: 'flex',
														alignItems: 'center',
														justifyContent:
															col.label === 'ACCIONES'
																? 'center'
																: 'flex-start',
													}}
												>
													{col.label}
													{ordenTiendas.by === col.value && (
														<Box
															component="span"
															sx={{
																ml: 0.5,
																display: 'flex',
																alignItems: 'center',
															}}
														>
															{ordenTiendas.dir === 'asc' ? (
																<ArrowUpwardIcon
																	sx={{ fontSize: '1rem', color: '#004680' }}
																/>
															) : (
																<ArrowDownwardIcon
																	sx={{ fontSize: '1rem', color: '#004680' }}
																/>
															)}
														</Box>
													)}
												</Box>
											</TableCell>
										))}
									</TableRow>
								</TableHead>
								<TableBody>
									{tiendasPagina.length === 0 ? (
										<TableRow>
											<TableCell
												colSpan={6}
												align="center"
												sx={{ py: 4, color: 'text.secondary' }}
											>
												No hay tiendas disponibles
											</TableCell>
										</TableRow>
									) : (
										tiendasPagina.map((tienda) => (
											<TableRow key={tienda.id} hover>
												<TableCell>
													<Box
														sx={{
															display: 'flex',
															alignItems: 'center',
															gap: 1.5,
														}}
													>
														<StorefrontIcon sx={{ color: '#004680' }} />
														<Typography fontWeight={600} color="#0a1929">
															{tienda.nombre}
														</Typography>
													</Box>
												</TableCell>
												<TableCell align="center">
													<Chip
														size="small"
														label={tienda.totalEmpleados}
														sx={{
															bgcolor: '#e3f2fd',
															color: '#0a1929',
															fontWeight: 700,
														}}
													/>
												</TableCell>
												<TableCell align="center">
													<Chip
														size="small"
														label={tienda.personasRegistradas}
														sx={{
															bgcolor: '#ede7f6',
															color: '#5e35b1',
															fontWeight: 700,
														}}
													/>
												</TableCell>
												<TableCell align="center">
													<Chip
														size="small"
														label={tienda.incompletos}
														sx={{
															bgcolor: '#fff3e0',
															color: '#e65100',
															fontWeight: 700,
														}}
													/>
												</TableCell>
												<TableCell align="center">
													<Chip
														size="small"
														label={tienda.sinRegistro}
														sx={{
															bgcolor: '#fbe9e7',
															color: '#d32f2f',
															fontWeight: 700,
														}}
													/>
												</TableCell>
												<TableCell align="center">
													<Button
														variant="contained"
														size="small"
														startIcon={<VisibilityIcon />}
														onClick={() => setTiendaSeleccionada(tienda.id)}
														sx={{
															bgcolor: '#004680',
															'&:hover': { bgcolor: '#003a6b' },
															textTransform: 'none',
															borderRadius: 2,
														}}
													>
														Ver empleados
													</Button>
												</TableCell>
											</TableRow>
										))
									)}
								</TableBody>
							</Table>
							<Paginador
								count={Math.ceil(tiendasOrdenadas.length / rowsPerPage.tiendas)}
								page={paginaTiendas}
								setPage={setPaginaTiendas}
								label="tiendas"
								total={tiendasOrdenadas.length}
							/>
						</TableContainer>

						<ModalCierreMasivo
							open={cierreMasivoOpen}
							onClose={() => setCierreMasivoOpen(false)}
							tiendas={tiendasFiltradas.map((t) => ({
								id: Number(t.id),
								nombre: t.name,
							}))}
						/>
					</>
				)}

				{subTab === 1 && <MonitoreoOperacionTab tiendas={tiendas} />}

				{subTab === 2 && <MonitoreoFotosTab tiendas={tiendas} />}

				{subTab === 3 && (
					<>
						<Grid container spacing={2} sx={{ mb: 2 }}>
							{TARJETAS_ESTADISTICAS.map((k, idx) => {
								let value = '';
								if (k.label === 'TOTAL MODIFICACIONES')
									value = statsEdiciones.total.toString();
								else if (k.label === 'EMPLEADOS MONITOREADOS')
									value = statsEdiciones.empleados.toString();
								else if (k.label === 'TIENDA CON MÁS CAMBIOS')
									value = statsEdiciones.topStore;
								return (
									<Grid size={{ xs: 12, md: 3 }} key={idx}>
										<TarjetaEstadistica
											{...k}
											value={value}
											color={
												k.label === 'TIENDA CON MÁS CAMBIOS'
													? '#e65100'
													: k.color
											}
											onClick={
												k.label === 'TIENDA CON MÁS CAMBIOS'
													? () => setModalTiendasOpen(true)
													: undefined
											}
											sx={
												k.label === 'TIENDA CON MÁS CAMBIOS'
													? { cursor: 'pointer' }
													: {}
											}
										/>
									</Grid>
								);
							})}
							<Grid size={{ xs: 12, md: 3 }}>
								<TarjetaEstadistica
									icon={PersonIcon}
									label="EMPLEADO CON MÁS EDICIONES"
									value={topEmpleado}
									color="#004680"
									bg="#e3f2fd"
									onClick={() => setModalEmpleadosOpen(true)}
								/>
							</Grid>
						</Grid>

						<Paper
							elevation={0}
							sx={{
								p: 2,
								mb: 2,
								borderRadius: 3,
								border: '1px solid #e0e0e0',
								display: 'flex',
								gap: 2,
								alignItems: 'center',
								flexWrap: 'wrap',
							}}
						>
							<Box sx={{ flexGrow: 0, minWidth: 280 }}>
								<DateRangeFilter
									fechaInicio={fechas.inicio}
									fechaFin={fechas.fin}
									onChange={(inicio, fin) => {
										setFechas({ inicio, fin });
										setPaginaEdiciones(0);
										if (inicio) {
											setRankingMesTiendas(inicio);
											setRankingMes(inicio);
										}
									}}
								/>
							</Box>

							<FormControl
								size="small"
								sx={{
									minWidth: 300,
									'& .MuiOutlinedInput-root': { borderRadius: 2 },
								}}
							>
								<InputLabel id="motivo-multi-label">Motivos</InputLabel>
								<Select
									labelId="motivo-multi-label"
									multiple
									value={motivosSeleccionados}
									onChange={(e) => {
										const value = e.target.value;
										if (Array.isArray(value) && value.includes('limpiar')) {
											setMotivosSeleccionados([]);
											setPaginaEdiciones(0);
											return;
										}
										if (Array.isArray(value) && value.includes('todos'))
											setMotivosSeleccionados(motivosUnicos);
										else
											setMotivosSeleccionados(
												typeof value === 'string' ? value.split(',') : value,
											);
										setPaginaEdiciones(0);
									}}
									input={
										<OutlinedInput
											label="Motivos"
											endAdornment={
												motivosSeleccionados.length > 0 ? (
													<InputAdornment position="end">
														<IconButton
															size="small"
															onClick={(e) => {
																e.stopPropagation();
																e.preventDefault();
																setMotivosSeleccionados([]);
																setPaginaEdiciones(0);
															}}
															onMouseDown={(e) => e.stopPropagation()}
															sx={{ p: 0.5, mr: 0.5 }}
														>
															<CloseIcon
																fontSize="small"
																sx={{ color: '#64748b' }}
															/>
														</IconButton>
													</InputAdornment>
												) : null
											}
										/>
									}
									renderValue={(selected) => (
										<Box
											sx={{
												display: 'grid',
												gridTemplateColumns: 'repeat(3, 1fr)',
												gap: 0.5,
												width: '100%',
												maxHeight: 80,
												overflow: 'auto',
												alignContent: 'flex-start',
											}}
										>
											{selected.length === 0 ? (
												<Typography
													variant="body2"
													color="text.secondary"
													sx={{ fontStyle: 'italic', gridColumn: '1 / -1' }}
												>
													Todos
												</Typography>
											) : (
												selected.map((value) => {
													const colors = getColorForMotivo(value);
													return (
														<Box
															key={value}
															sx={{
																display: 'flex',
																justifyContent: 'space-between',
																alignItems: 'center',
																bgcolor: colors.bg,
																color: colors.text,
																px: 1,
																py: 0.5,
																borderRadius: 1,
																minWidth: 0,
																overflow: 'hidden',
																height: '28px',
																cursor: 'default',
															}}
															onMouseDown={(e) => e.stopPropagation()}
														>
															<Typography
																variant="body2"
																fontWeight={500}
																color={colors.text}
																noWrap
																sx={{ fontSize: '0.75rem', flex: 1 }}
															>
																{value}
															</Typography>
															<Box
																component="span"
																sx={{
																	display: 'flex',
																	alignItems: 'center',
																	justifyContent: 'center',
																	cursor: 'pointer',
																	p: 0.5,
																	borderRadius: '50%',
																	'&:hover': { bgcolor: 'rgba(0,0,0,0.08)' },
																}}
																onClick={(e) => {
																	e.stopPropagation();
																	e.preventDefault();
																	setMotivosSeleccionados(
																		motivosSeleccionados.filter(
																			(item) => item !== value,
																		),
																	);
																	setPaginaEdiciones(0);
																}}
																onMouseDown={(e) => {
																	e.stopPropagation();
																	e.preventDefault();
																}}
															>
																<CloseIcon
																	fontSize="small"
																	sx={{
																		fontSize: '0.9rem',
																		color: colors.text,
																	}}
																/>
															</Box>
														</Box>
													);
												})
											)}
										</Box>
									)}
									MenuProps={{
										PaperProps: {
											style: { maxHeight: 280, width: 280 },
											sx: {
												'& .MuiMenuItem-root.Mui-selected': {
													bgcolor: '#e3f2fd',
													'&:hover': { bgcolor: '#bbdefb' },
												},
												'& .MuiMenuItem-root': {
													borderRadius: 1,
													mx: 0.5,
													my: 0.3,
												},
											},
										},
									}}
									sx={{
										'& .MuiSelect-select': {
											display: 'flex',
											alignItems: 'flex-start',
											minHeight: '40px',
											py: '4px',
										},
										'& .MuiOutlinedInput-notchedOutline': {
											borderColor:
												motivosSeleccionados.length > 0 ? '#004680' : '#d0d7de',
											borderWidth:
												motivosSeleccionados.length > 0 ? '2px' : '1px',
										},
										'&:hover .MuiOutlinedInput-notchedOutline': {
											borderColor: '#004680',
										},
									}}
								>
									<MenuItem
										value="todos"
										sx={{
											fontWeight: 700,
											borderBottom: '1px solid #e0e0e0',
											mb: 0.5,
										}}
									>
										<Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
											<Box
												sx={{
													width: 12,
													height: 12,
													borderRadius: '50%',
													bgcolor: '#e8e8e8',
													border: '1px solid #9e9e9e',
												}}
											/>
											Todos
										</Box>
										{motivosSeleccionados.length === motivosUnicos.length && (
											<CheckCircleIcon
												sx={{ color: '#004680', fontSize: 18 }}
											/>
										)}
									</MenuItem>
									<MenuItem
										value="limpiar"
										sx={{
											fontWeight: 700,
											borderBottom: '1px solid #e0e0e0',
											mb: 0.5,
										}}
									>
										<Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
											<Box
												sx={{
													width: 12,
													height: 12,
													borderRadius: '50%',
													bgcolor: '#ffebee',
													border: '1px solid #c62828',
												}}
											/>
											Limpiar
										</Box>
										{motivosSeleccionados.length === 0 && (
											<CheckCircleIcon
												sx={{ color: '#004680', fontSize: 18 }}
											/>
										)}
									</MenuItem>
									{motivosUnicos.map((motivo) => (
										<MenuItem
											key={motivo}
											value={motivo}
											sx={{
												display: 'flex',
												justifyContent: 'space-between',
												alignItems: 'center',
												gap: 1,
												fontWeight: motivosSeleccionados.includes(motivo)
													? 700
													: 400,
											}}
										>
											<Box
												sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
											>
												<Box
													sx={{
														width: 12,
														height: 12,
														borderRadius: '50%',
														bgcolor: getColorForMotivo(motivo).bg,
														border: `1px solid ${getColorForMotivo(motivo).text}`,
													}}
												/>
												{motivo}
											</Box>
											{motivosSeleccionados.includes(motivo) && (
												<CheckCircleIcon
													sx={{ color: '#004680', fontSize: 18 }}
												/>
											)}
										</MenuItem>
									))}
								</Select>
							</FormControl>

							<TextField
								label="Buscar Empleado"
								placeholder="Nombre del empleado..."
								value={buscarEmpleado}
								onChange={(e) => {
									setBuscarEmpleado(e.target.value);
									setPaginaEdiciones(0);
								}}
								size="small"
								sx={{ flexGrow: 1, minWidth: 200 }}
								slotProps={{
									input: {
										startAdornment: (
											<InputAdornment position="start">
												<SearchIcon
													fontSize="small"
													sx={{ color: '#94a3b8' }}
												/>
											</InputAdornment>
										),
										endAdornment: buscarEmpleado ? (
											<InputAdornment position="end">
												<IconButton
													size="small"
													onClick={() => {
														setBuscarEmpleado('');
														setPaginaEdiciones(0);
													}}
												>
													<CloseIcon fontSize="small" />
												</IconButton>
											</InputAdornment>
										) : null,
									},
								}}
							/>
						</Paper>

						{cargandoEdiciones ? (
							<Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
								<CircularProgress sx={{ color: '#004680' }} />
							</Box>
						) : (
							<TableContainer
								component={Paper}
								elevation={0}
								sx={{ borderRadius: 3, border: '1px solid #e0e0e0' }}
							>
								<Table size="medium">
									<TableHead sx={{ bgcolor: '#f8fafc' }}>
										<TableRow>
											{COLUMNAS_EDICIONES.map((t) => (
												<TableCell
													key={t}
													sx={{ fontWeight: 700, color: '#546e7a' }}
													align={
														[
															'HORA ORIG.',
															'HORA MOD.',
															'OBSERVACIONES',
														].includes(t)
															? 'center'
															: 'left'
													}
												>
													{t}
												</TableCell>
											))}
										</TableRow>
									</TableHead>
									<TableBody>
										{edicionesPagina.length === 0 ? (
											<TableRow>
												<TableCell
													colSpan={8}
													align="center"
													sx={{ py: 4, color: 'text.secondary' }}
												>
													No se encontraron marcaciones modificadas en este
													período
												</TableCell>
											</TableRow>
										) : (
											edicionesPagina.map((r) => (
												<TableRow key={r.id} hover>
													<TableCell>
														<Typography
															variant="body2"
															fontWeight={600}
															color="#0a1929"
														>
															{r.fecha}
														</Typography>
													</TableCell>
													<TableCell>
														<Typography
															variant="body2"
															fontWeight={600}
															color="#0a1929"
														>
															{r.empleadoNombre}
														</Typography>
													</TableCell>
													<TableCell>
														<Box
															sx={{
																display: 'flex',
																alignItems: 'center',
																gap: 1,
															}}
														>
															<StorefrontIcon
																fontSize="small"
																sx={{ color: '#64748b' }}
															/>
															<Typography variant="body2" color="#0a1929">
																{r.tiendaNombre}
															</Typography>
														</Box>
													</TableCell>
													<TableCell>
														<Chip
															size="small"
															label={r.tipoRegistro}
															sx={{
																bgcolor: '#f0f4f8',
																color: '#004680',
																fontWeight: 600,
															}}
														/>
													</TableCell>
													<TableCell align="center">
														<Typography
															variant="body2"
															color="text.secondary"
															sx={{ textDecoration: 'line-through' }}
														>
															{r.horaOriginal
																? r.horaOriginal.substring(0, 5)
																: '--:--'}
														</Typography>
													</TableCell>
													<TableCell align="center">
														<Typography
															variant="body2"
															fontWeight={700}
															color="#c62828"
														>
															{r.horaModificada
																? r.horaModificada.substring(0, 5)
																: '--:--'}
														</Typography>
													</TableCell>
													<TableCell>
														<Chip
															size="small"
															label={r.motivo}
															sx={{
																bgcolor: '#ffebee',
																color: '#c62828',
																fontWeight: 600,
															}}
														/>
													</TableCell>
													<TableCell align="center">
														{r.observaciones &&
														r.observaciones.toLowerCase() !==
															'sin comentarios' ? (
															<Tooltip title="Ver observación completa">
																<IconButton
																	size="small"
																	onClick={() =>
																		setModalObs({
																			open: true,
																			empleado: r.empleadoNombre,
																			fecha: r.fecha,
																			texto: r.observaciones,
																		})
																	}
																	sx={{
																		color: '#004680',
																		bgcolor: '#e3f2fd',
																		'&:hover': { bgcolor: '#bbdefb' },
																		p: 0.5,
																	}}
																>
																	<MessageIcon fontSize="small" />
																</IconButton>
															</Tooltip>
														) : (
															<Typography
																variant="caption"
																color="#94a3b8"
																sx={{ fontStyle: 'italic' }}
															>
																Sin observación
															</Typography>
														)}
													</TableCell>
												</TableRow>
											))
										)}
									</TableBody>
								</Table>
								<Paginador
									count={Math.ceil(
										edicionesFiltradas.length / rowsPerPage.ediciones,
									)}
									page={paginaEdiciones}
									setPage={setPaginaEdiciones}
									label="modificaciones"
									total={edicionesFiltradas.length}
								/>
							</TableContainer>
						)}
					</>
				)}

				{isAreaMgr && subTab === 4 && (
					<Paper
						elevation={0}
						sx={{
							borderRadius: 3,
							border: '1px solid #e0e0e0',
							overflow: 'hidden',
						}}
					>
						<ReporteSemanalAreaManager
							storeId={storeId ?? null}
							storeName={
								storeId
									? tiendas.find((t) => t.id === storeId)?.name
									: undefined
							}
						/>
					</Paper>
				)}

				{isAreaMgr && subTab === 5 && <DetallePlanillaPage storeId={storeId} />}

				{tiendaSeleccionada && (
					<ModalDetalleTienda
						tiendaId={tiendaSeleccionada}
						tiendaNombre={
							tiendas.find((t) => t.id === tiendaSeleccionada)?.name ||
							'Detalle de Tienda'
						}
						onClose={() => setTiendaSeleccionada(null)}
						initialMonth={resumenMes}
					/>
				)}

				{/* Modal Observación */}
				<Dialog
					open={modalObs.open}
					onClose={() => setModalObs((p) => ({ ...p, open: false }))}
					maxWidth="sm"
					fullWidth
					slotProps={{ paper: { sx: { borderRadius: 3 } } }}
				>
					<DialogTitle
						sx={{
							m: 0,
							p: 2.5,
							bgcolor: '#004680',
							color: '#ffffff',
							fontWeight: 700,
							display: 'flex',
							justifyContent: 'space-between',
							alignItems: 'center',
						}}
					>
						<Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
							<AssignmentIcon />
							<Typography variant="h6" fontWeight={700}>
								Detalle de Observación
							</Typography>
						</Box>
						<IconButton
							onClick={() => setModalObs((p) => ({ ...p, open: false }))}
							sx={{ color: '#ffffff' }}
						>
							<CloseIcon />
						</IconButton>
					</DialogTitle>
					<DialogContent sx={{ p: 3 }}>
						<Grid container spacing={2} sx={{ mb: 3, mt: 1 }}>
							<Grid size={{ xs: 6 }}>
								<Typography
									variant="caption"
									color="text.secondary"
									fontWeight={700}
									display="block"
								>
									EMPLEADO
								</Typography>
								<Typography variant="body2" color="#0a1929" fontWeight={600}>
									{modalObs.empleado}
								</Typography>
							</Grid>
							<Grid size={{ xs: 6 }}>
								<Typography
									variant="caption"
									color="text.secondary"
									fontWeight={700}
									display="block"
								>
									FECHA DE REGISTRO
								</Typography>
								<Typography variant="body2" color="#0a1929" fontWeight={600}>
									{modalObs.fecha}
								</Typography>
							</Grid>
						</Grid>
						<Box>
							<Typography
								variant="caption"
								color="text.secondary"
								fontWeight={700}
								display="block"
								sx={{ mb: 1 }}
							>
								OBSERVACIÓN COMPLETA
							</Typography>
							<Paper
								elevation={0}
								sx={{
									p: 2.5,
									bgcolor: '#f1f5f9',
									borderRadius: 2,
									border: '1px solid #e2e8f0',
								}}
							>
								<Typography
									variant="body2"
									color="#334155"
									sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}
								>
									{modalObs.texto}
								</Typography>
							</Paper>
						</Box>
					</DialogContent>
					<DialogActions sx={{ p: 2, px: 3, borderTop: '1px solid #e2e8f0' }}>
						<Button
							onClick={() => setModalObs((p) => ({ ...p, open: false }))}
							variant="contained"
							disableElevation
							sx={{
								bgcolor: '#004680',
								textTransform: 'none',
								fontWeight: 600,
								borderRadius: 2,
								'&:hover': { bgcolor: '#003a6b' },
							}}
						>
							Cerrar
						</Button>
					</DialogActions>
				</Dialog>

				{/* Modal Ranking */}
				<Dialog
					open={modalEmpleadosOpen}
					onClose={() => setModalEmpleadosOpen(false)}
					maxWidth="md"
					fullWidth
					slotProps={{
						paper: {
							sx: {
								borderRadius: 3,
								height: '85vh',
								maxHeight: '85vh',
								display: 'flex',
								flexDirection: 'column',
							},
						},
					}}
				>
					<DialogTitle
						sx={{
							bgcolor: '#004680',
							color: '#ffffff',
							display: 'flex',
							justifyContent: 'space-between',
							alignItems: 'center',
							py: 2,
							px: 3,
							flexShrink: 0,
						}}
					>
						<Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
							<PersonIcon sx={{ fontSize: 28 }} />
							<Typography variant="h6" fontWeight={700}>
								Ranking de Ediciones
							</Typography>
						</Box>
						<IconButton
							onClick={() => setModalEmpleadosOpen(false)}
							sx={{ color: '#ffffff' }}
						>
							<CloseIcon />
						</IconButton>
					</DialogTitle>
					<DialogContent
						sx={{
							p: 0,
							display: 'flex',
							flexDirection: 'column',
							flex: 1,
							minHeight: 0,
							overflow: 'hidden',
						}}
					>
						<Box
							sx={{
								display: 'flex',
								flexDirection: 'column',
								gap: 3,
								px: 3,
								pt: 4,
								pb: 3,
								flexShrink: 0,
							}}
						>
							<Box
								sx={{
									display: 'flex',
									gap: 2,
									alignItems: 'center',
									flexWrap: 'wrap',
								}}
							>
								<TextField
									label="Buscar empleado"
									placeholder="Escribe el nombre del empleado..."
									value={buscarEmpleadoRanking}
									onChange={(e) => {
										setBuscarEmpleadoRanking(e.target.value);
										setPaginaRanking(0);
									}}
									size="small"
									sx={{ flex: 1, minWidth: 220 }}
									slotProps={{
										input: {
											startAdornment: (
												<InputAdornment position="start">
													<SearchIcon
														fontSize="small"
														sx={{ color: '#94a3b8' }}
													/>
												</InputAdornment>
											),
											endAdornment: buscarEmpleadoRanking ? (
												<InputAdornment position="end">
													<IconButton
														size="small"
														onClick={() => {
															setBuscarEmpleadoRanking('');
															setPaginaRanking(0);
														}}
													>
														<CloseIcon fontSize="small" />
													</IconButton>
												</InputAdornment>
											) : null,
										},
									}}
								/>
								<Chip
									label={`${rankingFiltrado.length} empleados`}
									size="small"
									sx={{ bgcolor: '#e3f2fd', color: '#004680', fontWeight: 600 }}
								/>
								<Tooltip
									title={
										ordenEdiciones === 'desc'
											? 'Ordenar de menor a mayor'
											: 'Ordenar de mayor a menor'
									}
								>
									<Button
										variant="outlined"
										size="small"
										onClick={() => {
											setOrdenEdiciones((p) => (p === 'asc' ? 'desc' : 'asc'));
											setPaginaRanking(0);
										}}
										sx={{
											textTransform: 'none',
											borderColor: '#004680',
											color: '#004680',
											borderRadius: 2,
											fontWeight: 600,
											'&:hover': { bgcolor: '#e3f2fd', borderColor: '#004680' },
											display: 'flex',
											alignItems: 'center',
											gap: 0.5,
										}}
									>
										<SortIcon fontSize="small" />
										{ordenEdiciones === 'desc'
											? 'Mayor a menor'
											: 'Menor a mayor'}
										{ordenEdiciones === 'desc' ? (
											<ArrowDownwardIcon fontSize="small" />
										) : (
											<ArrowUpwardIcon fontSize="small" />
										)}
									</Button>
								</Tooltip>
							</Box>
							<Box
								sx={{
									display: 'flex',
									gap: 2,
									flexWrap: 'wrap',
									alignItems: 'center',
								}}
							>
								<Box
									sx={{
										display: 'flex',
										alignItems: 'center',
										minWidth: 240,
										border: '1px solid #d0d7de',
										borderRadius: 2,
										px: 2,
										py: 0.5,
										bgcolor: '#ffffff',
										minHeight: 40,
									}}
								>
									<CalendarTodayIcon
										sx={{ color: '#004680', fontSize: 18, mr: 1 }}
									/>
									<Typography
										variant="body2"
										fontWeight={600}
										color="#004680"
										sx={{ textTransform: 'capitalize', flexGrow: 1 }}
									>
										{rankingMes.format('MMMM YYYY')}
									</Typography>
									<Box sx={{ display: 'flex', gap: 0.5 }}>
										<IconButton
											size="small"
											onClick={() =>
												handleCambiarMesRanking(rankingMes.subtract(1, 'month'))
											}
											sx={{ color: '#004680', p: 0.5 }}
										>
											<ArrowBackIosIcon
												fontSize="small"
												sx={{ fontSize: 14 }}
											/>
										</IconButton>
										<IconButton
											size="small"
											onClick={() =>
												handleCambiarMesRanking(rankingMes.add(1, 'month'))
											}
											disabled={rankingMes.isSame(dayjs(), 'month')}
											sx={{ color: '#004680', p: 0.5 }}
										>
											<ArrowForwardIosIcon
												fontSize="small"
												sx={{ fontSize: 14 }}
											/>
										</IconButton>
									</Box>
								</Box>
								<FormControl
									size="small"
									sx={{
										minWidth: 320,
										flex: 1,
										'& .MuiOutlinedInput-notchedOutline': {
											borderColor:
												rankingMotivos.length > 0 ? '#004680' : '#d0d7de',
											borderWidth: rankingMotivos.length > 0 ? '2px' : '1px',
										},
										'&:hover .MuiOutlinedInput-notchedOutline': {
											borderColor: '#004680',
										},
									}}
								>
									<InputLabel id="ranking-motivos-label">
										Filtrar por Motivos
									</InputLabel>
									<Select
										labelId="ranking-motivos-label"
										multiple
										value={rankingMotivos}
										onChange={(e) => {
											const value = e.target.value;
											if (Array.isArray(value) && value.includes('limpiar')) {
												setRankingMotivos([]);
												setPaginaRanking(0);
												return;
											}
											if (Array.isArray(value) && value.includes('todos'))
												setRankingMotivos(motivosUnicos);
											else
												setRankingMotivos(
													typeof value === 'string' ? value.split(',') : value,
												);
											setPaginaRanking(0);
										}}
										input={
											<OutlinedInput
												label="Filtrar por Motivos"
												endAdornment={
													rankingMotivos.length > 0 ? (
														<InputAdornment position="end">
															<IconButton
																size="small"
																onClick={(e) => {
																	e.stopPropagation();
																	e.preventDefault();
																	setRankingMotivos([]);
																	setPaginaRanking(0);
																}}
																onMouseDown={(e) => e.stopPropagation()}
																sx={{ p: 0.5, mr: 0.5 }}
															>
																<CloseIcon
																	fontSize="small"
																	sx={{ color: '#64748b' }}
																/>
															</IconButton>
														</InputAdornment>
													) : null
												}
												sx={{ borderRadius: 2 }}
											/>
										}
										renderValue={(selected) => (
											<Box
												sx={{
													display: 'flex',
													flexWrap: 'wrap',
													gap: 0.5,
													maxHeight: 60,
													overflow: 'auto',
												}}
											>
												{selected.length === 0 ? (
													<Typography
														variant="body2"
														color="text.secondary"
														sx={{ fontStyle: 'italic' }}
													>
														Todos los motivos
													</Typography>
												) : (
													selected.map((value) => {
														const colors = getColorForMotivo(value);
														return (
															<Box
																key={value}
																sx={{
																	display: 'flex',
																	alignItems: 'center',
																	gap: 0.5,
																	bgcolor: colors.bg,
																	color: colors.text,
																	pl: 1,
																	pr: 0.5,
																	py: 0.25,
																	borderRadius: 1,
																	height: '22px',
																	cursor: 'default',
																}}
																onMouseDown={(e) => e.stopPropagation()}
															>
																<Typography
																	variant="caption"
																	fontWeight={600}
																	sx={{ fontSize: '0.7rem' }}
																>
																	{value}
																</Typography>
																<Box
																	component="span"
																	sx={{
																		display: 'flex',
																		alignItems: 'center',
																		justifyContent: 'center',
																		cursor: 'pointer',
																		borderRadius: '50%',
																		'&:hover': { bgcolor: 'rgba(0,0,0,0.12)' },
																	}}
																	onClick={(e) => {
																		e.stopPropagation();
																		e.preventDefault();
																		setRankingMotivos(
																			rankingMotivos.filter(
																				(item) => item !== value,
																			),
																		);
																		setPaginaRanking(0);
																	}}
																	onMouseDown={(e) => {
																		e.stopPropagation();
																		e.preventDefault();
																	}}
																>
																	<CloseIcon
																		sx={{
																			fontSize: '0.85rem',
																			color: colors.text,
																		}}
																	/>
																</Box>
															</Box>
														);
													})
												)}
											</Box>
										)}
										MenuProps={{
											PaperProps: {
												style: { maxHeight: 280, width: 280 },
												sx: {
													'& .MuiMenuItem-root.Mui-selected': {
														bgcolor: '#e3f2fd',
														'&:hover': { bgcolor: '#bbdefb' },
													},
													'& .MuiMenuItem-root': {
														borderRadius: 1,
														mx: 0.5,
														my: 0.3,
													},
												},
											},
										}}
									>
										<MenuItem
											value="todos"
											sx={{
												fontWeight: 700,
												borderBottom: '1px solid #e0e0e0',
												mb: 0.5,
											}}
										>
											<Box
												sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
											>
												<Box
													sx={{
														width: 12,
														height: 12,
														borderRadius: '50%',
														bgcolor: '#e8e8e8',
														border: '1px solid #9e9e9e',
													}}
												/>
												Todos
											</Box>
											{rankingMotivos.length === motivosUnicos.length && (
												<CheckCircleIcon
													sx={{ color: '#004680', fontSize: 18 }}
												/>
											)}
										</MenuItem>
										<MenuItem
											value="limpiar"
											sx={{
												fontWeight: 700,
												borderBottom: '1px solid #e0e0e0',
												mb: 0.5,
											}}
										>
											<Box
												sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
											>
												<Box
													sx={{
														width: 12,
														height: 12,
														borderRadius: '50%',
														bgcolor: '#ffebee',
														border: '1px solid #c62828',
													}}
												/>
												Limpiar
											</Box>
											{rankingMotivos.length === 0 && (
												<CheckCircleIcon
													sx={{ color: '#004680', fontSize: 18 }}
												/>
											)}
										</MenuItem>
										{motivosUnicos.map((motivo) => (
											<MenuItem
												key={motivo}
												value={motivo}
												sx={{
													display: 'flex',
													justifyContent: 'space-between',
													alignItems: 'center',
													gap: 1,
													fontWeight: rankingMotivos.includes(motivo)
														? 700
														: 400,
												}}
											>
												<Box
													sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
												>
													<Box
														sx={{
															width: 12,
															height: 12,
															borderRadius: '50%',
															bgcolor: getColorForMotivo(motivo).bg,
															border: `1px solid ${getColorForMotivo(motivo).text}`,
														}}
													/>
													{motivo}
												</Box>
												{rankingMotivos.includes(motivo) && (
													<CheckCircleIcon
														sx={{ color: '#004680', fontSize: 18 }}
													/>
												)}
											</MenuItem>
										))}
									</Select>
								</FormControl>
							</Box>
						</Box>
						<Box
							sx={{
								flex: 1,
								minHeight: 0,
								overflow: 'auto',
								border: '1px solid #e0e0e0',
								borderRadius: 3,
								mx: 3,
							}}
						>
							<List disablePadding>
								{(() => {
									const start = paginaRanking * rowsPerPage.ranking;
									const pagina = rankingFiltrado.slice(
										start,
										start + rowsPerPage.ranking,
									);
									if (!pagina.length)
										return (
											<Box
												sx={{
													p: 4,
													textAlign: 'center',
													color: 'text.secondary',
												}}
											>
												{buscarEmpleadoRanking
													? 'No se encontraron empleados'
													: 'No hay ediciones registradas'}
											</Box>
										);
									return pagina.map((emp) => (
										<ListItem
											key={emp.id}
											divider
											sx={{ py: 2, px: 3, '&:hover': { bgcolor: '#f5f7fa' } }}
											secondaryAction={
												<>
													<Tooltip title="Ver registros">
														<IconButton
															edge="end"
															onClick={() => {
																setBuscarEmpleado(emp.nombre);
																setPaginaEdiciones(0);
																setModalEmpleadosOpen(false);
																setSubTab(1);
															}}
															sx={{ color: '#004680', mr: 1 }}
														>
															<VisibilityIcon />
														</IconButton>
													</Tooltip>
													<Tooltip title="Ver calendario">
														<IconButton
															edge="end"
															onClick={() => handleAbrirCalendario(emp.id)}
															sx={{ color: '#004680' }}
														>
															<CalendarTodayIcon />
														</IconButton>
													</Tooltip>
												</>
											}
										>
											<ListItemAvatar>
												<Avatar
													sx={{
														bgcolor: '#004680',
														color: '#fff',
														width: 44,
														height: 44,
													}}
												>
													{emp.nombre.charAt(0).toUpperCase()}
												</Avatar>
											</ListItemAvatar>
											<ListItemText
												primary={
													<Typography
														variant="body1"
														fontWeight={600}
														color="#0a1929"
													>
														{emp.nombre}
													</Typography>
												}
												secondaryTypographyProps={{ component: 'div' }}
												secondary={
													<Box
														sx={{
															display: 'flex',
															alignItems: 'center',
															gap: 2,
															mt: 0.5,
														}}
													>
														<Chip
															size="small"
															label={emp.tienda}
															sx={{
																bgcolor: '#e8eaf6',
																color: '#1a237e',
																fontWeight: 500,
																fontSize: '0.7rem',
															}}
														/>
														<Chip
															size="small"
															label={`${emp.total} edición${emp.total !== 1 ? 'es' : ''}`}
															sx={{
																bgcolor: '#e1f5fe',
																color: '#0288d1',
																fontWeight: 600,
																fontSize: '0.7rem',
															}}
														/>
													</Box>
												}
											/>
										</ListItem>
									));
								})()}
							</List>
						</Box>
						<Box
							sx={{
								flexShrink: 0,
								bgcolor: 'white',
								borderTop: '1px solid #e0e0e0',
								mt: 2,
							}}
						>
							<Paginador
								count={Math.ceil(rankingFiltrado.length / rowsPerPage.ranking)}
								page={paginaRanking}
								setPage={setPaginaRanking}
								label="registros"
								total={rankingFiltrado.length}
							/>
						</Box>
					</DialogContent>
					<DialogActions
						sx={{ p: 2, px: 3, borderTop: '1px solid #e2e8f0', flexShrink: 0 }}
					>
						<Button
							onClick={() => setModalEmpleadosOpen(false)}
							variant="contained"
							disableElevation
							sx={{
								bgcolor: '#004680',
								textTransform: 'none',
								fontWeight: 600,
								borderRadius: 2,
								'&:hover': { bgcolor: '#003366' },
							}}
						>
							Cerrar
						</Button>
					</DialogActions>
				</Dialog>

				{/* Modal Ranking Tiendas */}
				<ModalRankingTiendas
					open={modalTiendasOpen}
					onClose={handleCloseModalTiendas}
					editedRecords={editedRecords}
					rankingMesTiendas={rankingMesTiendas}
					setRankingMesTiendas={setRankingMesTiendas}
				/>

				{/* Modal Calendario */}
				<Dialog
					open={calendario.open}
					onClose={handleCerrarCalendario}
					maxWidth="lg"
					fullWidth
					slotProps={{ paper: { sx: { borderRadius: 3, maxHeight: '85vh' } } }}
				>
					<DialogTitle
						sx={{
							bgcolor: '#004680',
							color: '#ffffff',
							display: 'flex',
							justifyContent: 'space-between',
							alignItems: 'center',
							py: 1.5,
							px: 3,
						}}
					>
						<Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
							<Avatar
								sx={{
									bgcolor: '#ffffff',
									color: '#004680',
									width: 36,
									height: 36,
								}}
							>
								{edicionesPorEmpleado.length
									? edicionesPorEmpleado[0].empleadoNombre
											.charAt(0)
											.toUpperCase()
									: '?'}
							</Avatar>
							<Box>
								<Typography
									variant="h6"
									fontWeight={700}
									sx={{ fontSize: '1.1rem' }}
								>
									{edicionesPorEmpleado.length
										? edicionesPorEmpleado[0].empleadoNombre
										: 'Empleado'}
								</Typography>
								<Typography variant="caption" sx={{ opacity: 0.8 }}>
									Histórial total: {edicionesPorEmpleado.length} ediciones en{' '}
									{diasConEdiciones.size} días
								</Typography>
							</Box>
						</Box>
						<IconButton
							onClick={handleCerrarCalendario}
							sx={{ color: '#ffffff' }}
						>
							<CloseIcon />
						</IconButton>
					</DialogTitle>
					<DialogContent sx={{ p: 2, bgcolor: '#f5f7fa' }}>
						{cargandoCalendario ? (
							<Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
								<CircularProgress sx={{ color: '#004680' }} />
							</Box>
						) : (
							<>
								<Paper
									elevation={0}
									sx={{
										p: 1,
										mb: 2,
										borderRadius: 3,
										bgcolor: '#ffffff',
										border: '1px solid #e0e0e0',
										display: 'flex',
										flexWrap: 'wrap',
										gap: 2,
										alignItems: 'center',
									}}
								>
									<Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
										<EditNoteIcon sx={{ color: '#004680', fontSize: 16 }} />
										<Typography variant="body2" fontWeight={700}>
											Ediciones en {calendario.mes.format('MMMM YYYY')}:{' '}
											<span style={{ color: '#004680' }}>
												{edicionesDelMes.length}
											</span>
										</Typography>
									</Box>
									<Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
										<CalendarTodayIcon
											sx={{ color: '#004680', fontSize: 16 }}
										/>
										<Typography variant="body2" fontWeight={600}>
											Días:{' '}
											<span style={{ color: '#004680' }}>
												{diasConEdicionesMes.size}
											</span>
										</Typography>
									</Box>
									<Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
										<Typography variant="body2" fontWeight={600}>
											Promedio:{' '}
											<span style={{ color: '#004680' }}>
												{promedioEdicionesMes.toFixed(1)}
											</span>
										</Typography>
									</Box>
								</Paper>

								<Paper
									elevation={2}
									sx={{
										p: 2,
										borderRadius: 4,
										bgcolor: '#ffffff',
										border: '1px solid #e0e0e0',
									}}
								>
									<Box
										sx={{
											display: 'flex',
											alignItems: 'center',
											justifyContent: 'space-between',
											mb: 2,
										}}
									>
										<Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
											<CalendarTodayIcon
												sx={{ color: '#004680', fontSize: 22 }}
											/>
											<Typography variant="h6" fontWeight={700} color="#0a1929">
												{calendario.mes.format('MMMM YYYY')}
											</Typography>
										</Box>
										<Box sx={{ display: 'flex', gap: 1 }}>
											<Button
												size="small"
												startIcon={<TodayIcon />}
												onClick={() => {
													const hoy = dayjs();
													setCalendario((p) => ({ ...p, mes: hoy }));
													if (calendario.empleadoId)
														cargarRegistrosCalendario(
															calendario.empleadoId,
															hoy,
														);
												}}
												sx={{
													textTransform: 'none',
													borderRadius: 2,
													borderColor: '#004680',
													color: '#004680',
													fontSize: '0.75rem',
													py: 0.5,
												}}
												variant="outlined"
											>
												Hoy
											</Button>
											<IconButton
												size="small"
												onClick={() => {
													const nuevoMes = calendario.mes.subtract(1, 'month');
													handleCambiarMesCalendario(nuevoMes);
												}}
												sx={{ color: '#004680' }}
											>
												<ArrowBackIosIcon fontSize="small" />
											</IconButton>
											<IconButton
												size="small"
												onClick={() => {
													const nuevoMes = calendario.mes.add(1, 'month');
													handleCambiarMesCalendario(nuevoMes);
												}}
												sx={{ color: '#004680' }}
												disabled={calendario.mes.isSame(dayjs(), 'month')}
											>
												<ArrowForwardIosIcon fontSize="small" />
											</IconButton>
										</Box>
									</Box>
									<Box
										sx={{
											display: 'grid',
											gridTemplateColumns: 'repeat(7,1fr)',
											gap: '4px',
											mb: 1,
										}}
									>
										{['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map(
											(d) => (
												<Typography
													key={d}
													align="center"
													variant="caption"
													fontWeight={700}
													color="primary.main"
													sx={{ py: 0.5 }}
												>
													{d}
												</Typography>
											),
										)}
									</Box>
									<Box
										sx={{
											display: 'grid',
											gridTemplateColumns: 'repeat(7,1fr)',
											gap: '4px',
										}}
									>
										{Array.from(
											{
												length: (calendario.mes.startOf('month').day() + 6) % 7,
											},
											(_, i) => (
												<Box key={`empty-${i}`} />
											),
										)}
										{Array.from(
											{ length: calendario.mes.daysInMonth() },
											(_, i) => {
												const day = calendario.mes.date(i + 1);
												const fecha = day.format('YYYY-MM-DD');
												const count = conteoPorDia[fecha] || 0;
												const isSelected = calendario.dia === fecha;
												const isToday = day.isSame(dayjs(), 'day');
												const esFuturo = day.isAfter(dayjs(), 'day');
												const isEdited = count > 0 && !esFuturo;
												return (
													<Tooltip
														key={fecha}
														title={
															isEdited
																? `${count} edición(es)`
																: 'Sin ediciones'
														}
														arrow
													>
														<Paper
															elevation={isEdited ? 2 : 0}
															sx={{
																p: 1,
																display: 'flex',
																flexDirection: 'column',
																alignItems: 'center',
																justifyContent: 'center',
																borderRadius: 2,
																bgcolor: isSelected
																	? '#004680'
																	: isEdited
																		? '#e3f2fd'
																		: 'transparent',
																color: isSelected
																	? '#ffffff'
																	: esFuturo
																		? '#bdbdbd'
																		: '#0a1929',
																border: isToday
																	? '2px solid #004680'
																	: isEdited
																		? '1px solid #004680'
																		: '1px solid #e0e0e0',
																cursor: isEdited ? 'pointer' : 'default',
																minHeight: 48,
																transition: 'all 0.15s ease',
																'&:hover': {
																	transform: isEdited ? 'scale(1.02)' : 'none',
																	boxShadow: isEdited ? 2 : 0,
																},
															}}
															onClick={() =>
																isEdited &&
																setCalendario((p) => ({ ...p, dia: fecha }))
															}
														>
															<Typography
																variant="body2"
																fontWeight={
																	isSelected || isEdited || isToday ? 700 : 400
																}
																sx={{ fontSize: '0.9rem' }}
															>
																{day.date()}
															</Typography>
															{isEdited && (
																<Chip
																	size="small"
																	label={count}
																	sx={{
																		mt: 0.25,
																		bgcolor: isSelected
																			? 'rgba(255,255,255,0.3)'
																			: '#004680',
																		color: '#ffffff',
																		fontWeight: 700,
																		fontSize: '0.6rem',
																		height: 18,
																		minWidth: 20,
																	}}
																/>
															)}
															{isToday && !isSelected && (
																<Box
																	sx={{
																		position: 'absolute',
																		top: 2,
																		right: 2,
																		width: 6,
																		height: 6,
																		borderRadius: '50%',
																		bgcolor: '#004680',
																	}}
																/>
															)}
														</Paper>
													</Tooltip>
												);
											},
										)}
									</Box>
								</Paper>

								{calendario.dia && (
									<Box sx={{ mt: 2 }}>
										<Paper
											elevation={0}
											sx={{
												p: 1.5,
												borderRadius: 3,
												border: '1px solid #e0e0e0',
												bgcolor: '#ffffff',
											}}
										>
											<Typography
												variant="subtitle2"
												fontWeight={700}
												color="#004680"
												gutterBottom
											>
												Ediciones del{' '}
												{dayjs(calendario.dia).format(
													'dddd, D [de] MMMM [de] YYYY',
												)}
												<Chip
													size="small"
													label={`${edicionesDelDia.length} registros`}
													sx={{
														ml: 1,
														bgcolor: '#e3f2fd',
														color: '#004680',
														fontWeight: 600,
														fontSize: '0.7rem',
													}}
												/>
											</Typography>
											{edicionesDelDia.length ? (
												<TableContainer
													component={Paper}
													elevation={0}
													sx={{
														border: '1px solid #e0e0e0',
														borderRadius: 2,
														mt: 1,
													}}
												>
													<Table size="small">
														<TableHead sx={{ bgcolor: '#f8fafc' }}>
															<TableRow>
																{[
																	'Registro',
																	'Hora Original',
																	'Hora Modificada',
																	'Motivo',
																	'Observación',
																].map((h) => (
																	<TableCell
																		key={h}
																		sx={{
																			fontWeight: 700,
																			color: '#546e7a',
																			fontSize: '0.75rem',
																		}}
																	>
																		{h}
																	</TableCell>
																))}
															</TableRow>
														</TableHead>
														<TableBody>
															{edicionesDelDia.map((r) => (
																<TableRow key={r.id} hover>
																	<TableCell sx={{ fontSize: '0.75rem' }}>
																		{r.tipoRegistro}
																	</TableCell>
																	<TableCell sx={{ fontSize: '0.75rem' }}>
																		<Typography
																			variant="body2"
																			color="text.secondary"
																			sx={{
																				textDecoration: 'line-through',
																				fontSize: '0.75rem',
																			}}
																		>
																			{r.horaOriginal
																				? r.horaOriginal.substring(0, 5)
																				: '--:--'}
																		</Typography>
																	</TableCell>
																	<TableCell sx={{ fontSize: '0.75rem' }}>
																		<Typography
																			variant="body2"
																			fontWeight={700}
																			color="#c62828"
																			sx={{ fontSize: '0.75rem' }}
																		>
																			{r.horaModificada
																				? r.horaModificada.substring(0, 5)
																				: '--:--'}
																		</Typography>
																	</TableCell>
																	<TableCell sx={{ fontSize: '0.75rem' }}>
																		<Chip
																			size="small"
																			label={r.motivo}
																			sx={{
																				bgcolor: '#ffebee',
																				color: '#c62828',
																				fontWeight: 600,
																				fontSize: '0.6rem',
																			}}
																		/>
																	</TableCell>
																	<TableCell sx={{ fontSize: '0.75rem' }}>
																		{r.observaciones &&
																		r.observaciones.toLowerCase() !==
																			'sin comentarios' ? (
																			<Tooltip title={r.observaciones}>
																				<IconButton
																					size="small"
																					sx={{ color: '#004680', p: 0.2 }}
																				>
																					<MessageIcon fontSize="small" />
																				</IconButton>
																			</Tooltip>
																		) : (
																			<Typography
																				variant="caption"
																				color="#94a3b8"
																				fontStyle="italic"
																				sx={{ fontSize: '0.65rem' }}
																			>
																				Sin obs.
																			</Typography>
																		)}
																	</TableCell>
																</TableRow>
															))}
														</TableBody>
													</Table>
												</TableContainer>
											) : (
												<Typography
													variant="body2"
													color="text.secondary"
													sx={{ textAlign: 'center', py: 1 }}
												>
													No hay ediciones para este día.
												</Typography>
											)}
										</Paper>
									</Box>
								)}
							</>
						)}
					</DialogContent>
					<DialogActions sx={{ p: 1.5, px: 3, borderTop: '1px solid #e2e8f0' }}>
						<Button
							onClick={handleCerrarCalendario}
							variant="contained"
							disableElevation
							sx={{
								bgcolor: '#004680',
								textTransform: 'none',
								fontWeight: 600,
								borderRadius: 2,
								'&:hover': { bgcolor: '#003366' },
							}}
						>
							Cerrar
						</Button>
					</DialogActions>
				</Dialog>
			</Container>
		</Box>
	);
}
