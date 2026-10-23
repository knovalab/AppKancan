import {
	Button,
	CircularProgress,
	Dialog,
	DialogActions,
	DialogContent,
	DialogTitle,
	FormControl,
	InputLabel,
	MenuItem,
	Select,
	TextField,
	Typography,
} from '@mui/material';
import { useState } from 'react';
import {
	EVENTOS_REPORTABLES,
	type EventoTipo,
	MAX_CARACTERES_OBSERVACION,
} from '../../../domain/registro';
import type { Resultado } from '../../../interfaces/comunes';

interface EventoModalProps {
	open: boolean;
	onClose: () => void;
	nombre: string;
	onGuardar: (input: {
		tipo: EventoTipo;
		observacion: string;
	}) => Promise<Resultado>;
}

export function EventoModal({
	open,
	onClose,
	nombre,
	onGuardar,
}: EventoModalProps) {
	const [tipo, setTipo] = useState<EventoTipo | ''>(
		EVENTOS_REPORTABLES[0] ?? '',
	);
	const [observacion, setObservacion] = useState('');
	const [error, setError] = useState('');
	const [guardando, setGuardando] = useState(false);

	const cerrar = () => {
		if (!guardando) onClose();
	};

	const guardar = async () => {
		if (!tipo) {
			setError('Selecciona un evento');
			return;
		}
		setGuardando(true);
		try {
			const resultado = await onGuardar({ tipo, observacion });
			if (resultado.ok) onClose();
		} finally {
			setGuardando(false);
		}
	};

	return (
		<Dialog
			open={open}
			onClose={cerrar}
			maxWidth="xs"
			fullWidth
			slotProps={{ paper: { sx: { borderRadius: 4 } } }}
		>
			<DialogTitle
				sx={{
					bgcolor: '#004680',
					color: '#fff',
					py: 2,
					px: 3,
					fontWeight: 700,
				}}
			>
				Reporta un evento
			</DialogTitle>
			<DialogContent dividers sx={{ p: 3 }}>
				<Typography sx={{ fontSize: '0.85rem', color: '#475569', mb: 2 }}>
					Escoja la novedad presentada para {nombre}:
				</Typography>
				<FormControl fullWidth error={!!error}>
					<InputLabel id="evento-select-label">Evento</InputLabel>
					<Select
						labelId="evento-select-label"
						value={tipo}
						label="Evento"
						onChange={(e) => {
							setTipo(e.target.value as EventoTipo);
							setError('');
						}}
					>
						{EVENTOS_REPORTABLES.map((ev) => (
							<MenuItem key={ev} value={ev}>
								{ev}
							</MenuItem>
						))}
					</Select>
					{error && (
						<Typography
							variant="caption"
							color="error"
							sx={{ mt: 0.5, ml: 1.5 }}
						>
							{error}
						</Typography>
					)}
				</FormControl>
				<TextField
					label="Observaciones"
					multiline
					rows={3}
					fullWidth
					value={observacion}
					onChange={(e) =>
						setObservacion(e.target.value.slice(0, MAX_CARACTERES_OBSERVACION))
					}
					placeholder="Detalle adicional (opcional)..."
					helperText={`${observacion.length}/${MAX_CARACTERES_OBSERVACION} caracteres`}
					slotProps={{ formHelperText: { sx: { textAlign: 'right' } } }}
					sx={{ mt: 2.5 }}
				/>
			</DialogContent>
			<DialogActions sx={{ p: 2, gap: 1 }}>
				<Button
					onClick={cerrar}
					disabled={guardando}
					variant="outlined"
					sx={{
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
					disabled={guardando}
					startIcon={
						guardando ? (
							<CircularProgress size={16} sx={{ color: '#fff' }} />
						) : undefined
					}
					sx={{ bgcolor: '#004680' }}
				>
					{guardando ? 'Guardando…' : 'Guardar'}
				</Button>
			</DialogActions>
		</Dialog>
	);
}
