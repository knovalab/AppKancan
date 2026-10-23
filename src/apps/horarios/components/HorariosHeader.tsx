import GavelIcon from '@mui/icons-material/Gavel';
import RefreshIcon from '@mui/icons-material/Refresh';
import ScheduleIcon from '@mui/icons-material/Schedule';
import {
	Box,
	Button,
	CircularProgress,
	type Theme,
	Tooltip,
	Typography,
	useMediaQuery,
} from '@mui/material';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useHorariosLayout } from '../hooks/useHorariosLayout';
import { useNormas } from '../hooks/useNormas';
import { formatNombrePropio } from '../utils/format';
import { botonHeaderSx } from './botonHeaderSx';
import { HeaderActionsSlot } from './HeaderActions';
import NormasModal from './NormasModal';
import { TiendaSelector } from './TiendaSelector';
import TutorialButton from './tour/TutorialButton';

/**
 * Header de la app: icono, título y subtítulo de la sección activa, selector de tienda,
 * y botones en este orden: Normas · [acciones de la página, p. ej. Demo] · Tutorial · Actualizar.
 */
export function HorariosHeader() {
	const { seccion, tienda, acceso } = useHorariosLayout();
	// Perfil tienda en Registros: sin Normas/Tutorial/Actualizar (vista limpia).
	const vistaLimpia =
		acceso.rolPrincipal === 'tienda' && seccion?.path === 'registros';
	const isMobile = useMediaQuery((theme: Theme) =>
		theme.breakpoints.down('sm'),
	);
	const queryClient = useQueryClient();
	const [actualizando, setActualizando] = useState(false);
	const { normas, manualOpen, setManualOpen, aceptar, aceptando } = useNormas();

	const Icono = seccion?.icon ?? ScheduleIcon;
	const nombreTienda =
		seccion && seccion.tienda !== 'ninguno' && tienda.nombre
			? ` - ${formatNombrePropio(tienda.nombre)}`
			: '';

	const actualizar = async () => {
		setActualizando(true);
		try {
			// Solo lo que está en pantalla; no invalida la caché de otras apps.
			await queryClient.refetchQueries({ type: 'active' });
		} finally {
			setActualizando(false);
		}
	};

	return (
		<>
			<Box
				sx={{
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'space-between',
					flexWrap: 'wrap',
					gap: 1,
					p: { xs: 1.5, md: 2 },
					borderBottom: '1px solid #eef2f6',
				}}
			>
				<Box sx={{ display: 'flex', alignItems: 'center', gap: 1.75 }}>
					<Box
						sx={{
							display: 'flex',
							alignItems: 'center',
							justifyContent: 'center',
							width: { xs: 32, md: 48 },
							height: { xs: 32, md: 48 },
							borderRadius: 2.5,
							flexShrink: 0,
							color: '#004680',
							bgcolor: '#eaf2fb',
							border: '1px solid #d6e6f7',
						}}
					>
						<Icono sx={{ fontSize: { xs: 18, md: 26 } }} />
					</Box>
					<Box>
						<Typography
							component="h1"
							sx={{
								fontWeight: 700,
								color: '#0f2c4a',
								lineHeight: 1.2,
								fontSize: { xs: '0.9rem', md: '1.4rem' },
							}}
						>
							{(seccion?.titulo ?? 'Horarios') + nombreTienda}
						</Typography>
						{!isMobile && seccion && (
							<Typography
								sx={{
									fontSize: '0.82rem',
									color: '#64748b',
									mt: 0.4,
									lineHeight: 1.35,
								}}
							>
								{seccion.subtitulo}
							</Typography>
						)}
					</Box>
				</Box>

				<Box
					sx={{
						display: 'flex',
						flexDirection: { xs: 'column', sm: 'row' },
						alignItems: 'center',
						gap: 1,
						flexWrap: 'wrap',
						width: { xs: '100%', sm: 'auto' },
					}}
				>
					<TiendaSelector />

					<Box
						sx={{
							display: vistaLimpia ? 'none' : 'flex',
							flexWrap: 'wrap',
							alignItems: 'center',
							gap: 0.5,
							justifyContent: { xs: 'center', sm: 'flex-end' },
							width: { xs: '100%', sm: 'auto' },
						}}
					>
						{seccion?.mostrarNormas !== false && (
							<Tooltip title="Ver normas de uso">
								<Button
									onClick={() => setManualOpen(true)}
									variant="outlined"
									disableElevation
									startIcon={<GavelIcon />}
									sx={{
										...botonHeaderSx,
										color: '#991b1b',
										borderColor: '#fca5a5',
										'&:hover': { borderColor: '#f87171', bgcolor: '#fff5f5' },
									}}
								>
									Normas
								</Button>
							</Tooltip>
						)}

						{/* Acciones de la página (p. ej. Demo en Registros) */}
						<HeaderActionsSlot slot="header" />

						{seccion?.mostrarTutorial && <TutorialButton sx={botonHeaderSx} />}

						<Tooltip title="Actualizar información de la base de datos">
							<Button
								className="tour-refresh"
								onClick={actualizar}
								disabled={actualizando}
								variant="contained"
								disableElevation
								startIcon={
									actualizando ? (
										<CircularProgress size={14} sx={{ color: '#fff' }} />
									) : (
										<RefreshIcon />
									)
								}
								sx={{
									...botonHeaderSx,
									bgcolor: '#004680',
									color: '#fff',
									'&:hover': { bgcolor: '#003366' },
								}}
							>
								Actualizar
							</Button>
						</Tooltip>
					</Box>
				</Box>
			</Box>

			<NormasModal
				open={manualOpen}
				normas={normas}
				obligatorio={false}
				aceptando={aceptando}
				onClose={() => setManualOpen(false)}
				onAceptar={async () => {
					await aceptar();
					setManualOpen(false);
				}}
			/>
		</>
	);
}
