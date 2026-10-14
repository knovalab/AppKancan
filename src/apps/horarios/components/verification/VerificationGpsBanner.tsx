import { Alert, Box, CircularProgress, IconButton, Typography } from '@mui/material';
import { MapPin, RefreshCw } from 'lucide-react';
import type React from 'react';
import type { LocationCoordinates } from '../../hooks/useHighPrecisionLocation';

interface VerificationGpsBannerProps {
	coords: LocationCoordinates | null;
	isGpsLoading: boolean;
	gpsError: string | null;
	onAcquireLocation: () => void;
	disabled?: boolean;
}

export const VerificationGpsBanner: React.FC<VerificationGpsBannerProps> = ({
	coords,
	isGpsLoading,
	gpsError,
	onAcquireLocation,
	disabled = false,
}) => {
	return (
		<>
			<Box
				sx={{
					p: 1.5,
					borderRadius: 2,
					bgcolor: coords ? '#f0fdf4' : gpsError ? '#fef2f2' : '#f8fafc',
					border: '1px solid',
					borderColor: coords ? '#bbf7d0' : gpsError ? '#fecaca' : '#e2e8f0',
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'space-between',
					gap: 1.5,
				}}
			>
				<Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
					<MapPin
						size={18}
						color={coords ? '#16a34a' : gpsError ? '#dc2626' : '#64748b'}
					/>
					<Box>
						<Typography
							variant="caption"
							sx={{
								fontWeight: 700,
								display: 'block',
								color: coords ? '#15803d' : gpsError ? '#b91c1c' : '#334155',
							}}
						>
							{isGpsLoading
								? 'Adquiriendo ubicación GPS...'
								: coords
									? 'Ubicación GPS confirmada'
									: 'Ubicación GPS requerida'}
						</Typography>
						{coords && (
							<Typography
								variant="caption"
								sx={{
									color: '#166534',
									fontSize: '0.72rem',
									display: 'block',
								}}
							>
								Ubicación asegurada
							</Typography>
						)}
					</Box>
				</Box>

				{isGpsLoading ? (
					<CircularProgress size={16} sx={{ color: '#0284c7' }} />
				) : (
					<IconButton
						size="small"
						onClick={onAcquireLocation}
						disabled={disabled}
						title="Reintentar señal GPS"
						sx={{ p: 0.5 }}
					>
						<RefreshCw
							size={14}
							className={isGpsLoading ? 'animate-spin' : ''}
						/>
					</IconButton>
				)}
			</Box>

			{gpsError && (
				<Alert
					severity="warning"
					sx={{ py: 0.5, px: 1.5, fontSize: '0.78rem' }}
				>
					{gpsError}
				</Alert>
			)}
		</>
	);
};

