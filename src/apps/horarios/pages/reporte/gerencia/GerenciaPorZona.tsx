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
import { useState } from 'react';
import { DIAS_SEMANA } from '../../../domain/horasExtras';
import { useZonasGerencia } from '../../../hooks/useReporteGerencia';
import { mensajeDeError } from '../../../utils/errores';
import {
	AZUL,
	Bloque,
	BORDE,
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
} from './bloques';
import { SelectorTiempo, useSelectorTiempo } from './SelectorTiempo';

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
	const telefono = useMediaQuery(useTheme().breakpoints.down('sm'));
	const compacto = useCompacto();
	const [zona, setZona] = useState(TODAS);
	const [verTodas, setVerTodas] = useState(false);
	// Por defecto, el periodo que contiene hoy (o el más reciente).
	const tiempo = useSelectorTiempo(['periodo', 'mes', 'rango']);
	const { desde, hasta, etiqueta: rango } = tiempo;
	const { zonas, reporte, nombreTienda, isLoading, error } = useZonasGerencia(
		zona,
		desde,
		hasta,
		tiempo.listo,
	);

	const elegirZona = (z: string) => {
		setZona(z);
		setVerTodas(false);
	};
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
				<SelectorTiempo selector={tiempo} onCambio={() => setVerTodas(false)} />
			</Filtros>

			{(error || tiempo.error) && (
				<Alert severity="error" sx={{ mb: 2 }}>
					{mensajeDeError(
						error ?? tiempo.error,
						'Error al cargar el reporte por zona',
					)}
				</Alert>
			)}

			{tiempo.cargando || isLoading ? (
				<Cargando />
			) : tiempo.sinPeriodos ? (
				<Alert severity="info">Aún no hay periodos creados.</Alert>
			) : reporte.tiendas.length === 0 ? (
				<Alert severity="info">
					No hay horas aprobadas {zona ? `en ${zona} ` : ''}en {rango}.
				</Alert>
			) : (
				<>
					<Typography variant="body2" sx={{ color: GRIS, mb: 1.5 }}>
						Solo horas aprobadas, por tienda donde se trabajó · {rango}.
					</Typography>
					<Kpis>
						<Kpi
							principal
							titulo={`Horas extras · ${zona || 'todas las zonas'}`}
							valor={horasCortas(reporte.total.minutos)}
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
												{pct(t.porcentaje)}
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
