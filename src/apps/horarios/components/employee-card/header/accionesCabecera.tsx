import PauseCircleOutlineIcon from '@mui/icons-material/PauseCircleOutline';
import WarningIcon from '@mui/icons-material/Warning';
import type { ReactElement } from 'react';
import { EVENTO, type VistaTarjeta } from '../../../domain/registro';

/** Modales que una acción de la cabecera puede abrir. */
export type ModalCabecera = 'novedad' | 'evento';

/**
 * Acción de la cabecera de la tarjeta. Añadir una acción nueva = un descriptor aquí
 * + su modal en EmployeeCard + su método en AccionesTarjeta. El Header no cambia.
 */
export interface AccionCabecera {
	id: string;
	modal: ModalCabecera;
	icono: ReactElement;
	/** Color del icono cuando está disponible. */
	color: string;
	/** Marcador del tour (tourSteps.tsx). */
	tourClass: string;
	disponible: (vm: VistaTarjeta) => boolean;
	tooltip: (vm: VistaTarjeta) => string;
}

export const ACCIONES_CABECERA: readonly AccionCabecera[] = [
	{
		id: 'novedad',
		modal: 'novedad',
		icono: <WarningIcon fontSize="medium" />,
		color: '#ffffff',
		tourClass: 'tour-novedad-btn',
		disponible: (vm) => vm.puedeRegistrarNovedad,
		tooltip: (vm) =>
			vm.puedeRegistrarNovedad ? 'Registrar novedad' : 'No disponible',
	},
	{
		id: 'evento',
		modal: 'evento',
		icono: <PauseCircleOutlineIcon fontSize="medium" />,
		color: '#fbbf24',
		tourClass: 'tour-evento-btn',
		disponible: (vm) => vm.puedeReportarEvento,
		tooltip: (vm) =>
			vm.pausas.agotadas
				? `Pausas activas completadas (${vm.pausas.max} de ${vm.pausas.max})`
				: vm.puedeReportarEvento
					? EVENTO.iniciarPausaActiva
					: 'No disponible',
	},
];
