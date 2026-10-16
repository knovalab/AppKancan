import dayjs, { type Dayjs } from 'dayjs';
import { useEffect, useState } from 'react';
import { useHistorial } from '../hooks/useHistorial';
import 'dayjs/locale/es';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import PersonSearchIcon from '@mui/icons-material/PersonSearch';
import {
	Avatar,
	Box,
	Button,
	IconButton,
	MenuItem,
	Paper,
	Select,
	Table,
	TableBody,
	TableCell,
	TableContainer,
	TableHead,
	TableRow,
	Typography,
} from '@mui/material';
import { Eye } from 'lucide-react';
import { lazy, Suspense } from 'react';
import DateRangeFilter from '../components/reportes/DateRangeFilter';
import ExportHistorialDialog from '../components/reportes/ExportHistorialDialog';
import { LOG_TYPE } from '../domain/registro';
import useHorariosPolicies from '../hooks/useHorariosPolicies';
import type {
	HistorialEventoDetalle,
	HistorialRow,
} from '../interfaces/horarios.interface';

import { formatDocumentNumber } from '../utils/format';

const DailyAttendanceModal = lazy(() =>
	import('../components/DailyAttendanceModal').then((m) => ({
		default: m.DailyAttendanceModal,
	})),
);
const SingleRecordDetailModal = lazy(() =>
	import('../components/SingleRecordDetailModal').then((m) => ({
		default: m.SingleRecordDetailModal,
	})),
);

const AVATAR_COLORS = [
	'#0284c7',
	'#7c3aed',
	'#16a34a',
	'#ea580c',
	'#db2777',
	'#0891b2',
	'#4f46e5',
	'#ca8a04',
	'#dc2626',
	'#059669',
	'#2563eb',
	'#9333ea',
];

const getAvatarColor = (texto: string) => {
	const str = String(texto || '');
	let hash = 0;
	for (let i = 0; i < str.length; i++)
		hash = str.charCodeAt(i) + ((hash << 5) - hash);
	return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
};

interface HistorialPageProps {
	storeIdAdmin?: number | number[] | null;
	fechaInicioExternal?: Dayjs | null;
	fechaFinExternal?: Dayjs | null;
	searchNombreExternal?: string;
	hideHeader?: boolean;
	esReporte?: boolean;
}

export default function HistorialPage({
	storeIdAdmin,
	fechaInicioExternal,
	fechaFinExternal,
	searchNombreExternal,
	hideHeader = false,
	esReporte = false,
}: HistorialPageProps = {}) {
	const { esAdmin } = useHorariosPolicies();
	const esUsuarioAdmin = esAdmin();

	const [localSearch, setLocalSearch] = useState('');
	const [localFechaInicio, setLocalFechaInicio] = useState<Dayjs | null>(
		dayjs().subtract(6, 'day'),
	);
	const [localFechaFin, setLocalFechaFin] = useState<Dayjs | null>(dayjs());
	const [exportOpen, setExportOpen] = useState(false);

	const searchNombre =
		searchNombreExternal !== undefined ? searchNombreExternal : localSearch;
	const fechaInicio =
		fechaInicioExternal !== undefined ? fechaInicioExternal : localFechaInicio;
	const fechaFin =
		fechaFinExternal !== undefined ? fechaFinExternal : localFechaFin;

	const {
		data = [],
		isLoading,
		isError,
	} = useHistorial(
		fechaInicio ? fechaInicio.format('YYYY-MM-DD') : undefined,
		fechaFin ? fechaFin.format('YYYY-MM-DD') : undefined,
		storeIdAdmin,
	);

	const normalizar = (texto: string) =>
		texto
			.toLowerCase()
			.normalize('NFD')
			.replace(/[\u0300-\u036f]/g, '');

	const datosFiltrados = data.filter((row) => {
		const cumpleNombre = normalizar(row.empleado).includes(
			normalizar(searchNombre),
		);
		const cumpleFechaInicio = fechaInicio
			? row.fecha >= fechaInicio.format('YYYY-MM-DD')
			: true;
		const cumpleFechaFin = fechaFin
			? row.fecha <= fechaFin.format('YYYY-MM-DD')
			: true;
		return cumpleNombre && cumpleFechaInicio && cumpleFechaFin;
	});

	const [dayModalOpen, setDayModalOpen] = useState(false);
	const [filaSeleccionada, setFilaSeleccionada] = useState<HistorialRow | null>(
		null,
	);
	const [singleRecordModalOpen, setSingleRecordModalOpen] = useState(false);
	const [selectedRecordData, setSelectedRecordData] = useState<{
		empleado: string;
		fecha: string;
		documento?: string | null;
		tiendaNombre?: string;
		evento: HistorialEventoDetalle;
	} | null>(null);
	const [paginaActual, setPaginaActual] = useState(1);
	const [registrosPorPagina, setRegistrosPorPagina] = useState(5);

	useEffect(() => {
		setPaginaActual(1);
	}, []);

	const totalPaginas =
		registrosPorPagina === 0
			? 1
			: Math.ceil(datosFiltrados.length / registrosPorPagina);

	const datosPaginados =
		registrosPorPagina === 0
			? datosFiltrados
			: datosFiltrados.slice(
					(paginaActual - 1) * registrosPorPagina,
					paginaActual * registrosPorPagina,
				);

	const calcularHoras = (
		inicio_turno: string | null,
		fin_turno: string | null,
		inicio_almuerzo: string | null,
		fin_almuerzo: string | null,
	): string => {
		if (!inicio_turno || !fin_turno) return '--';

		const fecha = '2000-01-01';
		const inicio = dayjs(`${fecha} ${inicio_turno}`);
		const fin = dayjs(`${fecha} ${fin_turno}`);

		let minutes = fin.diff(inicio, 'minute');

		if (inicio_almuerzo && fin_almuerzo) {
			const iniAlmuerzo = dayjs(`${fecha} ${inicio_almuerzo}`);
			const finAlmuerzo = dayjs(`${fecha} ${fin_almuerzo}`);
			const diffAlmuerzo = finAlmuerzo.diff(iniAlmuerzo, 'minutes');
			if (diffAlmuerzo > 0) {
				minutes -= diffAlmuerzo;
			}
		}
		if (minutes <= 0) return '--';
		const hours = Math.floor(minutes / 60);
		const mins = minutes % 60;
		return `${hours}h ${mins}m`;
	};

	const formatearHora = (hora: string | null): string => {
		if (!hora) return '--';
		return hora.slice(0, 5);
	};

	const tieneObservacion = (row: HistorialRow, evento: string): boolean => {
		const rec = row.eventos_detalle?.find((d) => d.evento === evento);
		if (rec && (rec.photo || rec.observacion?.trim())) return true;
		return row.observaciones_evento.some(
			(obs) => obs.evento === evento && Boolean(obs.observacion?.trim()),
		);
	};

	const handleOpenSingleRecord = (row: HistorialRow, logType: string) => {
		const detalle = row.eventos_detalle?.find((d) => d.evento === logType);
		const observacion =
			row.observaciones_evento?.find((o) => o.evento === logType)
				?.observacion ||
			detalle?.observacion ||
			'';

		let hora: string | null = null;
		if (logType === LOG_TYPE.inicioJornada) hora = row.inicio_turno;
		else if (logType === LOG_TYPE.inicioAlmuerzo) hora = row.inicio_almuerzo;
		else if (logType === LOG_TYPE.finAlmuerzo) hora = row.fin_almuerzo;
		else if (logType === LOG_TYPE.finJornada) hora = row.fin_turno;

		const evento: HistorialEventoDetalle = detalle || {
			evento: logType,
			hora,
			observacion,
		};

		setSelectedRecordData({
			empleado: row.empleado,
			fecha: row.fecha ? dayjs(row.fecha).format('DD-MM-YYYY') : '',
			documento: row.documento,
			tiendaNombre: row.tiendaNombre,
			evento: {
				...evento,
				hora: evento.hora ?? hora,
				observacion: evento.observacion || observacion,
			},
		});
		setSingleRecordModalOpen(true);
	};

	const renderHoraCell = (
		hora: string | null,
		logType: string,
		row: HistorialRow,
	) => {
		if (!hora) {
			return (
				<Typography
					variant="body2"
					sx={{ color: '#94a3b8', fontSize: '0.875rem' }}
				>
					--
				</Typography>
			);
		}

		const hasObs = tieneObservacion(row, logType);

		return (
			<Box
				component="button"
				type="button"
				onClick={() => handleOpenSingleRecord(row, logType)}
				sx={{
					display: 'inline-flex',
					alignItems: 'center',
					gap: 0.75,
					px: 1,
					py: 0.4,
					borderRadius: 1.5,
					border: 'none',
					bgcolor: 'transparent',
					cursor: 'pointer',
					color: '#334155',
					transition: 'all 0.15s ease-in-out',
					'&:hover': {
						bgcolor: '#eef4ff',
						color: '#004680',
					},
				}}
				title={
					hasObs
						? `${formatearHora(hora)} • Tiene observación o fotografía (clic para ver)`
						: `${formatearHora(hora)} • Clic para ver detalles del registro`
				}
			>
				<Typography
					variant="body2"
					sx={{
						fontSize: '0.875rem',
						fontWeight: 500,
						color: 'inherit',
					}}
				>
					{formatearHora(hora)}
				</Typography>
				{hasObs && (
					<Box
						component="span"
						sx={{
							width: 7,
							height: 7,
							borderRadius: '50%',
							bgcolor: '#004680',
							boxShadow: '0 0 0 1.5px #fff',
							flexShrink: 0,
						}}
					/>
				)}
			</Box>
		);
	};

	const construirEventosFila = (
		row: HistorialRow | null,
	): HistorialEventoDetalle[] => {
		if (!row) return [];
		if (row.eventos_detalle && row.eventos_detalle.length > 0) {
			return row.eventos_detalle;
		}
		const eventos = [
			{ evento: LOG_TYPE.inicioJornada, hora: row.inicio_turno },
			{ evento: LOG_TYPE.inicioAlmuerzo, hora: row.inicio_almuerzo },
			{ evento: LOG_TYPE.finAlmuerzo, hora: row.fin_almuerzo },
			{ evento: LOG_TYPE.finJornada, hora: row.fin_turno },
		];
		return eventos
			.filter((e) => e.hora != null)
			.map((e) => ({
				evento: e.evento,
				hora: e.hora,
				observacion:
					row.observaciones_evento.find((o) => o.evento === e.evento)
						?.observacion ?? '',
			}));
	};

	return (
		<div className="space-y-4 px-0 -mt-2">
			{!hideHeader && (
				<section className="bg-white p-5 rounded-xl shadow-sm border border-gray-200">
					<div className="flex items-center justify-between gap-2.5 mb-4">
						<div className="flex items-center gap-2.5">
							<div className="flex items-center justify-center w-8 h-8 rounded-lg text-[#004680] bg-[#eaf2fb] border border-[#d6e6f7] shrink-0">
								<CalendarMonthIcon sx={{ fontSize: 18 }} />
							</div>
							<div>
								<h3 className="text-sm font-bold text-[#0f2c4a] leading-tight">
									Filtros de búsqueda
								</h3>
							</div>
						</div>
						<Button
							className="tour-hist-export"
							onClick={() => setExportOpen(true)}
							variant="contained"
							disableElevation
							startIcon={<FileDownloadIcon />}
							sx={{
								bgcolor: '#004680',
								textTransform: 'none',
								fontWeight: 700,
								borderRadius: 2,
								'&:hover': { bgcolor: '#003a6b' },
							}}
						>
							Exportar
						</Button>
					</div>

					<div className="flex flex-col md:flex-row gap-4 items-end">
						<div className="tour-hist-fechas space-y-1.5 flex-[2]">
							<DateRangeFilter
								fechaInicio={fechaInicio}
								fechaFin={fechaFin}
								onChange={(inicio, fin) => {
									if (fechaInicioExternal === undefined)
										setLocalFechaInicio(inicio);
									if (fechaFinExternal === undefined) setLocalFechaFin(fin);
									setPaginaActual(1);
								}}
							/>
						</div>
						<div className="tour-hist-nombre space-y-1.5 flex-[1]">
							<div className="relative">
								<input
									type="text"
									placeholder="Buscar por nombre..."
									value={searchNombre}
									onChange={(e) => {
										if (searchNombreExternal === undefined)
											setLocalSearch(e.target.value);
										setPaginaActual(1);
									}}
									className="w-full bg-[#e8f0fe] border border-gray-300 rounded-lg pl-3 pr-10 py-2 text-sm transition-colors focus:outline-none focus:bg-white focus:border-[#004680] focus:ring-2 focus:ring-[#004680]/20"
								/>
								<PersonSearchIcon
									className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
									sx={{ fontSize: 20 }}
								/>
							</div>
						</div>
					</div>
				</section>
			)}

			<Paper
				sx={{
					borderRadius: 4,
					overflow: 'hidden',
					border: '1px solid #eef2f6',
					boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
					bgcolor: '#fff',
				}}
				className="tour-hist-tabla"
			>
				<TableContainer sx={{ overflow: 'auto' }}>
					<Table sx={{ minWidth: 650 }}>
						<TableHead sx={{ bgcolor: '#f0f7ff' }}>
							<TableRow>
								<TableCell
									sx={{
										fontWeight: 700,
										py: 1.5,
										borderBottom: '1px solid #e2e8f0',
									}}
								>
									Fecha
								</TableCell>
								<TableCell
									sx={{
										fontWeight: 700,
										py: 1.5,
										borderBottom: '1px solid #e2e8f0',
									}}
								>
									Empleado
								</TableCell>
								<TableCell
									sx={{
										fontWeight: 700,
										py: 1.5,
										borderBottom: '1px solid #e2e8f0',
									}}
								>
									Tienda
								</TableCell>
								<TableCell
									sx={{
										fontWeight: 700,
										py: 1.5,
										borderBottom: '1px solid #e2e8f0',
									}}
								>
									Inicio Turno
								</TableCell>
								<TableCell
									sx={{
										fontWeight: 700,
										py: 1.5,
										borderBottom: '1px solid #e2e8f0',
									}}
								>
									Inicio Almuerzo
								</TableCell>
								<TableCell
									sx={{
										fontWeight: 700,
										py: 1.5,
										borderBottom: '1px solid #e2e8f0',
									}}
								>
									Fin Almuerzo
								</TableCell>
								<TableCell
									sx={{
										fontWeight: 700,
										py: 1.5,
										borderBottom: '1px solid #e2e8f0',
									}}
								>
									Fin Turno
								</TableCell>
								<TableCell
									sx={{
										fontWeight: 700,
										py: 1.5,
										borderBottom: '1px solid #e2e8f0',
									}}
								>
									Total Horas
								</TableCell>
								<TableCell
									align="center"
									sx={{
										fontWeight: 700,
										py: 1.5,
										borderBottom: '1px solid #e2e8f0',
										width: 80,
									}}
								>
									Detalle
								</TableCell>
							</TableRow>
						</TableHead>
						<TableBody>
							{datosPaginados.map((row, idx) => (
								<TableRow
									key={`${row.empleado}-${row.fecha}-${row.documento || ''}`}
									hover
									sx={{
										bgcolor: idx % 2 === 0 ? '#ffffff' : '#fafcff',
										transition: 'all 0.2s',
										'&:hover': {
											bgcolor: '#eef4ff',
										},
									}}
								>
									<TableCell
										sx={{
											py: 1.5,
											fontWeight: 500,
											color: '#1e293b',
											borderBottom: '1px solid #e2e8f0',
										}}
									>
										{row.fecha ? dayjs(row.fecha).format('DD-MM-YYYY') : ''}
									</TableCell>
									<TableCell
										sx={{ py: 1.5, borderBottom: '1px solid #e2e8f0' }}
									>
										{esReporte ? (
											<Box
												sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}
											>
												<Avatar
													sx={{
														width: 36,
														height: 36,
														bgcolor: getAvatarColor(row.empleado),
														fontSize: '1rem',
														fontWeight: 600,
													}}
												>
													{row.empleado.charAt(0).toUpperCase()}
												</Avatar>
												<Box>
													<Typography
														variant="body2"
														sx={{ fontWeight: 600, color: '#1e293b' }}
													>
														{row.empleado}
													</Typography>
													{row.documento && (
														<Typography
															variant="caption"
															sx={{ color: '#64748b' }}
														>
															Doc: {formatDocumentNumber(row.documento)}
														</Typography>
													)}
												</Box>
											</Box>
										) : (
											<Typography
												variant="body2"
												sx={{ color: '#1e293b', fontWeight: 500 }}
											>
												{row.empleado}
											</Typography>
										)}
									</TableCell>
									<TableCell
										sx={{
											py: 1.5,
											fontWeight: 500,
											color: '#475569',
											borderBottom: '1px solid #e2e8f0',
										}}
									>
										{row.tiendaNombre || '—'}
									</TableCell>
									<TableCell
										sx={{ py: 1.5, borderBottom: '1px solid #e2e8f0' }}
									>
										{renderHoraCell(
											row.inicio_turno,
											LOG_TYPE.inicioJornada,
											row,
										)}
									</TableCell>
									<TableCell
										sx={{ py: 1.5, borderBottom: '1px solid #e2e8f0' }}
									>
										{renderHoraCell(
											row.inicio_almuerzo,
											LOG_TYPE.inicioAlmuerzo,
											row,
										)}
									</TableCell>
									<TableCell
										sx={{ py: 1.5, borderBottom: '1px solid #e2e8f0' }}
									>
										{renderHoraCell(
											row.fin_almuerzo,
											LOG_TYPE.finAlmuerzo,
											row,
										)}
									</TableCell>
									<TableCell
										sx={{ py: 1.5, borderBottom: '1px solid #e2e8f0' }}
									>
										{renderHoraCell(row.fin_turno, LOG_TYPE.finJornada, row)}
									</TableCell>
									<TableCell
										sx={{
											py: 1.5,
											fontWeight: 600,
											color: '#004680',
											borderBottom: '1px solid #e2e8f0',
										}}
									>
										{calcularHoras(
											row.inicio_turno,
											row.fin_turno,
											row.inicio_almuerzo,
											row.fin_almuerzo,
										)}
									</TableCell>
									<TableCell
										sx={{
											py: 1.5,
											textAlign: 'center',
											borderBottom: '1px solid #e2e8f0',
										}}
									>
										<IconButton
											onClick={() => {
												setFilaSeleccionada(row);
												setDayModalOpen(true);
											}}
											title="Ver jornada completa"
											size="small"
											sx={{
												color: '#004680',
												'&:hover': { bgcolor: '#eff6ff' },
											}}
										>
											<Eye size={16} strokeWidth={2} />
										</IconButton>
									</TableCell>
								</TableRow>
							))}
							{(isLoading || isError || datosPaginados.length === 0) && (
								<TableRow>
									<TableCell
										colSpan={9}
										align="center"
										sx={{ py: 8, borderBottom: 'none' }}
									>
										{isLoading && (
											<Typography variant="body2" sx={{ color: '#64748b' }}>
												Cargando registros...
											</Typography>
										)}
										{isError && (
											<Typography variant="body2" sx={{ color: '#ef4444' }}>
												Error al cargar los registros
											</Typography>
										)}
										{!isLoading && !isError && (
											<Typography variant="body2" sx={{ color: '#94a3b8' }}>
												No hay registros para mostrar
											</Typography>
										)}
									</TableCell>
								</TableRow>
							)}
						</TableBody>
					</Table>
				</TableContainer>

				{registrosPorPagina !== 0 && (
					<Box
						sx={{
							display: 'flex',
							justifyContent: 'space-between',
							alignItems: 'center',
							p: 2,
							bgcolor: '#fff',
							borderTop: '1px solid #eef2f6',
						}}
					>
						<Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
							<Typography variant="caption" sx={{ color: '#64748b' }}>
								Mostrando {datosPaginados.length} de {datosFiltrados.length}{' '}
								registros
							</Typography>
							<Select
								value={registrosPorPagina}
								onChange={(e) => {
									setRegistrosPorPagina(Number(e.target.value));
									setPaginaActual(1);
								}}
								size="small"
								sx={{
									bgcolor: '#f1f7fe',
									borderRadius: 2,
									fontSize: '0.75rem',
									minWidth: 70,
									height: 30,
									'& .MuiOutlinedInput-notchedOutline': {
										borderColor: '#cbd5e1',
									},
									'&:hover .MuiOutlinedInput-notchedOutline': {
										borderColor: '#94a3b8',
									},
									'&.Mui-focused .MuiOutlinedInput-notchedOutline': {
										borderColor: '#004680',
									},
								}}
							>
								<MenuItem value={5}>5</MenuItem>
								<MenuItem value={10}>10</MenuItem>
								<MenuItem value={20}>20</MenuItem>
								<MenuItem value={25}>25</MenuItem>
							</Select>
						</Box>
						<Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
							<IconButton
								size="small"
								disabled={paginaActual === 1}
								onClick={() => setPaginaActual((p) => p - 1)}
								sx={{
									border: '1px solid #dfe4ec',
									borderRadius: 1.5,
									width: 32,
									height: 32,
								}}
							>
								<ChevronLeftIcon fontSize="small" />
							</IconButton>
							{(() => {
								const paginas: (number | string)[] = [];
								if (totalPaginas <= 5) {
									for (let i = 1; i <= totalPaginas; i++) paginas.push(i);
								} else {
									paginas.push(1);
									if (paginaActual > 3) paginas.push('...');
									for (
										let i = Math.max(2, paginaActual - 1);
										i <= Math.min(totalPaginas - 1, paginaActual + 1);
										i++
									) {
										paginas.push(i);
									}
									if (paginaActual < totalPaginas - 2) paginas.push('...');
									paginas.push(totalPaginas);
								}
								return paginas.map((num, idx) =>
									typeof num === 'string' ? (
										<Typography
											// biome-ignore lint/suspicious/noArrayIndexKey: dots are static dividers
											key={`dots-${idx}`}
											variant="caption"
											sx={{ color: '#94a3b8', px: 0.5 }}
										>
											...
										</Typography>
									) : (
										<Box
											key={num}
											onClick={() => setPaginaActual(num)}
											sx={{
												width: 32,
												height: 32,
												display: 'flex',
												alignItems: 'center',
												justifyContent: 'center',
												borderRadius: 1.5,
												cursor: 'pointer',
												bgcolor: paginaActual === num ? '#004680' : '#fff',
												color: paginaActual === num ? '#fff' : '#5e6f8d',
												border:
													paginaActual === num ? 'none' : '1px solid #dfe4ec',
												fontWeight: paginaActual === num ? 700 : 500,
												fontSize: '0.85rem',
												transition: 'all 0.2s',
												'&:hover': {
													bgcolor: paginaActual === num ? '#004680' : '#f1f5f9',
												},
											}}
										>
											{num}
										</Box>
									),
								);
							})()}
							<IconButton
								size="small"
								disabled={paginaActual === totalPaginas}
								onClick={() => setPaginaActual((p) => p + 1)}
								sx={{
									border: '1px solid #dfe4ec',
									borderRadius: 1.5,
									width: 32,
									height: 32,
								}}
							>
								<ChevronRightIcon fontSize="small" />
							</IconButton>
						</Box>
					</Box>
				)}
			</Paper>

			{dayModalOpen && (
				<Suspense fallback={null}>
					<DailyAttendanceModal
						open={dayModalOpen}
						onClose={() => {
							setDayModalOpen(false);
							setFilaSeleccionada(null);
						}}
						empleado={filaSeleccionada?.empleado ?? ''}
						fecha={
							filaSeleccionada?.fecha
								? dayjs(filaSeleccionada.fecha).format('DD-MM-YYYY')
								: ''
						}
						eventos={construirEventosFila(filaSeleccionada)}
						observaciones={filaSeleccionada?.observaciones_evento}
						totalHoras={
							filaSeleccionada
								? calcularHoras(
										filaSeleccionada.inicio_turno,
										filaSeleccionada.fin_turno,
										filaSeleccionada.inicio_almuerzo,
										filaSeleccionada.fin_almuerzo,
									)
								: undefined
						}
						tiendaNombre={filaSeleccionada?.tiendaNombre}
						esAdmin={esUsuarioAdmin}
						esReporte={esReporte}
					/>
				</Suspense>
			)}

			{singleRecordModalOpen && (
				<Suspense fallback={null}>
					<SingleRecordDetailModal
						open={singleRecordModalOpen}
						onClose={() => {
							setSingleRecordModalOpen(false);
							setSelectedRecordData(null);
						}}
						empleado={selectedRecordData?.empleado ?? ''}
						fecha={selectedRecordData?.fecha ?? ''}
						evento={selectedRecordData?.evento ?? null}
						documento={selectedRecordData?.documento}
						tiendaNombre={selectedRecordData?.tiendaNombre}
						esAdmin={esUsuarioAdmin}
						esReporte={esReporte}
					/>
				</Suspense>
			)}

			<ExportHistorialDialog
				open={exportOpen}
				onClose={() => setExportOpen(false)}
				fechaInicio={fechaInicio ? fechaInicio.format('YYYY-MM-DD') : undefined}
				fechaFin={fechaFin ? fechaFin.format('YYYY-MM-DD') : undefined}
				tiendaDefault={typeof storeIdAdmin === 'number' ? storeIdAdmin : null}
				searchNombre={searchNombre}
			/>
		</div>
	);
}
