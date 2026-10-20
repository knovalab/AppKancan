import {
	Alert,
	Autocomplete,
	Box,
	Button,
	CircularProgress,
	Dialog,
	DialogActions,
	DialogContent,
	DialogTitle,
	FormControl,
	FormHelperText,
	InputLabel,
	MenuItem,
	Select,
	TextField,
	Typography,
} from '@mui/material';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { crearHoraExtra } from '../../api/directus/horasExtras';
import {
	buscarDuplicado,
	type ErroresHoraExtra,
	ETIQUETA_ESTADO_HORA_EXTRA,
	formatoMinutos,
	validarHoraExtra,
} from '../../domain/horasExtras';
import type { EmpleadoAsistencia } from '../../domain/registro';
import { MAX_CARACTERES_OBSERVACION } from '../../domain/registro';
import { horariosKeys } from '../../hooks/registro/keys';
import { useAvisos } from '../../hooks/useAvisos';
import { useHorasExtras } from '../../hooks/useHorasExtras';
import type { Tienda } from '../../interfaces/tiendas';
import { mensajeDeError } from '../../utils/errores';
import { formatNombrePropio } from '../../utils/format';
import { getRealColombiaTime } from '../../utils/timeSync';

export interface RegistrarHoraExtraModalProps {
	open: boolean;
	empleados: EmpleadoAsistencia[];
	cargandoEmpleados?: boolean;
	tiendas: Tienda[];
	tiendasLider: number[];
	onClose: () => void;
}

const etiquetaEmpleado = (e: EmpleadoAsistencia) =>
	`${formatNombrePropio(e.nombre)} · ${e.documento}`;

export function RegistrarHoraExtraModal({
	open,
	empleados,
	cargandoEmpleados = false,
	tiendas,
	tiendasLider,
	onClose,
}: RegistrarHoraExtraModalProps) {
	const queryClient = useQueryClient();
	const { showSnackbar } = useAvisos();
	const hoy = getRealColombiaTime().format('YYYY-MM-DD');
	const [empleado, setEmpleado] = useState<EmpleadoAsistencia | null>(null);
	const tiendaEmpleado = empleado?.storeId ?? null;

	const [tiendaId, setTiendaId] = useState<number | ''>('');
	const [fecha, setFecha] = useState(hoy);
	const [horas, setHoras] = useState('');
	const [observacion, setObservacion] = useState('');
	const [errores, setErrores] = useState<
		ErroresHoraExtra & { tienda?: string }
	>({});

	const empleadoId = Number(empleado?.id);
	const { data: delDia = [] } = useHorasExtras(
		{
			tiendas: tiendaEmpleado != null ? [tiendaEmpleado] : [],
			empleadoId,
			desde: fecha,
			hasta: fecha,
			incluirPruebas: true,
		},
		open && empleado != null && /^\d{4}-\d{2}-\d{2}$/.test(fecha),
	);
	const duplicado = buscarDuplicado(delDia);

	const guardar = useMutation({
		mutationFn: crearHoraExtra,
		onSuccess: () => {
			void queryClient.invalidateQueries({
				queryKey: horariosKeys.horasExtras.todos,
			});
			showSnackbar(
				'Hora extra registrada: queda pendiente de aprobación',
				'success',
			);
			onClose();
		},
		onError: (err) =>
			showSnackbar(
				mensajeDeError(err, 'Error al registrar la hora extra'),
				'error',
			),
	});

	const minutos = Math.round(Number(horas) * 60);

	const enviar = () => {
		if (!empleado) {
			setErrores({ empleado: 'Busca y elige un empleado' });
			return;
		}
		const e: ErroresHoraExtra & { tienda?: string } = validarHoraExtra(
			{ workDate: fecha, minutos, observacion },
			{
				hoy,
				empleadoActivo: true, // la lista solo trae empleados activos
				empleadoDelLider:
					tiendaEmpleado != null && tiendasLider.includes(tiendaEmpleado),
			},
		);
		if (tiendaId === '') e.tienda = 'La tienda es obligatoria';
		setErrores(e);
		if (Object.keys(e).length > 0 || tiendaId === '') return;
		guardar.mutate({
			employee_id: empleadoId,
			store_id: tiendaId,
			work_date: fecha,
			minutes: minutos,
			observations: observacion.trim(),
		});
	};

	return (
		<Dialog
			open={open}
			onClose={guardar.isPending ? undefined : onClose}
			fullWidth
			maxWidth="sm"
		>
			<DialogTitle sx={{ fontWeight: 700, color: '#004680' }}>
				Registrar hora extra
				<Typography variant="body2" sx={{ color: '#64748b' }}>
					Queda pendiente de aprobación del comercial
				</Typography>
			</DialogTitle>
			<DialogContent dividers>
				<Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: 1 }}>
					<Autocomplete
						options={empleados}
						value={empleado}
						loading={cargandoEmpleados}
						onChange={(_, e) => {
							setEmpleado(e);
							setTiendaId(e?.storeId ?? '');
							setErrores({});
						}}
						getOptionLabel={etiquetaEmpleado}
						isOptionEqualToValue={(a, b) => a.id === b.id}
						noOptionsText="No hay empleados con ese nombre o documento"
						loadingText="Cargando empleados..."
						renderInput={(params) => (
							<TextField
								{...params}
								label="Empleado"
								placeholder="Buscar por nombre o documento"
								error={!!errores.empleado}
								helperText={errores.empleado ?? empleado?.cargo}
								autoFocus
							/>
						)}
					/>

					<FormControl fullWidth error={!!errores.tienda}>
						<InputLabel id="he-tienda">Tienda donde trabajó</InputLabel>
						<Select
							labelId="he-tienda"
							label="Tienda donde trabajó"
							value={tiendaId}
							onChange={(e) => setTiendaId(Number(e.target.value))}
						>
							{tiendas.map((t) => (
								<MenuItem key={t.id} value={Number(t.id)}>
									{t.name}
									{Number(t.id) === tiendaEmpleado ? ' (su tienda)' : ''}
								</MenuItem>
							))}
						</Select>
						<FormHelperText>
							{errores.tienda ??
								(tiendaId !== '' && tiendaId !== tiendaEmpleado
									? 'Rotación: trabajó en una tienda distinta a la suya'
									: 'Por defecto, la tienda del empleado')}
						</FormHelperText>
					</FormControl>

					<TextField
						label="Fecha"
						type="date"
						value={fecha}
						onChange={(e) => setFecha(e.target.value)}
						slotProps={{
							inputLabel: { shrink: true },
							htmlInput: { max: hoy },
						}}
						error={!!errores.workDate}
						helperText={errores.workDate}
						fullWidth
					/>

					<TextField
						label="Horas extras"
						type="number"
						value={horas}
						onChange={(e) => setHoras(e.target.value)}
						slotProps={{ htmlInput: { min: 0.5, step: 0.5 } }}
						error={!!errores.minutos}
						helperText={
							errores.minutos ??
							(minutos > 0
								? formatoMinutos(minutos)
								: 'En bloques de media hora (0.5 = 30 min)')
						}
						fullWidth
					/>

					<TextField
						label="Observación"
						value={observacion}
						onChange={(e) => setObservacion(e.target.value)}
						multiline
						minRows={2}
						error={!!errores.observacion}
						helperText={
							errores.observacion ??
							`${observacion.length}/${MAX_CARACTERES_OBSERVACION}`
						}
						fullWidth
					/>

					{duplicado && (
						<Alert severity="warning">
							Este empleado ya tiene {formatoMinutos(duplicado.minutes)} en
							estado {ETIQUETA_ESTADO_HORA_EXTRA[duplicado.status]} ese día.
						</Alert>
					)}
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
					Registrar
				</Button>
			</DialogActions>
		</Dialog>
	);
}
