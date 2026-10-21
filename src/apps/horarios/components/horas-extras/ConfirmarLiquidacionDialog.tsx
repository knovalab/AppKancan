import {
	Alert,
	Box,
	Button,
	CircularProgress,
	Dialog,
	DialogActions,
	DialogContent,
	DialogTitle,
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableRow,
	Typography,
} from '@mui/material';
import { formatoMinutos, resumenPorEmpleado } from '../../domain/horasExtras';
import type { HoraExtraFila } from '../../interfaces/horasExtras';

/** Diferencia entre lo que se veía en pantalla y lo recalculado justo antes de liquidar. */
export interface CambiosPreliquidacion {
	nuevas: number;
	retiradas: number;
}

export interface ConfirmarLiquidacionDialogProps {
	open: boolean;
	/** Nombre del periodo (o "Periodo"). */
	nombre: string;
	/** "Del DD/MM/YYYY al DD/MM/YYYY". */
	rango: string;
	delPeriodo: HoraExtraFila[];
	rezagadas: HoraExtraFila[];
	cambios: CambiosPreliquidacion | null;
	guardando: boolean;
	onClose: () => void;
	onConfirmar: () => void;
}

const suma = (filas: HoraExtraFila[]) =>
	filas.reduce((s, f) => s + f.minutos, 0);
const plural = (n: number, uno: string, varios: string) =>
	`${n} ${n === 1 ? uno : varios}`;
const celdaHead = { fontWeight: 700, color: '#475569', py: 1 };

export function ConfirmarLiquidacionDialog({
	open,
	nombre,
	rango,
	delPeriodo,
	rezagadas,
	cambios,
	guardando,
	onClose,
	onConfirmar,
}: ConfirmarLiquidacionDialogProps) {
	const todas = [...delPeriodo, ...rezagadas];
	const personas = resumenPorEmpleado(todas).length;
	const hayCambios = !!cambios && (cambios.nuevas > 0 || cambios.retiradas > 0);
	const filas = [
		{ label: 'Del periodo', horas: delPeriodo },
		{ label: 'Rezagadas', horas: rezagadas },
	];
	return (
		<Dialog
			open={open}
			onClose={guardando ? undefined : onClose}
			fullWidth
			maxWidth="sm"
		>
			<DialogTitle sx={{ fontWeight: 700, color: '#004680' }}>
				Liquidar periodo
				<Typography variant="body2" sx={{ color: '#64748b' }}>
					{nombre}
				</Typography>
				<Typography variant="body2" sx={{ color: '#64748b' }}>
					{rango}
				</Typography>
			</DialogTitle>
			<DialogContent dividers>
				{hayCambios && (
					<Alert severity="warning" sx={{ mb: 2 }}>
						La preliquidación cambió desde que abriste el periodo:{' '}
						{plural(cambios.nuevas, 'hora extra nueva', 'horas extras nuevas')}{' '}
						y {plural(cambios.retiradas, 'retirada', 'retiradas')}. Revisa el
						resumen antes de confirmar.
					</Alert>
				)}
				<Table size="small" aria-label="Resumen de la liquidación">
					<TableHead>
						<TableRow>
							<TableCell sx={celdaHead} />
							<TableCell sx={celdaHead} align="right">
								Vinculadas
							</TableCell>
							<TableCell sx={celdaHead} align="right">
								Tiempo
							</TableCell>
						</TableRow>
					</TableHead>
					<TableBody>
						{filas.map((f) => (
							<TableRow key={f.label}>
								<TableCell sx={{ color: '#475569' }}>{f.label}</TableCell>
								<TableCell align="right">{f.horas.length}</TableCell>
								<TableCell align="right">
									{formatoMinutos(suma(f.horas))}
								</TableCell>
							</TableRow>
						))}
						<TableRow sx={{ '& td': { fontWeight: 700, borderBottom: 0 } }}>
							<TableCell>Total a vincular</TableCell>
							<TableCell align="right">{todas.length}</TableCell>
							<TableCell align="right">{formatoMinutos(suma(todas))}</TableCell>
						</TableRow>
					</TableBody>
				</Table>
				<Box sx={{ mt: 1.5, px: 2 }}>
					<Typography variant="body2" sx={{ color: '#475569' }}>
						Personas con horas extras: <strong>{personas}</strong>
					</Typography>
				</Box>
				{todas.length === 0 && (
					<Alert severity="info" sx={{ mt: 2 }}>
						No hay horas extras aprobadas para vincular: el periodo se cerrará
						vacío.
					</Alert>
				)}
				<Alert severity="error" sx={{ mt: 2 }}>
					Liquidar <strong>no se puede deshacer</strong>: el periodo y sus horas
					extras quedarán solo para consulta.
				</Alert>
			</DialogContent>
			<DialogActions sx={{ px: 3, py: 2 }}>
				<Button onClick={onClose} disabled={guardando}>
					Cancelar
				</Button>
				<Button
					variant="contained"
					color="error"
					onClick={onConfirmar}
					disabled={guardando}
					startIcon={guardando ? <CircularProgress size={16} /> : undefined}
				>
					Liquidar
				</Button>
			</DialogActions>
		</Dialog>
	);
}
