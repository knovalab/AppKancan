import NoFoodIcon from '@mui/icons-material/NoFood';
import WarningIcon from '@mui/icons-material/Warning';
import {
	Alert,
	Box,
	Button,
	CircularProgress,
	Dialog,
	DialogActions,
	DialogContent,
	DialogTitle,
	Typography,
} from '@mui/material';
import dayjs from 'dayjs';
import { useState } from 'react';
import type { Resultado } from '../../../interfaces/comunes';

interface OmitirAlmuerzoModalProps {
	open: boolean;
	onClose: () => void;
	nombre: string;
	onConfirmar: () => Promise<Resultado>;
}

export function OmitirAlmuerzoModal({
	open,
	onClose,
	nombre,
	onConfirmar,
}: OmitirAlmuerzoModalProps) {
	const [omitiendo, setOmitiendo] = useState(false);

	const confirmar = async () => {
		setOmitiendo(true);
		const resultado = await onConfirmar();
		setOmitiendo(false);
		// Si falla, el modal sigue abierto para reintentar.
		if (resultado.ok) onClose();
	};

	return (
		<Dialog
			open={open}
			onClose={() => {
				if (!omitiendo) onClose();
			}}
			maxWidth="xs"
			fullWidth
			slotProps={{ paper: { sx: { borderRadius: 4 } } }}
		>
			<DialogTitle
				sx={{
					bgcolor: '#004680',
					color: '#fff',
					py: 1.25,
					px: 2.25,
					fontWeight: 700,
					fontSize: '0.95rem',
					display: 'flex',
					alignItems: 'center',
					gap: 1,
				}}
			>
				<NoFoodIcon fontSize="small" />
				<Box>
					<Box>¿El turno no incluye almuerzo?</Box>
					<Box
						sx={{
							fontSize: '0.7rem',
							fontWeight: 500,
							opacity: 0.85,
							textTransform: 'capitalize',
						}}
					>
						{nombre}
					</Box>
				</Box>
			</DialogTitle>
			<DialogContent dividers sx={{ px: 2.25, py: 1.75 }}>
				<Typography
					sx={{
						fontSize: '0.85rem',
						color: '#475569',
						lineHeight: 1.55,
						mb: 1.5,
					}}
				>
					Al confirmar, las casillas de <strong>INICIAR ALMUERZO</strong> y{' '}
					<strong>FINALIZAR ALMUERZO</strong> serán marcadas automáticamente
					para la fecha <strong>{dayjs().format('DD/MM/YYYY')}</strong>.
				</Typography>
				<Alert
					severity="warning"
					icon={<WarningIcon sx={{ fontSize: 20 }} />}
					sx={{
						borderRadius: 1.75,
						fontSize: '0.85rem',
						py: 0.375,
						alignItems: 'center',
						'& .MuiAlert-message': { py: 0.5 },
					}}
				>
					Una vez confirmada, esta opción solo se puede revertir llamando a
					soporte/sistemas.
				</Alert>
			</DialogContent>
			<DialogActions sx={{ px: 2.25, py: 1.5, gap: 1 }}>
				<Button
					onClick={onClose}
					disabled={omitiendo}
					variant="outlined"
					size="small"
					sx={{
						color: '#475569',
						borderColor: '#cbd5e1',
						fontSize: '0.78rem',
						'&:hover': { borderColor: '#94a3b8', bgcolor: '#f1f5f9' },
					}}
				>
					Cancelar
				</Button>
				<Button
					onClick={confirmar}
					variant="contained"
					size="small"
					disabled={omitiendo}
					startIcon={
						omitiendo ? (
							<CircularProgress size={14} sx={{ color: '#fff' }} />
						) : undefined
					}
					sx={{ bgcolor: '#004680', fontSize: '0.78rem' }}
				>
					{omitiendo ? 'Registrando…' : 'Confirmar'}
				</Button>
			</DialogActions>
		</Dialog>
	);
}
