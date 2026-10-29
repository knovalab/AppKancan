import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import {
	Alert,
	Box,
	Chip,
	FormControl,
	IconButton,
	InputLabel,
	MenuItem,
	Paper,
	Select,
	Table,
	TableBody,
	TableCell,
	TableContainer,
	TableHead,
	TableRow,
	Tooltip,
	Typography,
} from '@mui/material';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { useQuery } from '@tanstack/react-query';
import dayjs, { type Dayjs } from 'dayjs';
import 'dayjs/locale/es';
import { useMemo, useState } from 'react';
import { getTimeRecordsBulkRange } from '../../api/directus/readBulk';
import { ReporteTiendasPagination } from '../../components/com_time_record_store';
import { BuscarEmpleado } from '../../components/horas-extras/BuscarEmpleado';
import {
	FiltrosZonaTienda,
	useFiltroZonaTienda,
} from '../../components/horas-extras/FiltrosZonaTienda';
import { formatoMinutos } from '../../domain/horasExtras';
import { useHorariosLayout } from '../../hooks/useHorariosLayout';
import { mensajeDeError } from '../../utils/errores';
import { coincideEmpleado } from '../../utils/horasExtras';
import {
	diasDeSemana,
	inicioSemana,
	resumenSemanal,
} from '../../utils/resumenSemanal';
import { DIAS_DE_LA_SEMANA } from '../reporte/ReporteUtils';

const head = { fontWeight: 700, color: '#334155', bgcolor: '#f1f5f9' };
const horas = (m: number) => (m ? formatoMinutos(m) : '--');
const nombreDia = (d: number) =>
	DIAS_DE_LA_SEMANA.find((x) => x.value === d)?.label ?? '';

/**
 * Sub‑pestaña "Resumen semanal" (/horarios/horas-extras/resumen-semanal) de nómina y comercial:
 * horas trabajadas por persona y día de la semana elegida, de apoyo para ver cómo va cada quien.
 * Inicio y fin de semana se eligen como en el reporte semanal de Monitoreo (mismo día = 7 días).
 */
export default function ResumenSemanalPage() {
	const { acceso } = useHorariosLayout();
	const filtroZT = useFiltroZonaTienda();
	const { tiendas } = filtroZT;
	const [diaInicio, setDiaInicio] = useState(1);
	const [diaFin, setDiaFin] = useState(0);
	// Cualquier día de la semana elegida: el inicio se recalcula si cambia el día de inicio.
	const [fecha, setFecha] = useState(() => dayjs());
	const [busqueda, setBusqueda] = useState('');
	const [page, setPage] = useState(0);
	const [rowsPerPage, setRowsPerPage] = useState(10);

	const inicio = inicioSemana(fecha, diaInicio);
	const totalDias = diasDeSemana(diaInicio, diaFin);
	const fin = inicio.add(totalDias - 1, 'day');
	const desde = inicio.format('YYYY-MM-DD');
	const hasta = fin.format('YYYY-MM-DD');
	const esEstaSemana = inicio.isSame(inicioSemana(dayjs(), diaInicio), 'day');
	const fechas = Array.from({ length: totalDias }, (_, i) =>
		inicio.add(i, 'day'),
	);

	const marcacionesQ = useQuery({
		queryKey: ['resumenSemanal', tiendas, desde, hasta],
		queryFn: () => getTimeRecordsBulkRange(tiendas, desde, hasta),
		enabled: tiendas.length > 0,
		staleTime: 5 * 60 * 1000,
	});

	const filas = useMemo(
		() =>
			resumenSemanal(marcacionesQ.data ?? [], desde, totalDias).filter((f) =>
				coincideEmpleado(f, busqueda),
			),
		[marcacionesQ.data, desde, totalDias, busqueda],
	);
	const nombreTienda = useMemo(
		() => new Map(acceso.tiendasPermitidas.map((t) => [Number(t.id), t.name])),
		[acceso.tiendasPermitidas],
	);

	const totalTrabajados = filas.reduce((s, f) => s + f.trabajados, 0);
	const totalPages = Math.max(1, Math.ceil(filas.length / rowsPerPage));
	const actual = Math.min(page, totalPages - 1);
	const pagina = filas.slice(actual * rowsPerPage, (actual + 1) * rowsPerPage);
	const cargando = marcacionesQ.isLoading;
	const { error } = marcacionesQ;

	const irASemana = (f: Dayjs) => {
		setFecha(f);
		setPage(0);
	};

	return (
		<Paper
			elevation={0}
			sx={{ p: 2, borderRadius: 3, border: '1px solid #e0e0e0' }}
		>
			<Box sx={{ mb: 2 }}>
				<Typography variant="h6" sx={{ fontWeight: 700, color: '#004680' }}>
					Resumen semanal
				</Typography>
				<Typography variant="body2" sx={{ color: '#64748b' }}>
					{filas.length} persona{filas.length !== 1 ? 's' : ''} ·{' '}
					{formatoMinutos(totalTrabajados)} trabajadas del{' '}
					{inicio.format('DD/MM')} al {fin.format('DD/MM/YYYY')}
				</Typography>
			</Box>

			<Box
				sx={{
					display: 'flex',
					flexWrap: 'wrap',
					alignItems: 'center',
					gap: 1.5,
					mb: 2,
				}}
			>
				<BuscarEmpleado
					value={busqueda}
					onChange={(t) => {
						setBusqueda(t);
						setPage(0);
					}}
				/>
				<FiltrosZonaTienda filtro={filtroZT} onCambio={() => setPage(0)} />
				<Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
					<Tooltip title="Semana anterior">
						<IconButton
							aria-label="Semana anterior"
							onClick={() => irASemana(fecha.subtract(7, 'day'))}
						>
							<ChevronLeftIcon />
						</IconButton>
					</Tooltip>
					<LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="es">
						<DatePicker
							label="Semana del"
							value={inicio}
							maxDate={dayjs()}
							format="DD/MM/YYYY"
							onChange={(v) => v && dayjs(v).isValid() && irASemana(dayjs(v))}
							slotProps={{ textField: { size: 'small', sx: { width: 180 } } }}
						/>
					</LocalizationProvider>
					<Tooltip title="Semana siguiente">
						<span>
							<IconButton
								aria-label="Semana siguiente"
								disabled={esEstaSemana}
								onClick={() => irASemana(fecha.add(7, 'day'))}
							>
								<ChevronRightIcon />
							</IconButton>
						</span>
					</Tooltip>
				</Box>
			</Box>

			<Box
				sx={{
					display: 'flex',
					flexWrap: 'wrap',
					alignItems: 'center',
					gap: 1.5,
					mb: 2,
					pt: 1.5,
					borderTop: '1px dashed #cbd5e1',
				}}
			>
				<Typography
					variant="caption"
					sx={{
						fontWeight: 700,
						color: '#64748b',
						textTransform: 'uppercase',
						letterSpacing: 0.5,
					}}
				>
					Estructura semana:
				</Typography>
				<FormControl size="small" sx={{ width: 130 }}>
					<InputLabel id="rs-inicio">Inicio</InputLabel>
					<Select
						labelId="rs-inicio"
						label="Inicio"
						value={diaInicio}
						onChange={(e) => {
							setDiaInicio(Number(e.target.value));
							setPage(0);
						}}
					>
						{DIAS_DE_LA_SEMANA.map((d) => (
							<MenuItem key={d.value} value={d.value}>
								{d.label}
							</MenuItem>
						))}
					</Select>
				</FormControl>
				<FormControl size="small" sx={{ width: 130 }}>
					<InputLabel id="rs-fin">Fin</InputLabel>
					<Select
						labelId="rs-fin"
						label="Fin"
						value={diaFin}
						onChange={(e) => {
							setDiaFin(Number(e.target.value));
							setPage(0);
						}}
					>
						{DIAS_DE_LA_SEMANA.map((d) => (
							<MenuItem key={d.value} value={d.value}>
								{d.label}
							</MenuItem>
						))}
					</Select>
				</FormControl>
				<Chip
					icon={
						<InfoOutlinedIcon
							sx={{
								fontSize: '0.95rem !important',
								color: '#0284c7 !important',
							}}
						/>
					}
					label={`${nombreDia(inicio.day())} a ${nombreDia(fin.day())} (${totalDias} días)`}
					size="small"
					sx={{
						bgcolor: '#e0f2fe',
						color: '#0369a1',
						fontWeight: 600,
						borderRadius: 2,
						height: 32,
						fontSize: '0.78rem',
						border: '1px solid #bae6fd',
					}}
				/>
			</Box>

			{error && (
				<Alert severity="error" sx={{ mb: 2 }}>
					{mensajeDeError(error, 'Error al cargar el resumen semanal')}
				</Alert>
			)}

			<TableContainer
				sx={{ borderRadius: 2, border: '1px solid #e2e8f0', bgcolor: '#fff' }}
			>
				<Table size="small" aria-label="Horas trabajadas por persona">
					<TableHead>
						<TableRow>
							<TableCell sx={head}>Persona</TableCell>
							<TableCell sx={head}>Tienda</TableCell>
							{fechas.map((d) => (
								<TableCell key={d.format('YYYY-MM-DD')} sx={head} align="right">
									{nombreDia(d.day()).slice(0, 3)} {d.format('DD')}
								</TableCell>
							))}
							<TableCell sx={head} align="right">
								Total
							</TableCell>
						</TableRow>
					</TableHead>
					<TableBody>
						{pagina.map((f) => (
							<TableRow key={f.empleadoId} hover>
								<TableCell>
									<Typography variant="body2" sx={{ fontWeight: 600 }}>
										{f.empleado}
									</Typography>
									<Typography variant="caption" sx={{ color: '#64748b' }}>
										{f.documento}
									</Typography>
								</TableCell>
								<TableCell>
									{f.tiendas
										.map((t) => nombreTienda.get(t) ?? `Tienda ${t}`)
										.join(', ')}
								</TableCell>
								{f.dias.map((m, i) => (
									<TableCell key={fechas[i].format('YYYY-MM-DD')} align="right">
										{horas(m)}
									</TableCell>
								))}
								<TableCell align="right" sx={{ fontWeight: 700 }}>
									{horas(f.trabajados)}
								</TableCell>
							</TableRow>
						))}
						{!cargando && filas.length === 0 && (
							<TableRow>
								<TableCell
									colSpan={totalDias + 3}
									align="center"
									sx={{ py: 4 }}
								>
									No hay horas registradas esta semana con estos filtros
								</TableCell>
							</TableRow>
						)}
						{cargando && tiendas.length > 0 && (
							<TableRow>
								<TableCell
									colSpan={totalDias + 3}
									align="center"
									sx={{ py: 4 }}
								>
									Cargando horas de la semana...
								</TableCell>
							</TableRow>
						)}
					</TableBody>
				</Table>
			</TableContainer>
			{filas.length > 0 && (
				<ReporteTiendasPagination
					page={actual}
					totalPages={totalPages}
					rowsPerPage={rowsPerPage}
					totalRecords={filas.length}
					onPageChange={setPage}
					onRowsPerPageChange={(n) => {
						setRowsPerPage(n);
						setPage(0);
					}}
				/>
			)}
		</Paper>
	);
}
