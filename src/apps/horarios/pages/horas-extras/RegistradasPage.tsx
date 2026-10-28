import GroupAddIcon from '@mui/icons-material/GroupAdd';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
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
import { useQuery } from '@tanstack/react-query';
import type { Dayjs } from 'dayjs';
import { useMemo, useState } from 'react';
import { getStores } from '../../api/directus/read';
import { getEmpleadosBulk } from '../../api/directus/readBulk';
import { ReporteTiendasPagination } from '../../components/com_time_record_store';
import { BuscarEmpleado } from '../../components/horas-extras/BuscarEmpleado';
import { HorasExtrasTabla } from '../../components/horas-extras/HorasExtrasTabla';
import { RegistrarHoraExtraModal } from '../../components/horas-extras/RegistrarHoraExtraModal';
import DateRangeFilter from '../../components/reportes/DateRangeFilter';
import {
	ESTADOS_HORA_EXTRA,
	type EstadoHoraExtra,
	ETIQUETA_ESTADO_HORA_EXTRA,
	formatoMinutos,
} from '../../domain/horasExtras';
import { horariosKeys } from '../../hooks/registro/keys';
import { useHorariosLayout } from '../../hooks/useHorariosLayout';
import { useHorasExtras } from '../../hooks/useHorasExtras';
import type { Tienda } from '../../interfaces/tiendas';
import { mensajeDeError } from '../../utils/errores';
import { aFilaHoraExtra, coincideEmpleado } from '../../utils/horasExtras';

type FiltroEstado = EstadoHoraExtra | 'todos';

/**
 * Sub‑pestaña "Registradas" (/horarios/horas-extras/registradas) del líder de zona:
 * horas extras de sus tiendas (filtrables por tienda), con dos formas de registrar:
 * masiva (sub‑página con grilla personas × días) e individual (modal de una persona).
 */
export default function RegistradasPage() {
	const { acceso, irA } = useHorariosLayout();
	const [tiendaId, setTiendaId] = useState<number | ''>('');
	const [estado, setEstado] = useState<FiltroEstado>('todos');
	const [page, setPage] = useState(0);
	const [rowsPerPage, setRowsPerPage] = useState(10);
	const [busqueda, setBusqueda] = useState('');
	const [fechaInicio, setFechaInicio] = useState<Dayjs | null>(null);
	const [fechaFin, setFechaFin] = useState<Dayjs | null>(null);
	// Cada apertura cambia la key del modal para empezar con el formulario vacío.
	const [aperturas, setAperturas] = useState(0);
	const [abierto, setAbierto] = useState(false);

	const tiendasLider = useMemo(
		() => acceso.tiendasPermitidas.map((t) => Number(t.id)),
		[acceso.tiendasPermitidas],
	);
	const opcionesTienda = useMemo(
		() =>
			[...acceso.tiendasPermitidas].sort((a, b) =>
				a.name.localeCompare(b.name, 'es'),
			),
		[acceso.tiendasPermitidas],
	);
	const tiendas = useMemo(
		() => (tiendaId === '' ? tiendasLider : [tiendaId]),
		[tiendaId, tiendasLider],
	);

	const filtros = useMemo(
		() => ({
			tiendas,
			estados: estado === 'todos' ? undefined : [estado],
			desde: fechaInicio?.format('YYYY-MM-DD'),
			hasta: fechaFin?.format('YYYY-MM-DD'),
		}),
		[tiendas, estado, fechaInicio, fechaFin],
	);
	const { data = [], isLoading, error } = useHorasExtras(filtros);
	// El buscador del formulario usa todos los empleados del líder, no solo la tienda del header.
	const { data: empleados = [], isLoading: cargandoEmpleados } = useQuery({
		queryKey: horariosKeys.empleados.tiendas(tiendasLider),
		queryFn: () => getEmpleadosBulk(tiendasLider),
		enabled: abierto && tiendasLider.length > 0,
		staleTime: 5 * 60 * 1000,
	});
	// Misma clave que useHorariosAcceso: sale de la caché.
	const { data: todasLasTiendas = [] } = useQuery<Tienda[]>({
		queryKey: ['adminTiendas'],
		queryFn: getStores,
		staleTime: 30 * 60 * 1000,
	});

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
			<Box sx={{ mb: 2 }}>
				<Typography variant="h6" sx={{ fontWeight: 700, color: '#004680' }}>
					Horas extras registradas
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
					justifyContent: 'space-between',
					gap: 1.5,
					mb: 2,
				}}
			>
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
					<FormControl size="small" sx={{ minWidth: 200 }}>
						<InputLabel id="he-tienda">Tienda</InputLabel>
						<Select
							labelId="he-tienda"
							label="Tienda"
							value={tiendaId}
							onChange={(e) => {
								// Ids de tienda nunca son 0: '' (Todas) → ''.
								setTiendaId(Number(e.target.value) || '');
								setPage(0);
							}}
						>
							<MenuItem value="">Todas las tiendas</MenuItem>
							{opcionesTienda.map((t) => (
								<MenuItem key={t.id} value={t.id}>
									{t.name}
								</MenuItem>
							))}
						</Select>
					</FormControl>
					<FormControl size="small" sx={{ minWidth: 180 }}>
						<InputLabel id="he-estado">Estado</InputLabel>
						<Select
							labelId="he-estado"
							label="Estado"
							value={estado}
							onChange={(e) => {
								setEstado(e.target.value as FiltroEstado);
								setPage(0);
							}}
						>
							<MenuItem value="todos">Todos</MenuItem>
							{ESTADOS_HORA_EXTRA.map((e) => (
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
				<Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5 }}>
					<Button
						variant="outlined"
						startIcon={<PersonAddIcon />}
						disabled={tiendasLider.length === 0}
						onClick={() => {
							setAperturas((n) => n + 1);
							setAbierto(true);
						}}
					>
						Registrar individual
					</Button>
					<Button
						variant="contained"
						startIcon={<GroupAddIcon />}
						disabled={tiendasLider.length === 0}
						onClick={() => irA('horas-extras/registradas/nueva')}
					>
						Registrar horas (masiva)
					</Button>
				</Box>
			</Box>

			{tiendasLider.length === 0 && (
				<Alert severity="info" sx={{ mb: 2 }}>
					No tienes tiendas asignadas.
				</Alert>
			)}
			{error && (
				<Alert severity="error" sx={{ mb: 2 }}>
					{mensajeDeError(error, 'Error al cargar las horas extras')}
				</Alert>
			)}

			<HorasExtrasTabla
				filas={pagina}
				loading={isLoading && tiendas.length > 0}
				vacio="Aún no hay horas extras registradas"
			/>
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

			<RegistrarHoraExtraModal
				key={aperturas}
				open={abierto}
				empleados={empleados}
				cargandoEmpleados={cargandoEmpleados}
				tiendas={todasLasTiendas}
				tiendasLider={tiendasLider}
				onClose={() => setAbierto(false)}
			/>
		</Paper>
	);
}
