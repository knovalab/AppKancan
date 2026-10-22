import {
	Alert,
	Box,
	Button,
	Chip,
	CircularProgress,
	Dialog,
	DialogActions,
	DialogContent,
	DialogTitle,
	Table,
	TableBody,
	TableCell,
	TableContainer,
	TableHead,
	TableRow,
	Typography,
} from '@mui/material';
import dayjs from 'dayjs';
import { formatoMinutos } from '../../domain/horasExtras';

export interface PersonaResumen {
	id: string;
	nombre: string;
	tienda: string;
	observacion: string;
	/** Sus horas extras, por día; `yaRegistrada` = coincide con una activa. */
	dias: { fecha: string; minutos: number; yaRegistrada: boolean }[];
}

export interface ConfirmarRegistroDialogProps {
	open: boolean;
	personas: PersonaResumen[];
	guardando: boolean;
	onClose: () => void;
	onConfirmar: () => void;
}

const plural = (n: number, uno: string, varios: string) =>
	`${n} ${n === 1 ? uno : varios}`;
const head = { fontWeight: 700, color: '#475569', bgcolor: '#f8fafc' };

function Total({ label, valor }: { label: string; valor: string | number }) {
	return (
		<Box
			sx={{
				flex: 1,
				minWidth: 120,
				p: 1.5,
				borderRadius: 2,
				border: '1px solid #e2e8f0',
			}}
		>
			<Typography variant="caption" sx={{ color: '#64748b' }}>
				{label}
			</Typography>
			<Typography variant="h6" sx={{ fontWeight: 700, color: '#004680' }}>
				{valor}
			</Typography>
		</Box>
	);
}

/** Resumen antes de registrar en lote: quién, qué días, cuántas horas y el total. */
export function ConfirmarRegistroDialog({
	open,
	personas,
	guardando,
	onClose,
	onConfirmar,
}: ConfirmarRegistroDialogProps) {
	const dias = personas.flatMap((p) => p.dias);
	const total = dias.reduce((s, d) => s + d.minutos, 0);
	const yaRegistradas = dias.filter((d) => d.yaRegistrada).length;
	const fechas = dias.map((d) => d.fecha).sort();
	return (
		<Dialog
			open={open}
			onClose={guardando ? undefined : onClose}
			fullWidth
			maxWidth="md"
			aria-labelledby="confirmar-registro-titulo"
		>
			<DialogTitle
				id="confirmar-registro-titulo"
				sx={{ fontWeight: 700, color: '#004680' }}
			>
				Confirmar registro de horas extras
				<Typography variant="body2" sx={{ color: '#64748b' }}>
					Revisa el resumen. Quedarán pendientes de aprobación del comercial.
				</Typography>
			</DialogTitle>
			<DialogContent dividers>
				<Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, mb: 2 }}>
					<Total label="Horas extras" valor={dias.length} />
					<Total label="Personas" valor={personas.length} />
					<Total label="Tiempo total" valor={formatoMinutos(total)} />
					<Total
						label="Fechas"
						valor={
							fechas.length === 0
								? '--'
								: fechas[0] === fechas[fechas.length - 1]
									? dayjs(fechas[0]).format('DD/MM')
									: `${dayjs(fechas[0]).format('DD/MM')} al ${dayjs(fechas[fechas.length - 1]).format('DD/MM')}`
						}
					/>
				</Box>

				<TableContainer
					sx={{
						maxHeight: 360,
						overflow: 'auto',
						borderRadius: 2,
						border: '1px solid #e2e8f0',
					}}
				>
					<Table stickyHeader size="small" aria-label="Resumen del registro">
						<TableHead>
							<TableRow>
								{[
									'Persona',
									'Tienda',
									'Días y horas',
									'Total',
									'Observación',
								].map((c) => (
									<TableCell key={c} sx={head}>
										{c}
									</TableCell>
								))}
							</TableRow>
						</TableHead>
						<TableBody>
							{personas.map((p) => (
								<TableRow key={p.id}>
									<TableCell sx={{ fontWeight: 600 }}>{p.nombre}</TableCell>
									<TableCell>{p.tienda || '--'}</TableCell>
									<TableCell>
										<Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
											{p.dias.map((d) => (
												<Chip
													key={d.fecha}
													size="small"
													variant="outlined"
													color={d.yaRegistrada ? 'warning' : 'default'}
													label={`${dayjs(d.fecha).format('DD/MM')}: ${formatoMinutos(d.minutos)}`}
												/>
											))}
										</Box>
									</TableCell>
									<TableCell sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}>
										{formatoMinutos(p.dias.reduce((s, d) => s + d.minutos, 0))}
									</TableCell>
									<TableCell sx={{ maxWidth: 220 }}>
										<Typography
											variant="body2"
											sx={{ color: p.observacion ? 'inherit' : '#94a3b8' }}
										>
											{p.observacion || 'Sin observación'}
										</Typography>
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				</TableContainer>

				{yaRegistradas > 0 && (
					<Alert severity="warning" sx={{ mt: 2 }}>
						{plural(
							yaRegistradas,
							'hora extra coincide',
							'horas extras coinciden',
						)}{' '}
						con otra ya registrada ese día (en naranja). Se registrarán igual.
					</Alert>
				)}
			</DialogContent>
			<DialogActions sx={{ px: 3, py: 2 }}>
				<Button onClick={onClose} disabled={guardando}>
					Volver a editar
				</Button>
				<Button
					variant="contained"
					onClick={onConfirmar}
					disabled={guardando}
					startIcon={guardando ? <CircularProgress size={16} /> : undefined}
				>
					Confirmar y registrar ({dias.length})
				</Button>
			</DialogActions>
		</Dialog>
	);
}
