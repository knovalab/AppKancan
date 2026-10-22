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
import { useMemo, useState } from 'react';
import { getStores } from '../../api/directus/read';
import { getEmpleadosBulk } from '../../api/directus/readBulk';
import { ReporteTiendasPagination } from '../../components/com_time_record_store';
import { HorasExtrasTabla } from '../../components/horas-extras/HorasExtrasTabla';
import { RegistrarHoraExtraModal } from '../../components/horas-extras/RegistrarHoraExtraModal';
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
import { aFilaHoraExtra } from '../../utils/horasExtras';

type FiltroEstado = EstadoHoraExtra | 'todos';

/**
 * Sub‑pestaña "Registradas" (/horarios/horas-extras/registradas) del líder de zona:
 * horas extras de las tiendas elegidas en el header, con dos formas de registrar:
 * masiva (sub‑página con grilla personas × días) e individual (modal de una persona).
 */
export default function RegistradasPage() {
	const { tienda, acceso, irA } = useHorariosLayout();
	const [estado, setEstado] = useState<FiltroEstado>('todos');
	const [page, setPage] = useState(0);
	const [rowsPerPage, setRowsPerPage] = useState(10);
	// Cada apertura cambia la key del modal para empezar con el formulario vacío.
	const [aperturas, setAperturas] = useState(0);
	const [abierto, setAbierto] = useState(false);

	const filtros = useMemo(
		() => ({
			tiendas: tienda.storeIds,
			estados: estado === 'todos' ? undefined : [estado],
		}),
		[tienda.storeIds, estado],
	);
	const { data = [], isLoading, error } = useHorasExtras(filtros);

	const tiendasLider = useMemo(
		() => acceso.tiendasPermitidas.map((t) => Number(t.id)),
		[acceso.tiendasPermitidas],
	);
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

	const filas = useMemo(() => data.map(aFilaHoraExtra), [data]);
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
						Horas extras registradas
					</Typography>
					<Typography variant="body2" sx={{ color: '#64748b' }}>
						{filas.length} registro{filas.length !== 1 ? 's' : ''} ·{' '}
						{formatoMinutos(totalMinutos)} en total
					</Typography>
				</Box>
				<Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5 }}>
					<FormControl size="small" sx={{ minWidth: 200 }}>
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

			{tienda.storeIds.length === 0 && (
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
				loading={isLoading && tienda.storeIds.length > 0}
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
