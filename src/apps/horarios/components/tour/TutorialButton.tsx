import AssignmentIcon from '@mui/icons-material/Assignment';
import EventNoteIcon from '@mui/icons-material/EventNote';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import HistoryIcon from '@mui/icons-material/History';
import PlayCircleOutlineIcon from '@mui/icons-material/PlayCircleOutline';
import {
	Button,
	Divider,
	ListItemIcon,
	ListItemText,
	Menu,
	MenuItem,
	type SxProps,
	type Theme,
	Typography,
} from '@mui/material';
import type React from 'react';
import { useState } from 'react';
import { type TourPhase, useHorariosTour } from './HorariosTourContext';

interface TutorialButtonProps {
	/** Estilos extra (p. ej. para igualar el tamaño con los botones del header). */
	sx?: SxProps<Theme>;
}

const TutorialButton: React.FC<TutorialButtonProps> = ({ sx }) => {
	const { startTour, isFullTourRunning } = useHorariosTour();
	const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

	const handleClick = (e: React.MouseEvent<HTMLElement>) => {
		if (!isFullTourRunning) setAnchorEl(e.currentTarget);
	};

	const handleClose = () => setAnchorEl(null);

	const handleSelect = (phase?: TourPhase) => {
		handleClose();
		startTour(phase);
	};

	return (
		<>
			<Button
				onClick={handleClick}
				disabled={isFullTourRunning}
				variant="contained"
				startIcon={<HelpOutlineIcon sx={{ fontSize: 18 }} />}
				sx={{
					backgroundColor: isFullTourRunning ? '#9CA3AF' : '#004680',
					color: '#ffffff',
					borderRadius: 1.5,
					textTransform: 'none',
					fontWeight: 'bold',
					px: 2,
					py: 0.75,
					boxShadow: 'none',
					opacity: isFullTourRunning ? 0.6 : 0.9,
					transition: 'all 0.2s ease-in-out',
					'&:hover': {
						backgroundColor: isFullTourRunning ? '#9CA3AF' : '#003366',
						boxShadow: 'none',
						transform: isFullTourRunning ? 'none' : 'translateY(-1px)',
					},
					'&:disabled': { backgroundColor: '#9CA3AF', color: '#ffffff' },
					...(sx as object),
				}}
			>
				{isFullTourRunning ? 'Tutorial...' : 'Tutorial'}
			</Button>
			<Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={handleClose}>
				<MenuItem onClick={() => handleSelect(undefined)}>
					<ListItemIcon>
						<PlayCircleOutlineIcon fontSize="small" sx={{ color: '#004680' }} />
					</ListItemIcon>
					<ListItemText primary="Tour completo" />
				</MenuItem>

				<Divider sx={{ my: 0.5 }} />

				<Typography
					variant="caption"
					sx={{ px: 2, py: 0.5, color: 'text.secondary', display: 'block' }}
				>
					Ver una sección específica
				</Typography>

				<MenuItem onClick={() => handleSelect('REGISTROS')}>
					<ListItemIcon>
						<EventNoteIcon fontSize="small" />
					</ListItemIcon>
					<ListItemText primary="Registros" />
				</MenuItem>
				<MenuItem onClick={() => handleSelect('NOVEDADES')}>
					<ListItemIcon>
						<AssignmentIcon fontSize="small" />
					</ListItemIcon>
					<ListItemText primary="Novedades" />
				</MenuItem>
				<MenuItem onClick={() => handleSelect('HISTORIAL')}>
					<ListItemIcon>
						<HistoryIcon fontSize="small" />
					</ListItemIcon>
					<ListItemText primary="Historial" />
				</MenuItem>
			</Menu>
		</>
	);
};

export default TutorialButton;
