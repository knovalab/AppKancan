import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import EventBusyIcon from '@mui/icons-material/EventBusy';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import { Chip } from '@mui/material';
import type { RegistroTienda } from '../../interfaces/registroTienda';

export interface ReporteTiendasStatusChipProps {
	status: RegistroTienda['status'];
}

export function ReporteTiendasStatusChip({
	status,
}: ReporteTiendasStatusChipProps) {
	if (status === 'completado') {
		return (
			<Chip
				icon={<CheckCircleOutlineIcon sx={{ fontSize: '14px !important' }} />}
				label="Completado"
				size="small"
				sx={{
					bgcolor: '#ecfdf5',
					color: '#065f46',
					fontWeight: 600,
					border: '1px solid #a7f3d0',
				}}
			/>
		);
	}

	if (status === 'en_operacion') {
		return (
			<Chip
				icon={<HourglassEmptyIcon sx={{ fontSize: '14px !important' }} />}
				label="En Operación"
				size="small"
				sx={{
					bgcolor: '#fef3c7',
					color: '#92400e',
					fontWeight: 600,
					border: '1px solid #fde68a',
				}}
			/>
		);
	}

	if (status === 'sin_abrir') {
		return (
			<Chip
				icon={<EventBusyIcon sx={{ fontSize: '14px !important' }} />}
				label="Sin abrir"
				size="small"
				sx={{
					bgcolor: '#f8fafc',
					color: '#64748b',
					fontWeight: 600,
					border: '1px solid #e2e8f0',
				}}
			/>
		);
	}

	if (status === 'dia_cerrado') {
		return (
			<Chip
				icon={<EventBusyIcon sx={{ fontSize: '14px !important' }} />}
				label="Día Cerrado"
				size="small"
				sx={{
					bgcolor: '#f1f5f9',
					color: '#475569',
					fontWeight: 600,
				}}
			/>
		);
	}

	return (
		<Chip
			label="Sin abrir"
			size="small"
			sx={{
				bgcolor: '#f8fafc',
				color: '#94a3b8',
			}}
		/>
	);
}
