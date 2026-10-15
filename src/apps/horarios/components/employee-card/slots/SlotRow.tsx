import AccessTimeIcon from '@mui/icons-material/AccessTime';
import AssignmentIcon from '@mui/icons-material/Assignment';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import NoFoodIcon from '@mui/icons-material/NoFood';
import {
	Box,
	Button,
	CircularProgress,
	IconButton,
	Tooltip,
} from '@mui/material';
import { memo } from 'react';
import type { EstadoMarcacion, LogType } from '../../../domain/registro';
import { formatTo12Hour } from '../../../utils/format';
import { ICONO_MARCACION } from '../utils/iconos';

const TOOLTIP_YA_EDITADA =
	'Esta hora ya fue editada y no se puede volver a editar. En caso de ser necesario, llamar a soporte/sistemas.';

interface SlotRowProps {
	estado: EstadoMarcacion;
	/** Esta fila está guardando (spinner). */
	guardando: boolean;
	/** Alguna fila de la tarjeta está guardando: bloquea todas. */
	ocupado: boolean;
	onRegistrar: (marcacion: LogType) => void;
	onEditarHora: (marcacion: LogType) => void;
	onObservar: (marcacion: LogType) => void;
	onSinAlmuerzo: () => void;
}

/** Una fila: [reloj] [botón de marcación] [observación | sin almuerzo]. Solo pinta `estado`. */
export const SlotRow = memo(function SlotRow({
	estado,
	guardando,
	ocupado,
	onRegistrar,
	onEditarHora,
	onObservar,
	onSinAlmuerzo,
}: SlotRowProps) {
	const {
		marcacion,
		hora,
		activa,
		hecha,
		editable,
		editada,
		observable,
		observacion,
	} = estado;
	const logType = marcacion.logType;
	const tooltipReloj = editable
		? 'Editar hora'
		: hecha && editada
			? TOOLTIP_YA_EDITADA
			: 'No disponible';

	return (
		<Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
			<Tooltip title={tooltipReloj}>
				<span>
					<IconButton
						size="small"
						disabled={!editable}
						onClick={() => onEditarHora(logType)}
						sx={{
							border: '1px solid',
							borderColor: editable ? '#cbd5e1' : '#e2e8f0',
							borderRadius: 1.5,
							color: editable ? '#004680' : '#cbd5e1',
							'&:hover': { bgcolor: editable ? '#f1f5f9' : 'transparent' },
						}}
					>
						<AccessTimeIcon fontSize="small" />
					</IconButton>
				</span>
			</Tooltip>

			<Button
				fullWidth
				variant={activa ? 'contained' : hecha ? 'outlined' : 'text'}
				disabled={estado.deshabilitada || ocupado}
				onClick={hecha ? undefined : () => onRegistrar(logType)}
				endIcon={
					guardando ? (
						<CircularProgress
							size={16}
							sx={{ color: activa ? '#fff' : '#004680' }}
						/>
					) : hecha ? (
						<CheckCircleOutlineIcon color="success" />
					) : (
						ICONO_MARCACION[marcacion.key]
					)
				}
				sx={{
					justifyContent: 'space-between',
					textTransform: 'uppercase',
					fontSize: '12px',
					fontWeight: 700,
					py: 1,
					borderRadius: 2,
					bgcolor: activa ? '#004680' : 'transparent',
					color: activa ? '#fff' : hecha ? '#16a34a' : '#94a3b8',
					borderColor: hecha ? '#cbd5e1' : 'transparent',
					cursor: hecha ? 'default' : 'pointer',
					boxShadow: 'none',
					transition: 'all 0.3s ease-in-out',
					'&:hover': {
						bgcolor: activa ? '#003366' : 'transparent',
						transform: activa ? 'translateY(-1px)' : 'none',
						boxShadow: 'none',
					},
					'&:active': { boxShadow: 'none' },
					'&:focus': { boxShadow: 'none' },
				}}
			>
				<span>{marcacion.etiqueta}</span>
				{hora && (
					<span style={{ fontSize: '12px', fontWeight: 600 }}>
						{formatTo12Hour(hora)}
					</span>
				)}
			</Button>

			{estado.permiteSinAlmuerzo ? (
				<Tooltip title="Turno sin almuerzo" arrow>
					<span>
						<IconButton
							size="small"
							onClick={onSinAlmuerzo}
							sx={{
								border: '1px solid #efd8a8',
								borderRadius: 1.5,
								bgcolor: '#fdf3e0',
								color: '#c08417',
								'&:hover': { bgcolor: '#fceecb' },
							}}
						>
							<NoFoodIcon fontSize="small" />
						</IconButton>
					</span>
				</Tooltip>
			) : (
				<Tooltip
					title={
						observacion
							? `Observación: ${observacion.substring(0, 80)}...`
							: observable
								? 'Agregar observación'
								: 'No disponible'
					}
					arrow
				>
					<span>
						<IconButton
							size="small"
							disabled={!observable}
							onClick={() => observable && onObservar(logType)}
							sx={{
								border: '1px solid',
								borderColor: observable ? '#cbd5e1' : '#e2e8f0',
								borderRadius: 1.5,
								color: observable ? '#004680' : '#cbd5e1',
								'&:hover': { bgcolor: observable ? '#f1f5f9' : 'transparent' },
							}}
						>
							<AssignmentIcon fontSize="small" />
						</IconButton>
					</span>
				</Tooltip>
			)}
		</Box>
	);
});
