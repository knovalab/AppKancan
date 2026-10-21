import {
	Box,
	Button,
	CircularProgress,
	Dialog,
	DialogActions,
	DialogContent,
	DialogTitle,
	TextField,
	ToggleButton,
	ToggleButtonGroup,
	Typography,
} from '@mui/material';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { crearPeriodo } from '../../api/directus/periodos';
import {
	DIAS_RAPIDOS,
	duracionDias,
	type ErroresPeriodo,
	finPorDias,
	MAX_CARACTERES_NOMBRE_PERIODO,
	siguienteInicio,
	validarPeriodo,
} from '../../domain/horasExtras';
import { horariosKeys } from '../../hooks/registro/keys';
import { useAvisos } from '../../hooks/useAvisos';
import type { PeriodDto } from '../../interfaces/api/period';
import { mensajeDeError } from '../../utils/errores';
import { getRealColombiaTime } from '../../utils/timeSync';

export interface CrearPeriodoModalProps {
	open: boolean;
	periodos: readonly PeriodDto[];
	onClose: () => void;
}

const FECHA = /^\d{4}-\d{2}-\d{2}$/;

/** Crea un periodo: inicio fijo (sin huecos) salvo el primero; fin libre o por acceso rápido. */
export function CrearPeriodoModal({
	open,
	periodos,
	onClose,
}: CrearPeriodoModalProps) {
	const queryClient = useQueryClient();
	const { showSnackbar } = useAvisos();
	const fijo = siguienteInicio(periodos);
	const [inicio, setInicio] = useState(
		() => fijo ?? getRealColombiaTime().format('YYYY-MM-DD'),
	);
	const [fin, setFin] = useState(() =>
		finPorDias(fijo ?? getRealColombiaTime().format('YYYY-MM-DD'), 15),
	);
	const [nombre, setNombre] = useState('');
	const [errores, setErrores] = useState<ErroresPeriodo>({});

	const guardar = useMutation({
		mutationFn: crearPeriodo,
		onSuccess: () => {
			void queryClient.invalidateQueries({ queryKey: horariosKeys.periodos });
			showSnackbar('Periodo creado', 'success');
			onClose();
		},
		onError: (err) => {
			// Otro usuario pudo crear uno entre medias: refrescar el inicio esperado.
			void queryClient.invalidateQueries({ queryKey: horariosKeys.periodos });
			showSnackbar(mensajeDeError(err, 'Error al crear el periodo'), 'error');
		},
	});

	const valido = FECHA.test(inicio) && FECHA.test(fin) && fin >= inicio;
	const dias = valido ? duracionDias(inicio, fin) : null;
	const rapido = DIAS_RAPIDOS.find((n) => valido && dias === n) ?? null;

	const enviar = () => {
		const e = validarPeriodo({ inicio, fin, nombre }, periodos);
		setErrores(e);
		if (Object.keys(e).length > 0) return;
		guardar.mutate({ name: nombre.trim(), start_date: inicio, end_date: fin });
	};

	return (
		<Dialog
			open={open}
			onClose={guardar.isPending ? undefined : onClose}
			fullWidth
			maxWidth="xs"
		>
			<DialogTitle sx={{ fontWeight: 700, color: '#004680' }}>
				Crear periodo
				<Typography variant="body2" sx={{ color: '#64748b' }}>
					Se crea en estado preliquidado
				</Typography>
			</DialogTitle>
			<DialogContent dividers>
				<Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: 1 }}>
					<TextField
						label="Nombre (opcional)"
						placeholder="Ej.: Octubre 1ª quincena"
						value={nombre}
						onChange={(e) => setNombre(e.target.value)}
						slotProps={{
							htmlInput: { maxLength: MAX_CARACTERES_NOMBRE_PERIODO },
						}}
						error={!!errores.nombre}
						helperText={
							errores.nombre ??
							`${nombre.length}/${MAX_CARACTERES_NOMBRE_PERIODO}`
						}
						autoFocus
						fullWidth
					/>
					<TextField
						label="Inicio"
						type="date"
						value={inicio}
						onChange={(e) => setInicio(e.target.value)}
						disabled={fijo != null}
						slotProps={{ inputLabel: { shrink: true } }}
						error={!!errores.inicio}
						helperText={
							errores.inicio ??
							(fijo
								? 'Día siguiente al fin del último periodo'
								: 'Primer periodo: elige la fecha de inicio')
						}
						fullWidth
					/>
					<Box>
						<Typography variant="body2" sx={{ mb: 1, color: '#475569' }}>
							Duración rápida
						</Typography>
						<ToggleButtonGroup
							exclusive
							size="small"
							value={rapido}
							onChange={(_, n: number | null) => {
								if (n != null && FECHA.test(inicio))
									setFin(finPorDias(inicio, n));
							}}
							aria-label="Duración rápida"
						>
							{DIAS_RAPIDOS.map((n) => (
								<ToggleButton key={n} value={n} sx={{ px: 2 }}>
									{n} días
								</ToggleButton>
							))}
						</ToggleButtonGroup>
					</Box>
					<TextField
						label="Fin"
						type="date"
						value={fin}
						onChange={(e) => setFin(e.target.value)}
						slotProps={{
							inputLabel: { shrink: true },
							htmlInput: { min: inicio },
						}}
						error={!!errores.fin}
						helperText={
							errores.fin ??
							(dias ? `${dias} día${dias !== 1 ? 's' : ''}` : ' ')
						}
						fullWidth
					/>
				</Box>
			</DialogContent>
			<DialogActions sx={{ px: 3, py: 2 }}>
				<Button onClick={onClose} disabled={guardar.isPending}>
					Cancelar
				</Button>
				<Button
					variant="contained"
					onClick={enviar}
					disabled={guardar.isPending}
					startIcon={
						guardar.isPending ? <CircularProgress size={16} /> : undefined
					}
				>
					Crear periodo
				</Button>
			</DialogActions>
		</Dialog>
	);
}
