import CloseIcon from '@mui/icons-material/Close';
import {
	Alert,
	Box,
	Dialog,
	DialogContent,
	DialogTitle,
	IconButton,
	Tab,
	Table,
	TableBody,
	TableCell,
	TableContainer,
	TableHead,
	TableRow,
	Tabs,
	Typography,
} from '@mui/material';
import dayjs from 'dayjs';
import { type ReactNode, useMemo, useState } from 'react';
import {
	duracionDias,
	ESTADO_PERIODO,
	formatoMinutos,
	resumenPorEmpleado,
} from '../../domain/horasExtras';
import { useHorasExtrasDePeriodo } from '../../hooks/usePeriodos';
import type { PeriodDto } from '../../interfaces/api/period';
import type { HoraExtraFila } from '../../interfaces/horasExtras';
import { mensajeDeError } from '../../utils/errores';
import { formatNombrePropio } from '../../utils/format';
import { aFilaHoraExtra } from '../../utils/horasExtras';
import { extraerNombreUsuario } from '../../utils/registroTienda';
import { HorasExtrasTabla } from './HorasExtrasTabla';
import { PeriodoEstadoChip } from './PeriodoEstadoChip';

const fecha = (f: string) => dayjs(f).format('DD/MM/YYYY');
const celdaHead = { fontWeight: 700, py: 1.5, color: '#1e293b' };

export interface PeriodoDetalleDialogProps {
	periodo: PeriodDto | undefined;
	periodos: readonly PeriodDto[];
	onClose: () => void;
}

function Dato({ label, valor }: { label: string; valor: ReactNode }) {
	return (
		<Box>
			<Typography variant="caption" sx={{ color: '#64748b' }}>
				{label}
			</Typography>
			<Typography variant="body2" component="div" sx={{ fontWeight: 600 }}>
				{valor}
			</Typography>
		</Box>
	);
}

function Bloque({
	titulo,
	filas,
	vacio,
}: {
	titulo: string;
	filas: HoraExtraFila[];
	vacio: string;
}) {
	const minutos = filas.reduce((s, f) => s + f.minutos, 0);
	return (
		<Box sx={{ mb: 3 }}>
			<Typography
				variant="subtitle1"
				sx={{ fontWeight: 700, color: '#004680', mb: 1 }}
			>
				{titulo} · {filas.length} · {formatoMinutos(minutos)}
			</Typography>
			<HorasExtrasTabla filas={filas} vacio={vacio} />
		</Box>
	);
}

/**
 * Detalle de un periodo
 */
export function PeriodoDetalleDialog({
	periodo,
	periodos,
	onClose,
}: PeriodoDetalleDialogProps) {
	const [vista, setVista] = useState<'detalle' | 'resumen'>('detalle');
	const { data, isLoading, error } = useHorasExtrasDePeriodo(periodo, periodos);

	const { delPeriodo, rezagadas } = useMemo(() => {
		if (!data || !periodo) return { delPeriodo: [], rezagadas: [] };
		if (periodo.status !== ESTADO_PERIODO.liquidado)
			return {
				delPeriodo: data.delPeriodo.map(aFilaHoraExtra),
				rezagadas: data.rezagadas.map(aFilaHoraExtra),
			};
		const filas = data.vinculadas.map(aFilaHoraExtra);
		return {
			delPeriodo: filas.filter((f) => f.fecha >= periodo.start_date),
			rezagadas: filas.filter((f) => f.fecha < periodo.start_date),
		};
	}, [data, periodo]);
	const todas = useMemo(
		() => [...delPeriodo, ...rezagadas],
		[delPeriodo, rezagadas],
	);
	const resumen = useMemo(() => resumenPorEmpleado(todas), [todas]);

	if (!periodo) return null;
	const liquidado = periodo.status === ESTADO_PERIODO.liquidado;
	const liquidadoPor =
		periodo.updated_by && typeof periodo.updated_by === 'object'
			? formatNombrePropio(extraerNombreUsuario(periodo.updated_by) ?? '')
			: '';

	return (
		<Dialog
			open
			onClose={onClose}
			fullWidth
			maxWidth="lg"
			aria-labelledby="periodo-titulo"
		>
			<DialogTitle
				id="periodo-titulo"
				sx={{ fontWeight: 700, color: '#004680', pr: 6 }}
			>
				{periodo.name || 'Periodo'}
				<Typography
					variant="body2"
					component="span"
					sx={{ display: 'block', color: '#64748b' }}
				>
					Del {fecha(periodo.start_date)} al {fecha(periodo.end_date)}
				</Typography>
				<IconButton
					aria-label="Cerrar"
					onClick={onClose}
					sx={{ position: 'absolute', right: 12, top: 12 }}
				>
					<CloseIcon />
				</IconButton>
			</DialogTitle>
			<DialogContent dividers>
				<Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 4, mb: 2 }}>
					<Dato
						label="Estado"
						valor={<PeriodoEstadoChip estado={periodo.status} />}
					/>
					<Dato
						label="Duración"
						valor={`${duracionDias(periodo.start_date, periodo.end_date)} días`}
					/>
					<Dato label="Vinculadas" valor={todas.length} />
					<Dato
						label="Total"
						valor={formatoMinutos(todas.reduce((s, f) => s + f.minutos, 0))}
					/>
					<Dato label="Empleados" valor={resumen.length} />
					{liquidado && (
						<Dato
							label="Liquidado"
							valor={`${periodo.liquidacion_at ? dayjs(periodo.liquidacion_at).format('DD/MM/YYYY HH:mm') : '--'}${liquidadoPor ? ` · ${liquidadoPor}` : ''}`}
						/>
					)}
				</Box>

				{!liquidado && (
					<Alert severity="info" sx={{ mb: 2 }}>
						Vista previa: horas aprobadas que se vincularán al liquidar. Se
						recalcula con cada aprobación.
					</Alert>
				)}
				{error && (
					<Alert severity="error" sx={{ mb: 2 }}>
						{mensajeDeError(
							error,
							'Error al cargar las horas extras del periodo',
						)}
					</Alert>
				)}

				<Tabs
					value={vista}
					onChange={(_, v) => setVista(v)}
					sx={{ mb: 2, borderBottom: '1px solid #e2e8f0' }}
				>
					<Tab value="detalle" label="Detalle" />
					<Tab value="resumen" label="Resumen por empleado" />
				</Tabs>

				{isLoading ? (
					<HorasExtrasTabla filas={[]} loading />
				) : vista === 'detalle' ? (
					<>
						<Bloque
							titulo="Del periodo"
							filas={delPeriodo}
							vacio="No hay horas extras aprobadas en este periodo"
						/>
						<Bloque
							titulo="Rezagadas"
							filas={rezagadas}
							vacio="No hay horas extras rezagadas"
						/>
					</>
				) : (
					<TableContainer sx={{ borderRadius: 2, border: '1px solid #e2e8f0' }}>
						<Table aria-label="Resumen por empleado">
							<TableHead sx={{ bgcolor: '#f0f7ff' }}>
								<TableRow>
									{[
										'Empleado',
										'Documento',
										'Tiendas',
										'Horas extras',
										'Total',
									].map((c) => (
										<TableCell key={c} sx={celdaHead}>
											{c}
										</TableCell>
									))}
								</TableRow>
							</TableHead>
							<TableBody>
								{resumen.length === 0 ? (
									<TableRow>
										<TableCell
											colSpan={5}
											align="center"
											sx={{ py: 4, color: '#475569' }}
										>
											Sin horas extras en este periodo
										</TableCell>
									</TableRow>
								) : (
									resumen.map((r) => (
										<TableRow key={r.empleadoId ?? r.documento}>
											<TableCell sx={{ fontWeight: 600 }}>
												{r.empleado}
											</TableCell>
											<TableCell>{r.documento || '--'}</TableCell>
											<TableCell>{r.tiendas.join(', ') || '--'}</TableCell>
											<TableCell>{r.horasExtras}</TableCell>
											<TableCell sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}>
												{formatoMinutos(r.minutos)}
											</TableCell>
										</TableRow>
									))
								)}
							</TableBody>
						</Table>
					</TableContainer>
				)}
			</DialogContent>
		</Dialog>
	);
}
