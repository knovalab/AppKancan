import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import {
	Alert,
	Box,
	Button,
	IconButton,
	Paper,
	Tooltip,
	Typography,
} from '@mui/material';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Dayjs } from 'dayjs';
import { useMemo, useState } from 'react';
import { revisarHorasExtras } from '../../api/directus/horasExtras';
import { ESTADO_HORA_EXTRA, formatoMinutos } from '../../domain/horasExtras';
import { horariosKeys } from '../../hooks/registro/keys';
import { useAvisos } from '../../hooks/useAvisos';
import { useHorariosLayout } from '../../hooks/useHorariosLayout';
import { useHorasExtras } from '../../hooks/useHorasExtras';
import { mensajeDeError } from '../../utils/errores';
import { aFilaHoraExtra, coincideEmpleado } from '../../utils/horasExtras';
import { ReporteTiendasPagination } from '../com_time_record_store';
import DateRangeFilter from '../reportes/DateRangeFilter';
import { BuscarEmpleado } from './BuscarEmpleado';
import { HorasExtrasTabla } from './HorasExtrasTabla';
import {
	type DecisionRevision,
	RevisionHoraExtraDialog,
} from './RevisionHoraExtraDialog';

const SOLO_PENDIENTES = [ESTADO_HORA_EXTRA.pendiente];

/**
 * Tabla de horas extras pendientes de las tiendas del header, para que el
 * comercial las apruebe o rechace una a una o en lote.
 */
export function PendientesAprobacion() {
	const { tienda } = useHorariosLayout();
	const queryClient = useQueryClient();
	const { showSnackbar } = useAvisos();
	const [page, setPage] = useState(0);
	const [rowsPerPage, setRowsPerPage] = useState(10);
	const [busqueda, setBusqueda] = useState('');
	// Sin rango por defecto: ninguna pendiente queda oculta.
	const [fechaInicio, setFechaInicio] = useState<Dayjs | null>(null);
	const [fechaFin, setFechaFin] = useState<Dayjs | null>(null);
	const [marcadas, setMarcadas] = useState<ReadonlySet<number>>(new Set());
	const [revision, setRevision] = useState<{
		decision: DecisionRevision;
		ids: number[];
	} | null>(null);
	// Cada apertura cambia la key del diálogo para empezar con el motivo vacío.
	const [aperturas, setAperturas] = useState(0);

	const filtros = useMemo(
		() => ({
			tiendas: tienda.storeIds,
			estados: SOLO_PENDIENTES,
			desde: fechaInicio?.format('YYYY-MM-DD'),
			hasta: fechaFin?.format('YYYY-MM-DD'),
		}),
		[tienda.storeIds, fechaInicio, fechaFin],
	);
	const { data = [], isLoading, error } = useHorasExtras(filtros);
	// Las marcadas que el buscador oculta no se aprueban: se revisa lo que se ve.
	const filas = useMemo(
		() => data.map(aFilaHoraExtra).filter((f) => coincideEmpleado(f, busqueda)),
		[data, busqueda],
	);

	// Solo cuentan las marcadas que siguen en la lista (otra persona pudo revisarlas).
	const seleccion = useMemo(
		() => filas.filter((f) => marcadas.has(f.id)),
		[filas, marcadas],
	);
	const idsSeleccion = useMemo(
		() => new Set(seleccion.map((f) => f.id)),
		[seleccion],
	);

	const totalMinutos = filas.reduce((s, f) => s + f.minutos, 0);
	const totalPages = Math.max(1, Math.ceil(filas.length / rowsPerPage));
	const actual = Math.min(page, totalPages - 1);
	const pagina = filas.slice(actual * rowsPerPage, (actual + 1) * rowsPerPage);

	const revisar = useMutation({
		mutationFn: ({
			ids,
			decision,
			nota,
		}: {
			ids: number[];
			decision: DecisionRevision;
			nota: string;
		}) => revisarHorasExtras(ids, { decision, nota }),
		onSuccess: (_, { ids, decision }) => {
			void queryClient.invalidateQueries({
				queryKey: horariosKeys.horasExtras.todos,
			});
			const n = ids.length;
			const verbo =
				decision === ESTADO_HORA_EXTRA.aprobada ? 'aprobada' : 'rechazada';
			showSnackbar(
				n === 1 ? `Hora extra ${verbo}` : `${n} horas extras ${verbo}s`,
				'success',
			);
			setMarcadas(
				(prev) => new Set([...prev].filter((id) => !ids.includes(id))),
			);
			setRevision(null);
		},
		onError: (err) =>
			showSnackbar(
				mensajeDeError(err, 'Error al guardar la revisión'),
				'error',
			),
	});

	const abrir = (decision: DecisionRevision, ids: number[]) => {
		setAperturas((n) => n + 1);
		setRevision({ decision, ids });
	};

	const cambiarSeleccion = (ids: number[], marcar: boolean) =>
		setMarcadas((prev) => {
			const next = new Set(prev);
			for (const id of ids) {
				if (marcar) next.add(id);
				else next.delete(id);
			}
			return next;
		});

	const filasRevision = revision
		? filas.filter((f) => revision.ids.includes(f.id))
		: [];

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
						Pendientes de aprobación
					</Typography>
					<Typography variant="body2" sx={{ color: '#64748b' }}>
						{filas.length} pendiente{filas.length !== 1 ? 's' : ''} ·{' '}
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
					{seleccion.length > 0 && (
						<Typography
							variant="body2"
							sx={{ fontWeight: 600, color: '#334155' }}
						>
							{seleccion.length} seleccionada{seleccion.length !== 1 ? 's' : ''}
						</Typography>
					)}
					<Button
						variant="contained"
						color="success"
						startIcon={<CheckCircleOutlineIcon />}
						disabled={seleccion.length === 0}
						onClick={() => abrir(ESTADO_HORA_EXTRA.aprobada, [...idsSeleccion])}
					>
						Aprobar
					</Button>
					<Button
						variant="outlined"
						color="error"
						startIcon={<CancelOutlinedIcon />}
						disabled={seleccion.length === 0}
						onClick={() =>
							abrir(ESTADO_HORA_EXTRA.descartadaComercial, [...idsSeleccion])
						}
					>
						Rechazar
					</Button>
				</Box>
			</Box>

			{error && (
				<Alert severity="error" sx={{ mb: 2 }}>
					{mensajeDeError(error, 'Error al cargar las horas extras')}
				</Alert>
			)}

			<HorasExtrasTabla
				filas={pagina}
				loading={isLoading && tienda.storeIds.length > 0}
				vacio="No hay horas extras pendientes"
				seleccion={{ ids: idsSeleccion, onCambiar: cambiarSeleccion }}
				acciones={(f) => (
					<>
						<Tooltip title="Aprobar">
							<IconButton
								color="success"
								aria-label={`Aprobar ${f.empleado}`}
								onClick={() => abrir(ESTADO_HORA_EXTRA.aprobada, [f.id])}
							>
								<CheckCircleOutlineIcon />
							</IconButton>
						</Tooltip>
						<Tooltip title="Rechazar">
							<IconButton
								color="error"
								aria-label={`Rechazar ${f.empleado}`}
								onClick={() =>
									abrir(ESTADO_HORA_EXTRA.descartadaComercial, [f.id])
								}
							>
								<CancelOutlinedIcon />
							</IconButton>
						</Tooltip>
					</>
				)}
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

			<RevisionHoraExtraDialog
				key={aperturas}
				decision={revision?.decision ?? null}
				filas={filasRevision}
				guardando={revisar.isPending}
				onClose={() => setRevision(null)}
				onConfirmar={(nota) =>
					revision && revisar.mutate({ ...revision, nota })
				}
			/>
		</Paper>
	);
}
