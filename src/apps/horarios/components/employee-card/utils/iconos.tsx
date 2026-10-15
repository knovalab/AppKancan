import DiningIcon from '@mui/icons-material/Dining';
import ExitToAppIcon from '@mui/icons-material/ExitToApp';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import RestaurantIcon from '@mui/icons-material/Restaurant';
import type { ReactElement } from 'react';
import type { MarcacionKey } from '../../../domain/registro';

/** Icono del botón de cada marcación (Record: una marcación nueva sin icono no compila). */
export const ICONO_MARCACION: Record<MarcacionKey, ReactElement> = {
	inicioJornada: <PlayArrowIcon fontSize="small" />,
	inicioAlmuerzo: <RestaurantIcon fontSize="small" />,
	finAlmuerzo: <DiningIcon fontSize="small" />,
	finJornada: <ExitToAppIcon fontSize="small" />,
};
