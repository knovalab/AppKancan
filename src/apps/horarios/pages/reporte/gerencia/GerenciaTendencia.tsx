import {
	Alert,
	Box,
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
import { LineChart } from '@mui/x-charts/LineChart';
import dayjs, { type Dayjs } from 'dayjs';
import { useMemo, useState } from 'react';
import DateRangeFilter from '../../../components/reportes/DateRangeFilter';
import { DIAS_SEMANA, tendenciaPorPeriodo } from '../../../domain/horasExtras';
import {
	useTiempoRealGerencia,
	useZonasGerencia,
} from '../../../hooks/useReporteGerencia';
import { TODAS_EMPRESAS } from '../../../hooks/useReporteHorasExtras';
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
	Tarjeta,
	Tarjetas,
	useCompacto,
} from './bloques';

/** Periodos que muestra la tendencia. */
const PERIODOS = 8;
// Una serie por zona además del total (escritorio).
const COLORES = [
	'#0ea5e9',
	'#f59e0b',
	'#10b981',
	'#8b5cf6',
	'#ef4444',
	'#64748b',
];
const nombreZona = (z: string | null) => z ?? 'Sin zona';
const enHoras = (m: number) => Math.round((m / 60) * 10) / 10;

/**
 * Tendencia de gerencia (RP4): ¿va subiendo? Horas por periodo (total y por zona)
 * y mapa de calor día de la semana × zona del rango. En teléfono y tablet, la
 * línea solo lleva el total y el mapa se ve como tarjetas con el día más cargado.
 */
export default function GerenciaTendencia() {
	const hoy = getRealColombiaTime();
	const telefono = useMediaQuery(useTheme().breakpoints.down('sm'));
	const compacto = useCompacto();
	const [fechaInicio, setFechaInicio] = useState<Dayjs | null>(() =>
		hoy.startOf('month'),
	);
	const [fechaFin, setFechaFin] = useState<Dayjs | null>(() => hoy);
	const desde = (fechaInicio ?? hoy.startOf('year')).format('YYYY-MM-DD');
	const hasta = (fechaFin ?? hoy).format('YYYY-MM-DD');
	const rango = `${dayjs(desde).format('DD/MM')} al ${dayjs(hasta).format('DD/MM')}`;

	const periodos = useTiempoRealGerencia(TODAS_EMPRESAS);
	const zonas = useZonasGerencia('', desde, hasta);
	const tendencia = useMemo(
		() => tendenciaPorPeriodo(periodos.resumen, periodos.zonaDe, PERIODOS),
		[periodos.resumen, periodos.zonaDe],
	);
	const nombresZonas = useMemo(
		() =>
			[...new Set(tendencia.flatMap((p) => [...p.porZona.keys()]))].sort(
				(a, b) => nombreZona(a).localeCompare(nombreZona(b), 'es'),
			),
		[tendencia],
	);
	const calor = zonas.reporte.zonas;
	const maxCalor = Math.max(1, ...calor.flatMap((z) => z.porDiaSemana));
	const error = periodos.error ?? zonas.error;

	return (
		<Box>
			<Filtros resumen={`Mapa de calor · ${rango}`}>
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
					{mensajeDeError(error, 'Error al cargar la tendencia')}
				</Alert>
			)}

			{periodos.isLoading ? (
				<Cargando />
			) : (
				<Bloque titulo="¿Van subiendo las horas por periodo?">
					{tendencia.length === 0 ? (
						<Alert severity="info">Aún no hay periodos creados.</Alert>
					) : (
						<Box
							sx={{
								p: { xs: 1, sm: 2 },
								borderRadius: 2,
								border: BORDE,
								bgcolor: '#f8fafc',
							}}
						>
							<LineChart
								height={telefono ? 220 : 280}
								xAxis={[
									{
										scaleType: 'point',
										data: tendencia.map(
											(p) =>
												p.periodo.name ||
												dayjs(p.periodo.start_date).format('DD/MM'),
										),
									},
								]}
								series={[
									{
										data: tendencia.map((p) => enHoras(p.minutos)),
										label: 'Total',
										color: AZUL,
										valueFormatter: (v) => `${v ?? 0} h`,
									},
									...(compacto
										? []
										: nombresZonas.map((z, i) => ({
												data: tendencia.map((p) =>
													enHoras(p.porZona.get(z) ?? 0),
												),
												label: nombreZona(z),
												color: COLORES[i % COLORES.length],
												valueFormatter: (v: number | null) => `${v ?? 0} h`,
											}))),
								]}
								hideLegend={compacto}
							/>
							<Typography variant="caption" sx={{ color: GRIS }}>
								Últimos {PERIODOS} periodos, solo horas aprobadas. Un
								preliquidado aún puede sumar horas.
							</Typography>
						</Box>
					)}
				</Bloque>
			)}

			{zonas.isLoading ? (
				<Cargando />
			) : (
				<Bloque titulo="¿Qué días y dónde se concentran las horas?">
					{calor.length === 0 ? (
						<Alert severity="info">No hay horas aprobadas del {rango}.</Alert>
					) : compacto ? (
						<Tarjetas>
							{calor.map((z) => {
								const max = Math.max(...z.porDiaSemana);
								const dia = DIAS_SEMANA[z.porDiaSemana.indexOf(max)];
								return (
									<Tarjeta key={nombreZona(z.zona)}>
										<Typography sx={{ fontWeight: 700 }}>
											{nombreZona(z.zona)}
										</Typography>
										<Typography variant="body2" sx={{ color: GRIS }}>
											Día más cargado:{' '}
											<Box component="strong" sx={{ color: AZUL }}>
												{dia} · {horasCortas(max)}
											</Box>
										</Typography>
										<Typography variant="caption" sx={{ color: '#94a3b8' }}>
											{horasCortas(z.minutos)} en el rango
										</Typography>
									</Tarjeta>
								);
							})}
						</Tarjetas>
					) : (
						<TableContainer
							sx={{ borderRadius: 2, border: BORDE, bgcolor: '#fff' }}
						>
							<Table
								size="small"
								aria-label="Horas por zona y día de la semana"
							>
								<TableHead>
									<TableRow>
										{['Zona', ...DIAS_SEMANA].map((c) => (
											<TableCell
												key={c}
												sx={{
													fontWeight: 700,
													color: '#1e293b',
													bgcolor: '#f0f7ff',
												}}
											>
												{c}
											</TableCell>
										))}
									</TableRow>
								</TableHead>
								<TableBody>
									{calor.map((z) => (
										<TableRow key={nombreZona(z.zona)}>
											<TableCell sx={{ fontWeight: 600 }}>
												{nombreZona(z.zona)}
											</TableCell>
											{z.porDiaSemana.map((m, i) => (
												<TableCell
													key={DIAS_SEMANA[i]}
													// La intensidad acompaña al número: el valor siempre se lee.
													sx={{
														bgcolor: `rgba(0, 70, 128, ${(0.08 + (m / maxCalor) * 0.72).toFixed(2)})`,
														color: m / maxCalor > 0.5 ? '#fff' : '#1e293b',
														fontWeight: 600,
														textAlign: 'center',
													}}
												>
													{m ? horasCortas(m) : '--'}
												</TableCell>
											))}
										</TableRow>
									))}
								</TableBody>
							</Table>
						</TableContainer>
					)}
				</Bloque>
			)}
		</Box>
	);
}
