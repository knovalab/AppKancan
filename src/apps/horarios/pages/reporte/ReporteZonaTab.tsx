import FileDownloadIcon from '@mui/icons-material/FileDownload';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import {
	Alert,
	Box,
	Button,
	Chip,
	CircularProgress,
	Collapse,
	FormControl,
	IconButton,
	InputLabel,
	MenuItem,
	Select,
	Table,
	TableBody,
	TableCell,
	TableContainer,
	TableHead,
	TableRow,
	Typography,
} from '@mui/material';
import { BarChart } from '@mui/x-charts/BarChart';
import dayjs, { type Dayjs } from 'dayjs';
import { Fragment, useMemo, useState } from 'react';
import { STORE_PRUEBAS } from '../../api/directus/read';
import { JEFES_ZONA } from '../../api/directus/reportesHorasExtras';
import DateRangeFilter from '../../components/reportes/DateRangeFilter';
import {
	DIAS_SEMANA,
	formatoMinutos,
	type TiendaZona,
} from '../../domain/horasExtras';
import { useAvisos } from '../../hooks/useAvisos';
import { useReporteZona, useZonas } from '../../hooks/useReporteHorasExtras';
import { mensajeDeError } from '../../utils/errores';
import { exportarReporteZonaExcel } from '../../utils/exportarReporteHorasExtras';
import { getRealColombiaTime } from '../../utils/timeSync';

const TODAS = '';
const head = { fontWeight: 700, color: '#1e293b', bgcolor: '#f0f7ff' };
const pct = (n: number) => `${Math.round(n * 100)} %`;

function Kpi({
	titulo,
	valor,
	nota,
}: {
	titulo: string;
	valor: string;
	nota?: string;
}) {
	return (
		<Box
			sx={{
				flex: 1,
				minWidth: 160,
				p: 2,
				borderRadius: 2,
				border: '1px solid #e2e8f0',
				bgcolor: '#f8fafc',
			}}
		>
			<Typography variant="body2" sx={{ color: '#64748b' }}>
				{titulo}
			</Typography>
			<Typography variant="h5" sx={{ fontWeight: 700, color: '#004680' }}>
				{valor}
			</Typography>
			{nota && (
				<Typography variant="caption" sx={{ color: '#94a3b8' }}>
					{nota}
				</Typography>
			)}
		</Box>
	);
}

function Variacion({ v }: { v: number | null }) {
	if (v == null)
		return (
			<Typography variant="body2" sx={{ color: '#94a3b8' }}>
				--
			</Typography>
		);
	const sube = v > 0;
	return (
		<Box
			sx={{
				display: 'inline-flex',
				alignItems: 'center',
				gap: 0.5,
				color: v === 0 ? '#64748b' : sube ? '#b91c1c' : '#047857',
			}}
			aria-label={`${sube ? 'Sube' : 'Baja'} ${pct(Math.abs(v))} frente al periodo anterior`}
		>
			{v !== 0 &&
				(sube ? (
					<TrendingUpIcon fontSize="small" />
				) : (
					<TrendingDownIcon fontSize="small" />
				))}
			{sube ? '+' : v < 0 ? '−' : ''}
			{pct(Math.abs(v))}
		</Box>
	);
}

export interface ReporteZonaTabProps {
	/** Jefe de zona: sus tiendas (fijas). `null`: comercial, elige la zona. */
	tiendasJefe: number[] | null;
}

/**
 * Reportes → Horas extras → Por zona (R2 + R4): horas **aprobadas** de la zona
 * en un rango, ranking de tiendas con variación, día de la semana, top de
 * personas y detalle desplegable tienda → persona → días. Exporta a Excel.
 */
export default function ReporteZonaTab({ tiendasJefe }: ReporteZonaTabProps) {
	const { showSnackbar } = useAvisos();
	const hoy = getRealColombiaTime();
	const [fechaInicio, setFechaInicio] = useState<Dayjs | null>(() =>
		hoy.startOf('month'),
	);
	const [fechaFin, setFechaFin] = useState<Dayjs | null>(() => hoy);
	const [zonaId, setZonaId] = useState(TODAS);
	const [tiendaId, setTiendaId] = useState<number | ''>('');
	const [abiertas, setAbiertas] = useState<ReadonlySet<number>>(new Set());
	const [exportando, setExportando] = useState(false);

	const zonasQ = useZonas(tiendasJefe == null);
	const zonas = zonasQ.data ?? [];
	const zona = zonas.find((z) => z.id === zonaId);
	const tiendasZona = useMemo(
		() => tiendasJefe ?? zona?.tiendas ?? [],
		[tiendasJefe, zona],
	);
	// Filtro de tienda: una de la zona; vacío = toda la zona.
	const tiendas = useMemo(
		() => (tiendaId === '' ? tiendasZona : [tiendaId]),
		[tiendaId, tiendasZona],
	);
	const zonaTexto = tiendasJefe
		? 'Mi zona'
		: (zona?.nombre ?? 'Todas las zonas');

	// Sin rango elegido ("Todo"): desde el inicio del año, para no pedir la historia entera.
	const desde = (fechaInicio ?? hoy.startOf('year')).format('YYYY-MM-DD');
	const hasta = (fechaFin ?? hoy).format('YYYY-MM-DD');
	const { reporte, personas, nombresTiendas, antes, isLoading, error } =
		// Un jefe sin tiendas no consulta: sin filtro vería todo lo que Directus le permita.
		useReporteZona(tiendas, desde, hasta, tiendasJefe?.length !== 0);

	const nombreTienda = (id: number) => nombresTiendas.get(id) ?? `Tienda ${id}`;
	// Opciones del filtro: las tiendas de la zona (o todas, sin la de pruebas).
	const opcionesTienda = (
		tiendasZona.length
			? tiendasZona
			: [...nombresTiendas.keys()].filter((id) => id !== STORE_PRUEBAS)
	)
		.map((id) => ({ id, nombre: nombreTienda(id) }))
		.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
	const nombreZona =
		tiendaId === ''
			? zonaTexto
			: `${zonaTexto}, tienda ${nombreTienda(tiendaId)}`;
	const persona = (id: number) =>
		personas.get(id) ?? { nombre: `Empleado ${id}`, documento: '' };
	const alternar = (id: number) =>
		setAbiertas((prev) => {
			const sig = new Set(prev);
			if (sig.has(id)) sig.delete(id);
			else sig.add(id);
			return sig;
		});

	const exportar = async () => {
		setExportando(true);
		try {
			await exportarReporteZonaExcel({
				reporte,
				zona: nombreZona,
				desde,
				hasta,
				nombreTienda,
				persona,
			});
		} catch (err) {
			showSnackbar(
				mensajeDeError(err, 'Error al exportar el reporte'),
				'error',
			);
		} finally {
			setExportando(false);
		}
	};

	const filaTienda = (t: TiendaZona) => {
		const abierta = abiertas.has(t.storeId);
		return (
			<Fragment key={t.storeId}>
				<TableRow hover>
					<TableCell padding="checkbox">
						<IconButton
							size="small"
							aria-label={`${abierta ? 'Ocultar' : 'Ver'} personas de ${nombreTienda(t.storeId)}`}
							aria-expanded={abierta}
							onClick={() => alternar(t.storeId)}
						>
							{abierta ? <KeyboardArrowDownIcon /> : <KeyboardArrowRightIcon />}
						</IconButton>
					</TableCell>
					<TableCell sx={{ fontWeight: 600 }}>
						{nombreTienda(t.storeId)}
					</TableCell>
					<TableCell sx={{ fontWeight: 700 }}>
						{formatoMinutos(t.minutos)}
					</TableCell>
					<TableCell>{pct(t.porcentaje)}</TableCell>
					<TableCell>{t.registros}</TableCell>
					<TableCell>{t.personas.length}</TableCell>
					<TableCell>
						{t.minutosPorPersona == null
							? '--'
							: formatoMinutos(Math.round(t.minutosPorPersona))}
					</TableCell>
					<TableCell>
						<Variacion v={t.variacion} />
					</TableCell>
				</TableRow>
				<TableRow>
					<TableCell
						colSpan={8}
						sx={{ py: 0, borderBottom: abierta ? undefined : 0 }}
					>
						<Collapse in={abierta} unmountOnExit>
							<Table
								size="small"
								aria-label={`Personas de ${nombreTienda(t.storeId)}`}
								sx={{ my: 1 }}
							>
								<TableHead>
									<TableRow>
										{[
											'Persona',
											'Documento',
											'Total',
											'Días con horas extras',
										].map((c) => (
											<TableCell
												key={c}
												sx={{ fontWeight: 700, color: '#475569' }}
											>
												{c}
											</TableCell>
										))}
									</TableRow>
								</TableHead>
								<TableBody>
									{t.personas.map((p) => {
										const { nombre, documento } = persona(p.empleadoId);
										return (
											<TableRow key={p.empleadoId}>
												<TableCell sx={{ fontWeight: 600 }}>{nombre}</TableCell>
												<TableCell>{documento || '--'}</TableCell>
												<TableCell sx={{ whiteSpace: 'nowrap' }}>
													{formatoMinutos(p.minutos)}
												</TableCell>
												<TableCell>
													<Box
														sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}
													>
														{p.dias.map((d) => (
															<Chip
																key={d.fecha}
																size="small"
																variant="outlined"
																label={`${dayjs(d.fecha).format('ddd DD/MM')}: ${formatoMinutos(d.minutos)}`}
															/>
														))}
													</Box>
												</TableCell>
											</TableRow>
										);
									})}
								</TableBody>
							</Table>
						</Collapse>
					</TableCell>
				</TableRow>
			</Fragment>
		);
	};

	return (
		<Box>
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
						Horas extras por zona: {nombreZona}
					</Typography>
					<Typography variant="body2" sx={{ color: '#64748b' }}>
						Horas aprobadas por tienda donde se trabajó. Variación frente a{' '}
						{dayjs(antes.desde).format('DD/MM')} al{' '}
						{dayjs(antes.hasta).format('DD/MM')}.
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
					{tiendasJefe == null && (
						<FormControl size="small" sx={{ minWidth: 200 }}>
							<InputLabel id="rz-zona">Zona</InputLabel>
							<Select
								labelId="rz-zona"
								label="Zona"
								value={zonaId}
								onChange={(e) => {
									setZonaId(e.target.value);
									setTiendaId('');
									setAbiertas(new Set());
								}}
							>
								<MenuItem value={TODAS}>Todas las zonas</MenuItem>
								{zonas.map((z) => (
									<MenuItem key={z.id} value={z.id}>
										{z.nombre}
									</MenuItem>
								))}
							</Select>
						</FormControl>
					)}
					<FormControl size="small" sx={{ minWidth: 200 }}>
						<InputLabel id="rz-tienda">Tienda</InputLabel>
						<Select
							labelId="rz-tienda"
							label="Tienda"
							value={tiendaId}
							onChange={(e) => {
								// Ids de tienda nunca son 0: '' (Todas) → ''.
								setTiendaId(Number(e.target.value) || '');
								setAbiertas(new Set());
							}}
						>
							<MenuItem value="">Todas las tiendas</MenuItem>
							{opcionesTienda.map((t) => (
								<MenuItem key={t.id} value={t.id}>
									{t.nombre}
								</MenuItem>
							))}
						</Select>
					</FormControl>
					<Box sx={{ width: { xs: '100%', sm: 280 } }}>
						<DateRangeFilter
							fechaInicio={fechaInicio}
							fechaFin={fechaFin}
							onChange={(inicio, fin) => {
								setFechaInicio(inicio);
								setFechaFin(fin);
							}}
						/>
					</Box>
					<Button
						variant="outlined"
						startIcon={
							exportando ? <CircularProgress size={16} /> : <FileDownloadIcon />
						}
						onClick={exportar}
						disabled={exportando || reporte.tiendas.length === 0}
					>
						Exportar a Excel
					</Button>
				</Box>
			</Box>

			{tiendasJefe == null &&
				zonasQ.isSuccess &&
				zonas.length < JEFES_ZONA.length && (
					<Alert severity="warning" sx={{ mb: 2 }}>
						Solo se cargaron {zonas.length} de {JEFES_ZONA.length} zonas. Las
						zonas salen de las tiendas asignadas a cada jefe de zona
						(core_user_stores): falta permiso para leerlas o algún jefe no tiene
						tiendas activas.
					</Alert>
				)}
			{(error || zonasQ.error) && (
				<Alert severity="error" sx={{ mb: 2 }}>
					{mensajeDeError(
						error ?? zonasQ.error,
						'Error al cargar el reporte por zona',
					)}
				</Alert>
			)}

			{tiendasJefe?.length === 0 ? (
				<Alert severity="info">No tienes tiendas asignadas.</Alert>
			) : isLoading ? (
				<Box
					sx={{ p: 5, textAlign: 'center' }}
					role="status"
					aria-live="polite"
				>
					<CircularProgress size={32} sx={{ color: '#004680' }} />
					<Typography variant="body2" sx={{ mt: 1.5, color: '#64748b' }}>
						Cargando horas extras de la zona...
					</Typography>
				</Box>
			) : reporte.tiendas.length === 0 ? (
				<Alert severity="info">
					No hay horas extras aprobadas en este rango.
				</Alert>
			) : (
				<>
					<Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, mb: 3 }}>
						<Kpi
							titulo="Horas extras"
							valor={formatoMinutos(reporte.total.minutos)}
						/>
						<Kpi titulo="Registros" valor={String(reporte.total.registros)} />
						<Kpi
							titulo="Personas con horas"
							valor={String(reporte.total.personas)}
						/>
						<Kpi
							titulo="Horas por persona"
							valor={
								reporte.total.minutosPorPersona == null
									? '--'
									: formatoMinutos(Math.round(reporte.total.minutosPorPersona))
							}
							nota="sobre la plantilla activa"
						/>
					</Box>

					<Box
						sx={{
							display: 'grid',
							gridTemplateColumns: { xs: '1fr', md: '3fr 2fr' },
							gap: 2,
							mb: 3,
						}}
					>
						<Box
							sx={{
								p: 2,
								borderRadius: 2,
								border: '1px solid #e2e8f0',
								bgcolor: '#f8fafc',
							}}
						>
							<Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
								Horas por día de la semana
							</Typography>
							<BarChart
								height={240}
								xAxis={[{ scaleType: 'band', data: DIAS_SEMANA }]}
								series={[
									{
										data: reporte.porDiaSemana.map(
											(m) => Math.round((m / 60) * 10) / 10,
										),
										label: 'Horas',
										color: '#004680',
										valueFormatter: (v) => `${v ?? 0} h`,
									},
								]}
								hideLegend
							/>
						</Box>
						<Box
							sx={{
								p: 2,
								borderRadius: 2,
								border: '1px solid #e2e8f0',
								bgcolor: '#f8fafc',
							}}
						>
							<Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
								Personas con más horas
							</Typography>
							<Box
								component="ol"
								sx={{ m: 0, pl: 2.5 }}
								aria-label="Personas con más horas"
							>
								{reporte.topPersonas.map((p) => (
									<Box
										component="li"
										key={p.empleadoId}
										sx={{
											py: 0.5,
											display: 'flex',
											justifyContent: 'space-between',
											gap: 1,
										}}
									>
										<Typography variant="body2" noWrap>
											{persona(p.empleadoId).nombre}
											<Typography
												component="span"
												variant="caption"
												sx={{ color: '#94a3b8', ml: 1 }}
											>
												{p.tiendas.map(nombreTienda).join(', ')}
											</Typography>
										</Typography>
										<Typography
											variant="body2"
											sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}
										>
											{formatoMinutos(p.minutos)}
										</Typography>
									</Box>
								))}
							</Box>
						</Box>
					</Box>

					<TableContainer
						sx={{
							borderRadius: 2,
							border: '1px solid #e2e8f0',
							bgcolor: '#fff',
						}}
					>
						<Table size="small" aria-label="Horas extras por tienda">
							<TableHead>
								<TableRow>
									<TableCell sx={head} />
									{[
										'Tienda',
										'Horas',
										'% zona',
										'Registros',
										'Personas',
										'Horas por persona',
										'Variación',
									].map((c) => (
										<TableCell key={c} sx={head}>
											{c}
										</TableCell>
									))}
								</TableRow>
							</TableHead>
							<TableBody>{reporte.tiendas.map(filaTienda)}</TableBody>
						</Table>
					</TableContainer>
				</>
			)}
		</Box>
	);
}
