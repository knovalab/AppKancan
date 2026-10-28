import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import {
	Alert,
	Box,
	Button,
	FormControl,
	InputLabel,
	MenuItem,
	Paper,
	Select,
	Typography,
} from '@mui/material';
import dayjs, { type Dayjs } from 'dayjs';
import { useMemo, useState } from 'react';
import {
	ESTADO_HORA_EXTRA,
	ESTADOS_HORA_EXTRA,
	type EstadoHoraExtra,
	ETIQUETA_ESTADO_HORA_EXTRA,
	formatoMinutos,
} from '../../domain/horasExtras';
import { useHorariosLayout } from '../../hooks/useHorariosLayout';
import { useHorasExtras } from '../../hooks/useHorasExtras';
import type { HoraExtraFila } from '../../interfaces/horasExtras';
import { mensajeDeError } from '../../utils/errores';
import { aFilaHoraExtra, coincideEmpleado } from '../../utils/horasExtras';
import { ReporteTiendasPagination } from '../com_time_record_store';
import DateRangeFilter from '../reportes/DateRangeFilter';
import { BuscarEmpleado } from './BuscarEmpleado';
import { FiltrosZonaTienda, useFiltroZonaTienda } from './FiltrosZonaTienda';
import { HoraExtraDetalleDialog } from './HoraExtraDetalleDialog';
import { HorasExtrasTabla } from './HorasExtrasTabla';

/** Todo menos `pendiente`: las pendientes tienen su propia tabla. */
export const ESTADOS_HISTORIAL = ESTADOS_HORA_EXTRA.filter(
	(e) => e !== ESTADO_HORA_EXTRA.pendiente,
);

type FiltroEstado = EstadoHoraExtra | 'todos';

/**
 * Historial del comercial y de nómina (con la columna Periodo): horas extras ya revisadas (y cualquier estado que no
 * sea pendiente) de las tiendas permitidas, con zona, tienda, estado y rango de fechas.
 * Filtros con el mismo calendario que "Apertura y Cierre de Tiendas" (Monitoreo).
 */
export function HistorialHorasExtras() {
	const { acceso } = useHorariosLayout();
	const filtroZT = useFiltroZonaTienda();
	const { tiendas } = filtroZT;
	const [fechaInicio, setFechaInicio] = useState<Dayjs | null>(() => dayjs());
	const [fechaFin, setFechaFin] = useState<Dayjs | null>(() => dayjs());
	const [estado, setEstado] = useState<FiltroEstado>('todos');
	const [page, setPage] = useState(0);
	const [rowsPerPage, setRowsPerPage] = useState(10);
	const [detalle, setDetalle] = useState<HoraExtraFila | null>(null);
	const [busqueda, setBusqueda] = useState('');

	const filtros = useMemo(
		() => ({
			tiendas,
			desde: fechaInicio?.format('YYYY-MM-DD'),
			hasta: fechaFin?.format('YYYY-MM-DD'),
			estados: estado === 'todos' ? [...ESTADOS_HISTORIAL] : [estado],
		}),
		[tiendas, fechaInicio, fechaFin, estado],
	);
	const { data = [], isLoading, error } = useHorasExtras(filtros);
	const filas = useMemo(
		() => data.map(aFilaHoraExtra).filter((f) => coincideEmpleado(f, busqueda)),
		[data, busqueda],
	);

	const totalMinutos = filas.reduce((s, f) => s + f.minutos, 0);
	const totalPages = Math.max(1, Math.ceil(filas.length / rowsPerPage));
	const actual = Math.min(page, totalPages - 1);
	const pagina = filas.slice(actual * rowsPerPage, (actual + 1) * rowsPerPage);

	return (
		<Paper
			elevation={0}
			sx={{ p: 2, borderRadius: 3, border: '1px solid #e0e0e0' }}
		>
			<Box
				sx={{
					display: 'flex',
					flexWrap: 'wrap',
					alignItems: 'center',
					justifyContent: 'space-between',
					gap: 2,
					mb: 2,
				}}
			>
				<Box>
					<Typography variant="h6" sx={{ fontWeight: 700, color: '#004680' }}>
						Historial de horas extras
					</Typography>
					<Typography variant="body2" sx={{ color: '#64748b' }}>
						{filas.length} registro{filas.length !== 1 ? 's' : ''} ·{' '}
						{formatoMinutos(totalMinutos)} en total
					</Typography>
				</Box>
				<Box
					sx={{
						display: 'flex',
						flexWrap: 'wrap',
						alignItems: 'center',
						gap: 1.5,
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
					<FormControl size="small" sx={{ minWidth: 180 }}>
						<InputLabel id="hh-estado">Estado</InputLabel>
						<Select
							labelId="hh-estado"
							label="Estado"
							value={estado}
							onChange={(e) => {
								setEstado(e.target.value as FiltroEstado);
								setPage(0);
							}}
						>
							<MenuItem value="todos">Todos los estados</MenuItem>
							{ESTADOS_HISTORIAL.map((e) => (
								<MenuItem key={e} value={e}>
									{ETIQUETA_ESTADO_HORA_EXTRA[e]}
								</MenuItem>
							))}
						</Select>
					</FormControl>
					{/* DateRangeFilter es fullWidth: sin ancho acotado ocuparía toda la fila. */}
					<Box sx={{ width: { xs: '100%', sm: 280 } }}>
						<DateRangeFilter
							fechaInicio={fechaInicio}
							fechaFin={fechaFin}
							onChange={(inicio, fin) => {
								setFechaInicio(inicio);
								setFechaFin(fin);
								setPage(0);
							}}
						/>
					</Box>
				</Box>
			</Box>

			{error && (
				<Alert severity="error" sx={{ mb: 2 }}>
					{mensajeDeError(
						error,
						'Error al cargar el historial de horas extras',
					)}
				</Alert>
			)}

			<HorasExtrasTabla
				filas={pagina}
				loading={isLoading && tiendas.length > 0}
				vacio="No hay horas extras en el historial con estos filtros"
				conPeriodo={acceso.roles.has('nomina')}
				compacta
				acciones={(f) => (
					<Button
						size="small"
						startIcon={<VisibilityOutlinedIcon />}
						onClick={() => setDetalle(f)}
						aria-label={`Ver detalle de ${f.empleado}`}
					></Button>
				)}
			/>
			<HoraExtraDetalleDialog fila={detalle} onClose={() => setDetalle(null)} />
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
