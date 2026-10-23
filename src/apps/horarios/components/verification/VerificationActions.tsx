import { Box, Button, CircularProgress } from '@mui/material';
import { Camera, Check, Lock, MapPin, RefreshCw } from 'lucide-react';
import type React from 'react';
import type { CapturedPhoto } from '../../hooks/useInAppCamera';

interface VerificationActionsProps {
	capturedPhoto: CapturedPhoto | null;
	isSubmitting: boolean;
	canConfirm: boolean;
	isCameraActive: boolean;
	isCameraLoading: boolean;
	hasGps: boolean;
	isGpsLoading: boolean;
	faceDetected: boolean;
	isFaceCentered: boolean;
	onRetake: () => void;
	onConfirm: () => void;
	onCapture: () => void;
}

export const VerificationActions: React.FC<VerificationActionsProps> = ({
	capturedPhoto,
	isSubmitting,
	canConfirm,
	isCameraActive,
	isCameraLoading,
	hasGps,
	isGpsLoading,
	faceDetected,
	isFaceCentered,
	onRetake,
	onConfirm,
	onCapture,
}) => {
	const isReadyToCapture =
		isCameraActive &&
		!isCameraLoading &&
		hasGps &&
		faceDetected &&
		isFaceCentered;

	const getManualButtonState = () => {
		if (isCameraLoading || !isCameraActive) {
			return {
				label: 'Iniciando cámara...',
				icon: <CircularProgress size={16} color="inherit" />,
			};
		}
		if (!hasGps) {
			return {
				label: isGpsLoading
					? 'Buscando señal GPS...'
					: 'Ubicación GPS requerida',
				icon: <MapPin size={18} />,
			};
		}
		if (!faceDetected) {
			return {
				label: 'Encuadra tu rostro',
				icon: <Lock size={18} />,
			};
		}
		if (!isFaceCentered) {
			return {
				label: 'Centra tu rostro en el óvalo',
				icon: <Lock size={18} />,
			};
		}
		return {
			label: 'Tomar Fotografía',
			icon: <Camera size={18} />,
		};
	};

	const buttonState = getManualButtonState();

	return (
		<Box sx={{ display: 'flex', gap: 1.5, mt: 1 }}>
			{capturedPhoto ? (
				<>
					<Button
						variant="outlined"
						fullWidth
						onClick={onRetake}
						disabled={isSubmitting}
						startIcon={<RefreshCw size={16} />}
						sx={{
							borderRadius: 2.5,
							py: 1.2,
							textTransform: 'none',
							fontWeight: 600,
							borderColor: '#cbd5e1',
							color: '#475569',
						}}
					>
						Tomar otra
					</Button>
					<Button
						variant="contained"
						fullWidth
						onClick={onConfirm}
						disabled={!canConfirm}
						startIcon={
							isSubmitting ? (
								<CircularProgress size={16} color="inherit" />
							) : (
								<Check size={16} />
							)
						}
						sx={{
							borderRadius: 2.5,
							py: 1.2,
							textTransform: 'none',
							fontWeight: 700,
							bgcolor: '#16a34a',
							'&:hover': { bgcolor: '#15803d' },
						}}
					>
						{isSubmitting ? 'Guardando...' : 'Confirmar'}
					</Button>
				</>
			) : (
				<Button
					variant="contained"
					fullWidth
					onClick={onCapture}
					disabled={!isReadyToCapture}
					startIcon={buttonState.icon}
					sx={{
						borderRadius: 2.5,
						py: 1.3,
						textTransform: 'none',
						fontWeight: 700,
						transition: 'all 0.2s ease',
						...(isReadyToCapture
							? {
									bgcolor: '#004680',
									color: '#ffffff',
									'&:hover': { bgcolor: '#003a6b' },
									boxShadow: '0 4px 12px rgba(0, 70, 128, 0.25)',
								}
							: {
									bgcolor: '#f1f5f9 !important',
									color: '#94a3b8 !important',
									border: '1px solid #e2e8f0',
									boxShadow: 'none',
									cursor: 'not-allowed',
								}),
					}}
				>
					{buttonState.label}
				</Button>
			)}
		</Box>
	);
};
