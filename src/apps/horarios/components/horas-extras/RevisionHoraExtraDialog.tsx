import {
	Alert,
	Button,
	CircularProgress,
	Dialog,
	DialogActions,
	DialogContent,
	DialogTitle,
	TextField,
	Typography,
} from '@mui/material';
import { useState } from 'react';
import { formatoMinutos } from '../../domain/horasExtras';
import { MAX_CARACTERES_OBSERVACION } from '../../domain/registro';
import type { HoraExtraFila } from '../../interfaces/horasExtras';

export type DecisionRevision = 'aprobada' | 'descartada_comercial';

export interface RevisionHoraExtraDialogProps {
	/** `null` = cerrado. */
	decision: DecisionRevision | null;
	filas: HoraExtraFila[];
	guardando: boolean;
	onClose: () => void;
	onConfirmar: (nota: string) => void;
}

export function RevisionHoraExtraDialog({
	decision,
	filas,
	guardando,
	onClose,
	onConfirmar,
}: RevisionHoraExtraDialogProps) {
	const [nota, setNota] = useState('');
	const [error, setError] = useState('');
	const rechazar = decision === 'descartada_comercial';
	const total = filas.reduce((s, f) => s + f.minutos, 0);
	const quien =
		filas.length === 1
			? `${filas[0].empleado} · ${formatoMinutos(filas[0].minutos)}`
			: `${filas.length} registros vinculados · ${formatoMinutos(total)} en total`;

	const confirmar = () => {
		if (rechazar && !nota.trim()) {
			setError('El motivo del rechazo es obligatorio');
			return;
		}
		if (nota.length > MAX_CARACTERES_OBSERVACION) {
			setError(`Máximo ${MAX_CARACTERES_OBSERVACION} caracteres`);
			return;
		}
		onConfirmar(nota.trim());
	};

	return (
		<Dialog
			open={decision != null}
			onClose={guardando ? undefined : onClose}
			fullWidth
			maxWidth="sm"
		>
			<DialogTitle
				sx={{ fontWeight: 700, color: rechazar ? '#991b1b' : '#065f46' }}
			>
				{rechazar ? 'Rechazar horas extras' : 'Aprobar horas extras'}
				<Typography variant="body2" sx={{ color: '#64748b' }}>
					{quien}
				</Typography>
			</DialogTitle>
			<DialogContent dividers>
				{rechazar ? (
					<TextField
						label="Motivo del rechazo"
						value={nota}
						onChange={(e) => {
							setNota(e.target.value);
							setError('');
						}}
						multiline
						minRows={3}
						fullWidth
						autoFocus
						error={!!error}
						helperText={error || `${nota.length}/${MAX_CARACTERES_OBSERVACION}`}
					/>
				) : (
					<Alert severity="info">
						Al aprobar, las horas extras quedan en estado <b>Aprobada</b> y ya
						no se pueden modificar.
					</Alert>
				)}
			</DialogContent>
			<DialogActions sx={{ px: 3, py: 2 }}>
				<Button onClick={onClose} disabled={guardando}>
					Cancelar
				</Button>
				<Button
					variant="contained"
					color={rechazar ? 'error' : 'success'}
					onClick={confirmar}
					disabled={guardando}
					startIcon={guardando ? <CircularProgress size={16} /> : undefined}
				>
					{rechazar ? 'Rechazar' : 'Aprobar'}
				</Button>
			</DialogActions>
		</Dialog>
	);
}
