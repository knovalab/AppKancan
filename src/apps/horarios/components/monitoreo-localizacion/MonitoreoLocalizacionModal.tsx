import CloseIcon from '@mui/icons-material/Close';
import {
	Box,
	Button,
	Chip,
	Dialog,
	DialogContent,
	DialogTitle,
	IconButton,
	Typography,
} from '@mui/material';
import { ExternalLink, MapPin } from 'lucide-react';
import { lazy, Suspense } from 'react';

const LeafletMap = lazy(() =>
	import('../attendance/LeafletMap').then((m) => ({ default: m.LeafletMap })),
);

export interface MonitoreoLocalizacionModalProps {
	open: boolean;
	onClose: () => void;
	lat: number;
	lon: number;
	accuracy?: number | null;
	title: string;
	subtitle: string;
	hora?: string | null;
}

export function MonitoreoLocalizacionModal({
	open,
	onClose,
	lat,
	lon,
	accuracy,
	title,
	subtitle,
	hora,
}: MonitoreoLocalizacionModalProps) {
	const googleMapsUrl = `https://www.google.com/maps?q=${lat},${lon}`;

	return (
		<Dialog
			open={open}
			onClose={onClose}
			maxWidth="md"
			fullWidth
			slotProps={{
				paper: {
					sx: {
						borderRadius: 3,
						overflow: 'hidden',
					},
				},
			}}
		>
			<DialogTitle
				sx={{
					p: 2,
					px: 2.5,
					bgcolor: '#f8fafc',
					borderBottom: '1px solid #e2e8f0',
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'space-between',
					gap: 1.5,
				}}
			>
				<Box sx={{ minWidth: 0 }}>
					<Typography
						variant="h6"
						sx={{
							fontWeight: 800,
							color: '#0f172a',
							fontSize: { xs: '1rem', sm: '1.15rem' },
							lineHeight: 1.3,
						}}
					>
						{title}
					</Typography>
					<Typography
						variant="caption"
						sx={{ color: '#64748b', fontWeight: 500 }}
					>
						{subtitle}
					</Typography>
				</Box>

				<IconButton
					onClick={onClose}
					size="small"
					sx={{ color: '#64748b', p: 0.75 }}
				>
					<CloseIcon fontSize="small" />
				</IconButton>
			</DialogTitle>

			<DialogContent
				sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}
			>
				{/* Top Info Bar */}
				<Box
					sx={{
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'space-between',
						flexWrap: 'wrap',
						gap: 1.5,
						p: 1.5,
						bgcolor: '#f1f5f9',
						borderRadius: 2,
						border: '1px solid #e2e8f0',
					}}
				>
					<Box
						sx={{
							display: 'flex',
							alignItems: 'center',
							gap: 1,
							flexWrap: 'wrap',
						}}
					>
						<Chip
							icon={<MapPin size={14} color="#004680" />}
							label={`${lat.toFixed(6)}, ${lon.toFixed(6)}`}
							size="small"
							sx={{
								bgcolor: '#e0f2fe',
								color: '#004680',
								fontWeight: 700,
								fontSize: '0.8rem',
							}}
						/>
						{accuracy != null && accuracy > 0 && (
							<Chip
								label={`Precisión: ±${Math.round(accuracy)}m`}
								size="small"
								variant="outlined"
								sx={{
									borderColor: '#cbd5e1',
									color: '#475569',
									fontWeight: 600,
									fontSize: '0.78rem',
								}}
							/>
						)}
					</Box>

					<Button
						component="a"
						href={googleMapsUrl}
						target="_blank"
						rel="noopener noreferrer"
						size="small"
						variant="outlined"
						startIcon={<ExternalLink size={14} />}
						sx={{
							textTransform: 'none',
							fontWeight: 600,
							borderColor: '#cbd5e1',
							color: '#004680',
							borderRadius: 1.5,
							fontSize: '0.8rem',
							'&:hover': {
								borderColor: '#004680',
								bgcolor: 'rgba(0, 70, 128, 0.05)',
							},
						}}
					>
						Abrir en Google Maps
					</Button>
				</Box>

				{/* Enlarged Leaflet Map */}
				<Box
					sx={{
						width: '100%',
						height: { xs: 350, sm: 460 },
						borderRadius: 2.5,
						overflow: 'hidden',
					}}
				>
					{open && (
						<Suspense
							fallback={
								<Box
									sx={{
										width: '100%',
										height: '100%',
										bgcolor: '#f8fafc',
										borderRadius: 2.5,
										display: 'flex',
										alignItems: 'center',
										justifyContent: 'center',
										color: '#94a3b8',
									}}
								>
									Cargando mapa...
								</Box>
							}
						>
							<LeafletMap
								lat={lat}
								lon={lon}
								accuracy={accuracy}
								title={title}
								hora={hora}
								height="100%"
								zoom={17}
							/>
						</Suspense>
					)}
				</Box>
			</DialogContent>
		</Dialog>
	);
}
