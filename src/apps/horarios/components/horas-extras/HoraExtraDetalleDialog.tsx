import CloseIcon from '@mui/icons-material/Close';
import {
	Box,
	Dialog,
	DialogContent,
	DialogTitle,
	IconButton,
	Typography,
} from '@mui/material';
import dayjs from 'dayjs';
import type { ReactNode } from 'react';
import { ESTADO_HORA_EXTRA, formatoMinutos } from '../../domain/horasExtras';
import type { HoraExtraFila } from '../../interfaces/horasExtras';
import { HoraExtraEstadoChip } from './HoraExtraEstadoChip';

const fecha = (f: string) => dayjs(f).format('DD/MM/YYYY');
const fechaHora = (f: string) => (f ? dayjs(f).format('DD/MM/YYYY HH:mm') : '');

function Dato({ label, children }: { label: string; children: ReactNode }) {
	return (
		<Box>
			<Typography variant="caption" sx={{ color: '#64748b' }}>
				{label}
			</Typography>
			<Typography variant="body2" component="div" sx={{ fontWeight: 600 }}>
				{children || '--'}
			</Typography>
		</Box>
	);
}

const grilla = {
	display: 'grid',
	gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
	gap: 2,
};
const seccion = { fontWeight: 700, color: '#004680', mt: 3, mb: 1.5 };

export interface HoraExtraDetalleDialogProps {
	/** `null` = cerrado. */
	fila: HoraExtraFila | null;
	onClose: () => void;
}

/** Detalle de una hora extra: datos, observación y trazabilidad (quién creó y quién revisó). */
export function HoraExtraDetalleDialog({
	fila,
	onClose,
}: HoraExtraDetalleDialogProps) {
	if (!fila) return null;
	const rechazada = fila.estado === ESTADO_HORA_EXTRA.descartadaComercial;
	return (
		<Dialog
			open
			onClose={onClose}
			fullWidth
			maxWidth="sm"
			aria-labelledby="he-detalle-titulo"
		>
			<DialogTitle
				id="he-detalle-titulo"
				sx={{ fontWeight: 700, color: '#004680', pr: 6 }}
			>
				Detalle de hora extra
				<Typography
					variant="body2"
					component="span"
					sx={{ display: 'block', color: '#64748b' }}
				>
					{fila.empleado}
				</Typography>
				<IconButton
					aria-label="Cerrar"
					onClick={onClose}
					sx={{ position: 'absolute', right: 12, top: 12 }}
				>
					<CloseIcon />
				</IconButton>
			</DialogTitle>
			<DialogContent dividers>
				<Box sx={grilla}>
					<Dato label="Empleado">{fila.empleado}</Dato>
					<Dato label="Documento">{fila.documento}</Dato>
					<Dato label="Fecha trabajada">{fecha(fila.fecha)}</Dato>
					<Dato label="Horas extras">{formatoMinutos(fila.minutos)}</Dato>
					<Dato label="Tienda donde trabajó">
						{fila.tienda}
						{fila.rotacion && ' (rotación: no es su tienda)'}
					</Dato>
					<Dato label="Estado">
						<HoraExtraEstadoChip estado={fila.estado} />
					</Dato>
					{fila.periodo && (
						<Dato label="Periodo de nómina">
							{fila.periodo.inicio && fila.periodo.fin
								? `${fecha(fila.periodo.inicio)} – ${fecha(fila.periodo.fin)}`
								: `Periodo ${fila.periodo.id}`}
						</Dato>
					)}
				</Box>

				<Typography variant="subtitle2" sx={seccion}>
					Observación
				</Typography>
				<Typography
					variant="body2"
					sx={{
						whiteSpace: 'pre-wrap',
						color: fila.observacion ? 'inherit' : '#94a3b8',
					}}
				>
					{fila.observacion || 'Sin observación'}
				</Typography>

				<Typography variant="subtitle2" sx={seccion}>
					Trazabilidad
				</Typography>
				<Box sx={grilla}>
					<Dato label="Creada por">{fila.creadaPor}</Dato>
					<Dato label="Creada el">{fechaHora(fila.creadaEl)}</Dato>
					<Dato label={rechazada ? 'Rechazada por' : 'Revisada por'}>
						{fila.revisadaPor}
					</Dato>
					<Dato label={rechazada ? 'Rechazada el' : 'Revisada el'}>
						{fechaHora(fila.revisadaEl)}
					</Dato>
				</Box>
				{rechazada && (
					<Box sx={{ mt: 2 }}>
						<Dato label="Motivo del rechazo">{fila.motivoRechazo}</Dato>
					</Box>
				)}
			</DialogContent>
		</Dialog>
	);
}
