import WarningAmberIcon from '@mui/icons-material/WarningAmber';
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

/** `review_reason` es un campo string de Directus (varchar 255). */
export const MAX_RAZON_REVISION = 255;

export interface MarcarRevisionDialogProps {
	open: boolean;
	empleado: string;
	guardando: boolean;
	error: boolean;
	onClose: () => void;
	onConfirmar: (razon: string) => void;
}

/** Confirma el envío a revisión y pide la razón (obligatoria). La marca no se puede deshacer. */
export function MarcarRevisionDialog({
	open,
	empleado,
	guardando,
	error,
	onClose,
	onConfirmar,
}: MarcarRevisionDialogProps) {
	const [razon, setRazon] = useState('');
	const razonLimpia = razon.trim();

	return (
		<Dialog
			open={open}
			onClose={guardando ? undefined : onClose}
			fullWidth
			slotProps={{ paper: { sx: { borderRadius: 3, p: 1, maxWidth: 480 } } }}
		>
			<DialogTitle
				component="div"
				sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 2 }}
			>
				<WarningAmberIcon sx={{ fontSize: 28, color: '#d97706' }} />
				<Typography variant="h6" fontWeight={700} sx={{ color: '#d97706' }}>
					Marcar para revisión
				</Typography>
			</DialogTitle>
			<DialogContent sx={{ py: 1 }}>
				<Typography
					variant="body2"
					sx={{ color: '#0a1929', fontWeight: 500, mb: 1.5 }}
				>
					La marcación de <strong>{empleado}</strong> quedará en revisión.
				</Typography>
				<TextField
					label="Razón"
					placeholder="Ej.: la foto está borrosa o no es la persona"
					value={razon}
					onChange={(e) => setRazon(e.target.value)}
					required
					fullWidth
					multiline
					minRows={3}
					autoFocus
					disabled={guardando}
					helperText={`${razon.length}/${MAX_RAZON_REVISION}`}
					slotProps={{
						htmlInput: { maxLength: MAX_RAZON_REVISION },
						formHelperText: { sx: { textAlign: 'right', mr: 0 } },
					}}
					sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
				/>
				<Alert
					severity={error ? 'error' : 'warning'}
					sx={{
						mt: 1.5,
						borderRadius: 2,
						...(error
							? {}
							: {
									bgcolor: '#fffbe6',
									color: '#0a1929',
									'& .MuiAlert-icon': { color: '#d97706' },
								}),
					}}
				>
					{error
						? 'No se pudo guardar. Intenta de nuevo.'
						: 'Esta acción no se puede deshacer.'}
				</Alert>
			</DialogContent>
			<DialogActions sx={{ px: 3, pb: 2, justifyContent: 'space-between' }}>
				<Button
					onClick={onClose}
					disabled={guardando}
					variant="outlined"
					sx={{
						color: '#004680',
						borderColor: '#004680',
						borderRadius: 2,
						textTransform: 'none',
						fontWeight: 600,
					}}
				>
					Cancelar
				</Button>
				<Button
					variant="contained"
					disabled={!razonLimpia || guardando}
					onClick={() => onConfirmar(razonLimpia)}
					sx={{
						bgcolor: '#004680',
						'&:hover': { bgcolor: '#003366' },
						borderRadius: 2,
						textTransform: 'none',
						fontWeight: 700,
					}}
				>
					{guardando ? (
						<CircularProgress size={20} sx={{ color: '#fff' }} />
					) : (
						'Marcar para revisión'
					)}
				</Button>
			</DialogActions>
		</Dialog>
	);
}
