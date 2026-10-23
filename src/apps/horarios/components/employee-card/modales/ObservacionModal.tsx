import {
	Alert,
	Button,
	Dialog,
	DialogActions,
	DialogContent,
	DialogTitle,
	Divider,
	TextField,
	Typography,
} from '@mui/material';
import { useState } from 'react';
import {
	type LogType,
	MAX_CARACTERES_OBSERVACION,
} from '../../../domain/registro';
import type { Resultado } from '../../../interfaces/comunes';

interface ObservacionModalProps {
	open: boolean;
	onClose: () => void;
	marcacion: LogType;
	nombre: string;
	/** Observación guardada (estado inicial del campo). */
	inicial: string;
	onGuardar: (texto: string) => Promise<Resultado>;
}

/** Se monta con `key` en cada apertura: el estado arranca limpio sin resets manuales. */
export function ObservacionModal({
	open,
	onClose,
	marcacion,
	nombre,
	inicial,
	onGuardar,
}: ObservacionModalProps) {
	const [texto, setTexto] = useState(inicial);
	const [guardando, setGuardando] = useState(false);
	const max = MAX_CARACTERES_OBSERVACION;

	const guardar = async () => {
		setGuardando(true);
		const resultado = await onGuardar(texto);
		setGuardando(false);
		// Solo se cierra si se guardó (E1); si no, el error está en el snackbar.
		if (resultado.ok) onClose();
	};

	return (
		<Dialog
			open={open}
			onClose={onClose}
			maxWidth="sm"
			fullWidth
			slotProps={{ paper: { sx: { borderRadius: 4 } } }}
		>
			<DialogTitle
				component="div"
				sx={{ bgcolor: '#004680', color: '#fff', py: 2, px: 3 }}
			>
				<Typography
					component="span"
					variant="h6"
					sx={{ fontWeight: 600, display: 'block' }}
				>
					Observaciones del evento
				</Typography>
				<Typography
					component="span"
					variant="caption"
					sx={{ opacity: 0.8, display: 'block', mt: 0.5 }}
				>
					{marcacion} • {nombre}
				</Typography>
			</DialogTitle>
			<Divider />
			<DialogContent sx={{ p: 3 }}>
				<Alert
					severity="info"
					sx={{ mb: 2, borderRadius: 2, fontSize: '0.8rem' }}
				>
					Registre o edite la nota. Máximo {max} caracteres.
				</Alert>
				<TextField
					fullWidth
					multiline
					rows={5}
					placeholder="Escriba aquí la observación..."
					value={texto}
					onChange={(e) => setTexto(e.target.value.slice(0, max))}
					helperText={`${texto.length}/${max} caracteres`}
					slotProps={{
						formHelperText: {
							sx: { textAlign: 'right', mt: 1, fontWeight: 500 },
						},
					}}
				/>
			</DialogContent>
			<DialogActions sx={{ p: 3, gap: 2, bgcolor: '#f8fafc' }}>
				<Button
					onClick={onClose}
					variant="outlined"
					sx={{
						borderRadius: 2,
						px: 3,
						fontWeight: 600,
						color: '#475569',
						borderColor: '#cbd5e1',
						'&:hover': { borderColor: '#94a3b8', bgcolor: '#f1f5f9' },
					}}
				>
					Cancelar
				</Button>
				<Button
					onClick={guardar}
					variant="contained"
					disabled={texto === inicial || guardando}
					sx={{ bgcolor: '#004680', borderRadius: 2, px: 4, fontWeight: 600 }}
				>
					Guardar
				</Button>
			</DialogActions>
		</Dialog>
	);
}
