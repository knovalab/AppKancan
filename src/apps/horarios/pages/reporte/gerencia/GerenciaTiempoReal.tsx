import {
	Alert,
	Box,
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
} from '@mui/material';
import dayjs from 'dayjs';
import { useState } from 'react';
import { PeriodoEstadoChip } from '../../../components/horas-extras/PeriodoEstadoChip';
import { ESTADO_PERIODO, formatoMinutos } from '../../../domain/horasExtras';
import { useTiempoRealGerencia } from '../../../hooks/useReporteGerencia';
import { TODAS_EMPRESAS } from '../../../hooks/useReporteHorasExtras';
import { mensajeDeError } from '../../../utils/errores';
import {
	Bloque,
	BORDE,
	Cargando,
	Filtros,
	GRIS,
	horasCortas,
	Kpi,
	Kpis,
	TACTIL,
	Tarjeta,
	Tarjetas,
	useCompacto,
} from './bloques';

const fecha = (f: string) => dayjs(f).format('DD/MM/YYYY');
const corta = (f: string) => dayjs(f).format('DD/MM');
const head = { fontWeight: 700, color: '#1e293b', bgcolor: '#f0f7ff' };
const selector = {
	minWidth: { sm: 200 },
	'& .MuiInputBase-root': { minHeight: TACTIL },
};

/**
 * Tiempo real de gerencia: cómo va cada periodo (preliquidado o liquidado), sin
 * alertas operativas ni descargas. Tarjetas en teléfono y tablet; tabla en escritorio.
 */
export default function GerenciaTiempoReal() {
	const [empresa, setEmpresa] = useState(TODAS_EMPRESAS);
	const [periodoId, setPeriodoId] = useState<number | ''>('');
	const compacto = useCompacto();
	const { empresas, resumen, actual, pendientes, isLoading, error } =
		useTiempoRealGerencia(empresa);

	const elegido =
		resumen.find((r) => r.periodo.id === periodoId) ??
		resumen.find((r) => r.periodo.id === actual?.id);
	const liquidado = elegido?.periodo.status === ESTADO_PERIODO.liquidado;
	const nombre = (p: { name?: string | null }) => p.name || 'Sin nombre';

	if (isLoading) return <Cargando />;

	return (
		<Box>
			<Filtros
				resumen={`${empresa || 'Todas las empresas'} · ${elegido ? nombre(elegido.periodo) : 'Sin periodo'}`}
			>
				<FormControl size="small" fullWidth sx={selector}>
					<InputLabel id="grt-empresa">Empresa</InputLabel>
					<Select
						labelId="grt-empresa"
						label="Empresa"
						value={empresa}
						onChange={(e) => setEmpresa(e.target.value)}
					>
						<MenuItem value={TODAS_EMPRESAS}>Todas</MenuItem>
						{empresas.map((e) => (
							<MenuItem key={e} value={e}>
								{e}
							</MenuItem>
						))}
					</Select>
				</FormControl>
				<FormControl
					size="small"
					fullWidth
					sx={{ ...selector, minWidth: { sm: 260 } }}
				>
					<InputLabel id="grt-periodo">Periodo</InputLabel>
					<Select
						labelId="grt-periodo"
						label="Periodo"
						value={elegido?.periodo.id ?? ''}
						onChange={(e) => setPeriodoId(Number(e.target.value))}
					>
						{resumen.map((r) => (
							<MenuItem key={r.periodo.id} value={r.periodo.id}>
								{nombre(r.periodo)} ({corta(r.periodo.start_date)} al{' '}
								{corta(r.periodo.end_date)})
							</MenuItem>
						))}
					</Select>
				</FormControl>
			</Filtros>

			{error && (
				<Alert severity="error" sx={{ mb: 2 }}>
					{mensajeDeError(error, 'Error al cargar el reporte de horas extras')}
				</Alert>
			)}

			{!elegido ? (
				<Alert severity="info">Aún no hay periodos creados.</Alert>
			) : (
				<>
					<Box
						sx={{
							display: 'flex',
							flexWrap: 'wrap',
							alignItems: 'center',
							gap: 1,
							mb: 1.5,
						}}
					>
						<Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
							{nombre(elegido.periodo)}
						</Typography>
						<PeriodoEstadoChip estado={elegido.periodo.status} />
						<Typography variant="body2" sx={{ color: GRIS, width: '100%' }}>
							Del {fecha(elegido.periodo.start_date)} al{' '}
							{fecha(elegido.periodo.end_date)} · solo horas aprobadas
						</Typography>
					</Box>
					<Kpis>
						<Kpi
							principal
							titulo={liquidado ? 'Total liquidado' : 'Total a liquidar'}
							valor={horasCortas(elegido.total.minutos)}
						/>
						<Kpi
							titulo={liquidado ? 'Del periodo' : 'Aprobadas por vincular'}
							valor={horasCortas(elegido.delPeriodo.minutos)}
						/>
						<Kpi
							titulo="Rezagadas"
							valor={horasCortas(elegido.rezagadas.minutos)}
							nota="de periodos anteriores"
						/>
						<Kpi
							titulo="Pendientes de aprobación"
							valor={horasCortas(pendientes.minutos)}
							nota="no se incluyen"
						/>
					</Kpis>
				</>
			)}

			{resumen.length > 0 && (
				<Bloque titulo="¿Cómo van los periodos?">
					{compacto ? (
						<Tarjetas>
							{resumen.map((r) => (
								<Tarjeta
									key={r.periodo.id}
									onClick={() => setPeriodoId(r.periodo.id)}
									seleccionada={r.periodo.id === elegido?.periodo.id}
									etiqueta={`${nombre(r.periodo)}, ${horasCortas(r.total.minutos)}`}
								>
									<Box
										sx={{
											display: 'flex',
											justifyContent: 'space-between',
											alignItems: 'center',
											gap: 1,
										}}
									>
										<Typography sx={{ fontWeight: 700 }} noWrap>
											{nombre(r.periodo)}
										</Typography>
										<PeriodoEstadoChip estado={r.periodo.status} />
									</Box>
									<Box
										sx={{
											display: 'flex',
											justifyContent: 'space-between',
											alignItems: 'baseline',
										}}
									>
										<Typography variant="body2" sx={{ color: GRIS }}>
											{corta(r.periodo.start_date)} al{' '}
											{corta(r.periodo.end_date)}
										</Typography>
										<Typography sx={{ fontWeight: 700, fontSize: 18 }}>
											{horasCortas(r.total.minutos)}
										</Typography>
									</Box>
									<Typography variant="caption" sx={{ color: '#94a3b8' }}>
										Rezagadas {horasCortas(r.rezagadas.minutos)}
									</Typography>
								</Tarjeta>
							))}
						</Tarjetas>
					) : (
						<TableContainer
							sx={{ borderRadius: 2, border: BORDE, bgcolor: '#fff' }}
						>
							<Table size="small" aria-label="Horas extras por periodo">
								<TableHead>
									<TableRow>
										{[
											'Periodo',
											'Fechas',
											'Estado',
											'Horas del periodo',
											'Rezagadas',
											'Total',
										].map((c) => (
											<TableCell key={c} sx={head}>
												{c}
											</TableCell>
										))}
									</TableRow>
								</TableHead>
								<TableBody>
									{resumen.map((r) => (
										<TableRow
											key={r.periodo.id}
											hover
											selected={r.periodo.id === elegido?.periodo.id}
											onClick={() => setPeriodoId(r.periodo.id)}
											sx={{ cursor: 'pointer' }}
										>
											<TableCell sx={{ fontWeight: 600 }}>
												{nombre(r.periodo)}
											</TableCell>
											<TableCell sx={{ whiteSpace: 'nowrap' }}>
												{fecha(r.periodo.start_date)} al{' '}
												{fecha(r.periodo.end_date)}
											</TableCell>
											<TableCell>
												<PeriodoEstadoChip estado={r.periodo.status} />
											</TableCell>
											<TableCell>
												{formatoMinutos(r.delPeriodo.minutos)}
											</TableCell>
											<TableCell>
												{formatoMinutos(r.rezagadas.minutos)}
											</TableCell>
											<TableCell sx={{ fontWeight: 700 }}>
												{formatoMinutos(r.total.minutos)}
											</TableCell>
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
