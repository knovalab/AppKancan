import FileDownloadIcon from '@mui/icons-material/FileDownload';
import {
	Alert,
	Box,
	Button,
	CircularProgress,
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
import { PeriodoEstadoChip } from '../../components/horas-extras/PeriodoEstadoChip';
import { ESTADO_PERIODO, formatoMinutos } from '../../domain/horasExtras';
import { useAvisos } from '../../hooks/useAvisos';
import {
	DIAS_ALERTA_PENDIENTE,
	TODAS_EMPRESAS,
	useReporteTiempoReal,
} from '../../hooks/useReporteHorasExtras';
import { mensajeDeError } from '../../utils/errores';
import { exportarReporteTiempoRealExcel } from '../../utils/exportarReporteHorasExtras';

const fecha = (f: string) => dayjs(f).format('DD/MM/YYYY');
const plural = (n: number, uno: string, varios: string) =>
	`${n} ${n === 1 ? uno : varios}`;
const head = { fontWeight: 700, color: '#1e293b', bgcolor: '#f0f7ff' };

function Tarjeta({
	titulo,
	minutos,
	registros,
	nota,
}: {
	titulo: string;
	minutos: number;
	registros: number;
	nota?: string;
}) {
	return (
		<Box
			sx={{
				flex: 1,
				minWidth: 170,
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
				{formatoMinutos(minutos)}
			</Typography>
			<Typography variant="caption" sx={{ color: '#64748b', display: 'block' }}>
				{plural(registros, 'registro', 'registros')}
			</Typography>
			{nota && (
				<Typography
					variant="caption"
					sx={{ color: '#94a3b8', display: 'block' }}
				>
					{nota}
				</Typography>
			)}
		</Box>
	);
}

/**
 * Reportes → Horas extras → Tiempo real (R1): horas **aprobadas** por periodo
 * (por vincular o liquidadas) con filtro por empresa, alertas y exportación.
 */
export default function ReporteHorasExtrasTab() {
	const { showSnackbar } = useAvisos();
	const [empresa, setEmpresa] = useState(TODAS_EMPRESAS);
	const [tiendaId, setTiendaId] = useState<number | ''>('');
	const [periodoId, setPeriodoId] = useState<number | ''>('');
	const [exportando, setExportando] = useState(false);
	const {
		empresas,
		tiendasEmpresa,
		resumen,
		actual,
		vencidos,
		pendientes,
		isLoading,
		error,
	} = useReporteTiempoReal(empresa, tiendaId === '' ? null : tiendaId);
	const nombreTienda =
		tiendasEmpresa.find((t) => Number(t.id) === tiendaId)?.name ?? '';

	const elegido =
		resumen.find((r) => r.periodo.id === periodoId) ??
		resumen.find((r) => r.periodo.id === actual?.id);
	const liquidado = elegido?.periodo.status === ESTADO_PERIODO.liquidado;

	const exportar = async () => {
		setExportando(true);
		try {
			await exportarReporteTiempoRealExcel(resumen, empresa, nombreTienda);
		} catch (err) {
			showSnackbar(
				mensajeDeError(err, 'Error al exportar el reporte'),
				'error',
			);
		} finally {
			setExportando(false);
		}
	};

	if (isLoading)
		return (
			<Box sx={{ p: 5, textAlign: 'center' }} role="status" aria-live="polite">
				<CircularProgress size={32} sx={{ color: '#004680' }} />
				<Typography variant="body2" sx={{ mt: 1.5, color: '#64748b' }}>
					Cargando reporte de horas extras...
				</Typography>
			</Box>
		);

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
						Horas extras en tiempo real
					</Typography>
					<Typography variant="body2" sx={{ color: '#64748b' }}>
						Solo horas aprobadas (por vincular o liquidadas). Sin la tienda de
						pruebas.
					</Typography>
				</Box>
				<Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5 }}>
					<FormControl size="small" sx={{ minWidth: 180 }}>
						<InputLabel id="rhe-empresa">Empresa</InputLabel>
						<Select
							labelId="rhe-empresa"
							label="Empresa"
							value={empresa}
							onChange={(e) => {
								setEmpresa(e.target.value);
								setTiendaId('');
							}}
						>
							<MenuItem value={TODAS_EMPRESAS}>Todas</MenuItem>
							{empresas.map((e) => (
								<MenuItem key={e} value={e}>
									{e}
								</MenuItem>
							))}
						</Select>
					</FormControl>
					<FormControl size="small" sx={{ minWidth: 200 }}>
						<InputLabel id="rhe-tienda">Tienda</InputLabel>
						<Select
							labelId="rhe-tienda"
							label="Tienda"
							value={tiendaId}
							onChange={(e) => setTiendaId(Number(e.target.value) || '')}
						>
							<MenuItem value="">Todas las tiendas</MenuItem>
							{tiendasEmpresa.map((t) => (
								<MenuItem key={t.id} value={Number(t.id)}>
									{t.name}
								</MenuItem>
							))}
						</Select>
					</FormControl>
					<FormControl size="small" sx={{ minWidth: 240 }}>
						<InputLabel id="rhe-periodo">Periodo</InputLabel>
						<Select
							labelId="rhe-periodo"
							label="Periodo"
							value={elegido?.periodo.id ?? ''}
							onChange={(e) => setPeriodoId(Number(e.target.value))}
						>
							{resumen.map((r) => (
								<MenuItem key={r.periodo.id} value={r.periodo.id}>
									{r.periodo.name || 'Sin nombre'} (
									{fecha(r.periodo.start_date)} al {fecha(r.periodo.end_date)})
								</MenuItem>
							))}
						</Select>
					</FormControl>
					<Button
						variant="outlined"
						startIcon={
							exportando ? <CircularProgress size={16} /> : <FileDownloadIcon />
						}
						onClick={exportar}
						disabled={exportando || resumen.length === 0}
					>
						Exportar a Excel
					</Button>
				</Box>
			</Box>

			{error && (
				<Alert severity="error" sx={{ mb: 2 }}>
					{mensajeDeError(error, 'Error al cargar el reporte de horas extras')}
				</Alert>
			)}
			{vencidos.length > 0 && (
				<Alert severity="warning" sx={{ mb: 1.5 }}>
					{plural(vencidos.length, 'periodo terminó', 'periodos terminaron')} y
					sigue{vencidos.length !== 1 ? 'n' : ''} sin liquidar:{' '}
					{vencidos.map((p) => p.name || fecha(p.end_date)).join(', ')}.
				</Alert>
			)}
			{pendientes.antiguas > 0 && (
				<Alert severity="warning" sx={{ mb: 1.5 }}>
					{plural(
						pendientes.antiguas,
						'hora extra lleva',
						'horas extras llevan',
					)}{' '}
					más de {DIAS_ALERTA_PENDIENTE} días pendiente
					{pendientes.antiguas !== 1 ? 's' : ''} de aprobación.
				</Alert>
			)}

			{!elegido ? (
				<Alert severity="info">Aún no hay periodos creados.</Alert>
			) : (
				<>
					<Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
						<Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
							{elegido.periodo.name || 'Periodo'}: del{' '}
							{fecha(elegido.periodo.start_date)} al{' '}
							{fecha(elegido.periodo.end_date)}
						</Typography>
						<PeriodoEstadoChip estado={elegido.periodo.status} />
					</Box>
					<Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, mb: 3 }}>
						<Tarjeta
							titulo={
								liquidado ? 'Liquidadas del periodo' : 'Aprobadas por vincular'
							}
							minutos={elegido.delPeriodo.minutos}
							registros={elegido.delPeriodo.registros}
						/>
						<Tarjeta
							titulo="Rezagadas"
							minutos={elegido.rezagadas.minutos}
							registros={elegido.rezagadas.registros}
							nota="de periodos anteriores"
						/>
						<Tarjeta
							titulo={liquidado ? 'Total liquidado' : 'Total a liquidar'}
							minutos={elegido.total.minutos}
							registros={elegido.total.registros}
						/>
						<Tarjeta
							titulo="Pendientes de aprobación"
							minutos={pendientes.minutos}
							registros={pendientes.registros}
							nota="no se incluyen"
						/>
					</Box>
				</>
			)}

			{resumen.length > 0 && (
				<TableContainer
					sx={{ borderRadius: 2, border: '1px solid #e2e8f0', bgcolor: '#fff' }}
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
									'Liquidado el',
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
								>
									<TableCell sx={{ fontWeight: 600 }}>
										{r.periodo.name || 'Sin nombre'}
									</TableCell>
									<TableCell sx={{ whiteSpace: 'nowrap' }}>
										{fecha(r.periodo.start_date)} al {fecha(r.periodo.end_date)}
									</TableCell>
									<TableCell>
										<PeriodoEstadoChip estado={r.periodo.status} />
									</TableCell>
									<TableCell>{formatoMinutos(r.delPeriodo.minutos)}</TableCell>
									<TableCell>{formatoMinutos(r.rezagadas.minutos)}</TableCell>
									<TableCell sx={{ fontWeight: 700 }}>
										{formatoMinutos(r.total.minutos)}
									</TableCell>
									<TableCell sx={{ whiteSpace: 'nowrap' }}>
										{r.periodo.liquidacion_at
											? dayjs(r.periodo.liquidacion_at).format(
													'DD/MM/YYYY HH:mm',
												)
											: '--'}
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				</TableContainer>
			)}
		</Box>
	);
}
