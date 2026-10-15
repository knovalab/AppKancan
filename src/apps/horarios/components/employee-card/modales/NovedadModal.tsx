import {
	Box,
	Button,
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
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import type { PickersDayProps } from '@mui/x-date-pickers/PickersDay';
import dayjs from 'dayjs';
import 'dayjs/locale/es';
import { useState } from 'react';
import { useHolidays } from '../../../../reservas/hooks/useHolidays';
import type { Resultado } from '../../../interfaces/comunes';
import { FestivoDay } from '../../FestivoDay';
import {
	erroresDeValidacion,
	type NovedadFormValues,
	novedadSchema,
} from '../utils/novedadSchema';
import type { TipoNovedad } from '../../../interfaces/novedades';

interface NovedadModalProps {
	open: boolean;
	onClose: () => void;
	tiposNovedad: TipoNovedad[];
	onGuardar: (valores: NovedadFormValues) => Promise<Resultado>;
}

const hoy = () => dayjs().format('YYYY-MM-DD');

/**
 * Formulario de novedad con su propio estado y validación.
 * Los festivos se piden aquí (antes: una query por tarjeta aunque nadie abriera el modal).
 */
export function NovedadModal({
	open,
	onClose,
	tiposNovedad,
	onGuardar,
}: NovedadModalProps) {
	const [valores, setValores] = useState<NovedadFormValues>({
		novedad: '',
		fechaInicio: hoy(),
		fechaFin: hoy(),
		observaciones: '',
	});
	const [errores, setErrores] = useState<Record<string, string>>({});
	const [anio, setAnio] = useState(() => dayjs().year());
	const { data: festivos = {} } = useHolidays(anio);

	const cambiar = (parcial: Partial<NovedadFormValues>) =>
		setValores((v) => ({ ...v, ...parcial }));

	const cambiarFecha =
		(campo: 'fechaInicio' | 'fechaFin') => (valor: unknown) => {
			if (valor === null) cambiar({ [campo]: '' });
			else if (dayjs.isDayjs(valor))
				cambiar({ [campo]: valor.format('YYYY-MM-DD') });
		};

	const guardar = async () => {
		setErrores({});
		try {
			await novedadSchema.validate(valores, { abortEarly: false });
		} catch (err) {
			setErrores(erroresDeValidacion(err) ?? {});
			return;
		}
		const resultado = await onGuardar(valores);
		if (resultado.ok) onClose();
	};

	// FestivoDay recibe `holidays` además de las props estándar del día.
	const diaProps = { holidays: festivos } as Partial<PickersDayProps>;

	return (
		<Dialog
			open={open}
			onClose={onClose}
			maxWidth="sm"
			fullWidth
			slotProps={{ paper: { sx: { borderRadius: 4 } } }}
		>
			<DialogTitle sx={{ bgcolor: '#004680', color: '#fff', py: 2, px: 3 }}>
				Registro de Novedad
			</DialogTitle>
			<DialogContent dividers sx={{ p: 3 }}>
				<Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, pt: 1 }}>
					<FormControl fullWidth error={!!errores.novedad}>
						<InputLabel id="novedad-select-label">Novedad</InputLabel>
						<Select
							labelId="novedad-select-label"
							value={valores.novedad}
							label="Novedad"
							onChange={(e) => cambiar({ novedad: e.target.value })}
						>
							{tiposNovedad.map((tipo) => (
								<MenuItem key={tipo.id} value={tipo.name || tipo.nombre}>
									{tipo.name || tipo.nombre}
								</MenuItem>
							))}
						</Select>
						{errores.novedad && (
							<Typography
								variant="caption"
								color="error"
								sx={{ mt: 0.5, ml: 1.5 }}
							>
								{errores.novedad}
							</Typography>
						)}
					</FormControl>
					<LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="es">
						<Box sx={{ display: 'flex', gap: 2 }}>
							{(
								[
									['fechaInicio', 'Desde el día'],
									['fechaFin', 'Hasta el día'],
								] as const
							).map(([campo, etiqueta]) => (
								<DatePicker
									key={campo}
									label={etiqueta}
									value={valores[campo] ? dayjs(valores[campo]) : null}
									onChange={cambiarFecha(campo)}
									onMonthChange={(m) => setAnio(dayjs(m).year())}
									onYearChange={(y) => setAnio(dayjs(y).year())}
									slots={{ day: FestivoDay }}
									format="DD/MM/YYYY"
									slotProps={{
										day: diaProps,
										textField: {
											fullWidth: true,
											error: !!errores[campo],
											helperText: errores[campo],
										},
									}}
								/>
							))}
						</Box>
					</LocalizationProvider>
					<TextField
						label="Observaciones"
						multiline
						rows={3}
						fullWidth
						value={valores.observaciones}
						onChange={(e) => cambiar({ observaciones: e.target.value })}
						placeholder="Detalle adicional..."
						error={!!errores.observaciones}
						helperText={errores.observaciones}
					/>
				</Box>
			</DialogContent>
			<DialogActions sx={{ p: 2, gap: 1 }}>
				<Button
					onClick={onClose}
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
					disabled={
						!valores.novedad || !valores.fechaInicio || !valores.fechaFin
					}
					sx={{ bgcolor: '#004680' }}
				>
					Guardar
				</Button>
			</DialogActions>
		</Dialog>
	);
}
