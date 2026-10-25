import {
	Alert,
	Box,
	Button,
	FormControl,
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
	useMediaQuery,
	useTheme,
} from '@mui/material';
import { BarChart } from '@mui/x-charts/BarChart';
import dayjs, { type Dayjs } from 'dayjs';
import { useState } from 'react';
import DateRangeFilter from '../../../components/reportes/DateRangeFilter';
import { DIAS_SEMANA } from '../../../domain/horasExtras';
import { useZonasGerencia } from '../../../hooks/useReporteGerencia';
import { mensajeDeError } from '../../../utils/errores';
import { getRealColombiaTime } from '../../../utils/timeSync';
import {
	AZUL,
	BORDE,
	Bloque,
	Cargando,
	Filtros,
	GRIS,
	horasCortas,
	Kpi,
	Kpis,
	pct,
	TACTIL,
	Tarjeta,
	Tarjetas,
	useCompacto,
	Variacion,
} from './bloques';

const TODAS = '';
/** Tiendas visibles en teléfono y tablet antes de "Ver todas". */
const TOP_TIENDAS = 10;
const head = { fontWeight: 700, color: '#1e293b', bgcolor: '#f0f7ff' };
const nombreZona = (z: string | null) => z ?? 'Sin zona';

/**
 * Por zona de gerencia: zonas → tiendas, **sin personas** y sin descargas. Las
 * zonas se ven como barras horizontales (se leen sin girar el teléfono); las
 * tiendas, como tarjetas en teléfono y tablet, y como tabla en escritorio.
 */
export default function GerenciaPorZona() {
	const hoy = getRealColombiaTime();
	const telefono = useMediaQuery(useTheme().breakpoints.down('sm'));
	const compacto = useCompacto();
	const [zona, setZona] = useState(TODAS);
	const [fechaInicio, setFechaInicio] = useState<Dayjs | null>(() =>
		hoy.startOf('month'),
	);
	const [fechaFin, setFechaFin] = useState<Dayjs | null>(() => hoy);
	const [verTodas, setVerTodas] = useState(false);

	// Sin rango ("Todo"): desde el inicio del año, para no pedir la historia entera.
	const desde = (fechaInicio ?? hoy.startOf('year')).format('YYYY-MM-DD');
	const hasta = (fechaFin ?? hoy).format('YYYY-MM-DD');
	const { zonas, reporte, antes, nombreTienda, isLoading, error } =
		useZonasGerencia(zona, desde, hasta);

	const elegirZona = (z: string) => {
		setZona(z);
		setVerTodas(false);
	};
	const rango = `${dayjs(desde).format('DD/MM')} al ${dayjs(hasta).format('DD/MM')}`;
	const tiendas =
		compacto && !verTodas
			? reporte.tiendas.slice(0, TOP_TIENDAS)
			: reporte.tiendas;
	const horasDia = reporte.porDiaSemana.map(
		(m) => Math.round((m / 60) * 10) / 10,
	);

	return (
		<Box>
			<Filtros resumen={`${zona || 'Todas las zonas'} · ${rango}`}>
				<FormControl
					size="small"
					fullWidth
					sx={{
						minWidth: { sm: 200 },
						width: { sm: 'auto' },
						'& .MuiInputBase-root': { minHeight: TACTIL },
					}}
				>
					<InputLabel id="gz-zona">Zona</InputLabel>
					<Select
						labelId="gz-zona"
						label="Zona"
						value={zona}
						onChange={(e) => elegirZona(e.target.value)}
					>
						<MenuItem value={TODAS}>Todas las zonas</MenuItem>
						{zonas.map((z) => (
							<MenuItem key={z.id} value={z.id}>
								{z.nombre}
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
			</Filtros>

			{error && (
				<Alert severity="error" sx={{ mb: 2 }}>
					{mensajeDeError(error, 'Error al cargar el reporte por zona')}
				</Alert>
			)}

			{isLoading ? (
				<Cargando />
			) : reporte.tiendas.length === 0 ? (
				<Alert severity="info">
					No hay horas aprobadas {zona ? `en ${zona} ` : ''}del {rango}.
				</Alert>
			) : (
				<>
					<Typography variant="body2" sx={{ color: GRIS, mb: 1.5 }}>
						Solo horas aprobadas, por tienda donde se trabajó. Variación frente
						al {dayjs(antes.desde).format('DD/MM')} al{' '}
						{dayjs(antes.hasta).format('DD/MM')}.
					</Typography>
					<Kpis>
						<Kpi
							principal
							titulo={`Horas extras · ${zona || 'todas las zonas'}`}
							valor={horasCortas(reporte.total.minutos)}
							extra={<Variacion valor={reporte.total.variacion} />}
						/>
						<Kpi
							titulo="Registros"
							valor={reporte.total.registros.toLocaleString('es-CO')}
						/>
						<Kpi
							titulo="Tiendas con horas"
							valor={String(reporte.tiendas.length)}
						/>
					</Kpis>

					{zona === TODAS && reporte.zonas.length > 0 && (
						<Bloque titulo="Horas por zona">
							{/* Sin % ni barras: cada zona tiene distinta plantilla, se comparan horas. */}
							<Tarjetas>
								{reporte.zonas.map((z) => {
									const etiqueta = nombreZona(z.zona);
									return (
										// Tocar una zona la abre; "Sin zona" no es una zona elegible.
										<Tarjeta
											key={etiqueta}
											onClick={
												z.zona == null
													? undefined
													: () => elegirZona(z.zona as string)
											}
											etiqueta={`${etiqueta}: ${horasCortas(z.minutos)}`}
										>
											<Typography sx={{ fontWeight: 700 }} noWrap>
												{etiqueta}
											</Typography>
											<Box
												sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}
											>
												<Typography
													sx={{ fontWeight: 700, fontSize: 24, color: AZUL }}
												>
													{horasCortas(z.minutos)}
												</Typography>
												<Variacion valor={z.variacion} />
											</Box>
											<Typography variant="caption" sx={{ color: GRIS }}>
												{z.tiendas} {z.tiendas === 1 ? 'tienda' : 'tiendas'}
											</Typography>
										</Tarjeta>
									);
								})}
							</Tarjetas>
						</Bloque>
					)}

					<Bloque titulo="¿Qué tiendas suman más horas?">
						{compacto ? (
							<>
								<Tarjetas>
									{tiendas.map((t) => (
										<Tarjeta key={t.storeId}>
											<Box
												sx={{
													display: 'flex',
													justifyContent: 'space-between',
													alignItems: 'baseline',
													gap: 1,
												}}
											>
												<Typography sx={{ fontWeight: 700 }} noWrap>
													{nombreTienda(t.storeId)}
												</Typography>
												<Typography sx={{ fontWeight: 700, fontSize: 18 }}>
													{horasCortas(t.minutos)}
												</Typography>
											</Box>
											<Typography variant="body2" sx={{ color: GRIS }}>
												{pct(t.porcentaje)} · <Variacion valor={t.variacion} />
												{zona === TODAS && ` · ${nombreZona(t.zona)}`}
											</Typography>
										</Tarjeta>
									))}
								</Tarjetas>
								{reporte.tiendas.length > TOP_TIENDAS && (
									<Button
										fullWidth
										onClick={() => setVerTodas((v) => !v)}
										sx={{ mt: 1, minHeight: TACTIL }}
									>
										{verTodas
											? 'Ver menos'
											: `Ver todas (${reporte.tiendas.length})`}
									</Button>
								)}
							</>
						) : (
							<TableContainer
								sx={{ borderRadius: 2, border: BORDE, bgcolor: '#fff' }}
							>
								<Table size="small" aria-label="Horas extras por tienda">
									<TableHead>
										<TableRow>
											{[
												'Tienda',
												...(zona === TODAS ? ['Zona'] : []),
												'Horas',
												'% del total',
												'Variación',
											].map((c) => (
												<TableCell key={c} sx={head}>
													{c}
												</TableCell>
											))}
										</TableRow>
									</TableHead>
									<TableBody>
										{tiendas.map((t) => (
											<TableRow key={t.storeId} hover>
												<TableCell sx={{ fontWeight: 600 }}>
													{nombreTienda(t.storeId)}
												</TableCell>
												{zona === TODAS && (
													<TableCell>{nombreZona(t.zona)}</TableCell>
												)}
												<TableCell sx={{ fontWeight: 700 }}>
													{horasCortas(t.minutos)}
												</TableCell>
												<TableCell>{pct(t.porcentaje)}</TableCell>
												<TableCell>
													<Variacion valor={t.variacion} />
												</TableCell>
											</TableRow>
										))}
									</TableBody>
								</Table>
							</TableContainer>
						)}
					</Bloque>

					<Bloque titulo="¿Qué días de la semana suman más horas?">
						<Box
							sx={{
								p: { xs: 1, sm: 2 },
								borderRadius: 2,
								border: BORDE,
								bgcolor: '#f8fafc',
							}}
						>
							{/* Teléfono: barras horizontales para que los días se lean sin girar. */}
							<BarChart
								height={telefono ? 280 : 240}
								layout={telefono ? 'horizontal' : 'vertical'}
								{...(telefono
									? { yAxis: [{ scaleType: 'band', data: DIAS_SEMANA }] }
									: { xAxis: [{ scaleType: 'band', data: DIAS_SEMANA }] })}
								series={[
									{
										data: horasDia,
										label: 'Horas',
										color: AZUL,
										valueFormatter: (v) => `${v ?? 0} h`,
									},
								]}
								hideLegend
							/>
						</Box>
					</Bloque>
				</>
			)}
		</Box>
	);
}
