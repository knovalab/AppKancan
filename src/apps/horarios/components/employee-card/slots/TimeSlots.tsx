import { Box, Stack, Typography } from '@mui/material';
import type { LogType, VistaTarjeta } from '../../../domain/registro';
import { ContadorPausa } from './ContadorPausa';
import { SlotRow } from './SlotRow';

interface TimeSlotsProps {
	vm: VistaTarjeta;
	guardando: LogType | null;
	/** Vencimiento de la pausa en curso (null = sin pausa). */
	pausaExpiraEn: number | null;
	onTerminarDemoPausa?: () => void;
	onRegistrar: (marcacion: LogType) => void;
	onEditarHora: (marcacion: LogType) => void;
	onObservar: (marcacion: LogType) => void;
	onSinAlmuerzo: () => void;
}

export function TimeSlots({
	vm,
	guardando,
	pausaExpiraEn,
	onTerminarDemoPausa,
	onRegistrar,
	onEditarHora,
	onObservar,
	onSinAlmuerzo,
}: TimeSlotsProps) {
	return (
		<Box sx={{ p: 3, position: 'relative' }}>
			{pausaExpiraEn !== null && (
				<ContadorPausa
					expiraEn={pausaExpiraEn}
					onTerminarDemo={onTerminarDemoPausa}
				/>
			)}

			<Stack className="tour-marcacion" spacing={1.5}>
				{vm.marcaciones.map((estado) => (
					<SlotRow
						key={estado.marcacion.key}
						estado={estado}
						guardando={guardando === estado.marcacion.logType}
						ocupado={guardando !== null}
						onRegistrar={onRegistrar}
						onEditarHora={onEditarHora}
						onObservar={onObservar}
						onSinAlmuerzo={onSinAlmuerzo}
					/>
				))}
			</Stack>

			{vm.finalizado && (
				<Box
					sx={{
						mt: 2,
						textAlign: 'center',
						bgcolor: '#f0fdf4',
						py: 1,
						borderRadius: 2,
					}}
				>
					<Typography
						variant="caption"
						sx={{ fontWeight: 700, color: '#16a34a' }}
					>
						Jornada completada
					</Typography>
				</Box>
			)}
		</Box>
	);
}
