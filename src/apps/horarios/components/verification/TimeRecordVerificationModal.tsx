import {
	Alert,
	Box,
	Dialog,
	DialogContent,
	DialogTitle,
	IconButton,
	Typography,
} from '@mui/material';
import { X } from 'lucide-react';
import type React from 'react';
import { useCallback, useEffect, useState } from 'react';
import { uploadAttendancePhoto } from '../../api/directus/upload';
import { useHighPrecisionLocation } from '../../hooks/useHighPrecisionLocation';
import { type CapturedPhoto, useInAppCamera } from '../../hooks/useInAppCamera';
import { VerificationActions } from './VerificationActions';
import { VerificationGpsBanner } from './VerificationGpsBanner';
import { VerificationViewfinder } from './VerificationViewfinder';

export interface VerificationData {
	latitude: number;
	longitude: number;
	accuracy: number;
	photo: string; // Directus file UUID
}

interface TimeRecordVerificationModalProps {
	open: boolean;
	onClose: () => void;
	employeeName: string;
	eventName: string;
	onConfirm: (data: VerificationData) => Promise<void>;
}

export const TimeRecordVerificationModal: React.FC<
	TimeRecordVerificationModalProps
> = ({ open, onClose, employeeName, eventName, onConfirm }) => {
	const [capturedPhoto, setCapturedPhoto] = useState<CapturedPhoto | null>(
		null,
	);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [submitError, setSubmitError] = useState<string | null>(null);

	const handlePhotoCaptured = useCallback((photo: CapturedPhoto) => {
		setCapturedPhoto(photo);
	}, []);

	const {
		videoRef,
		isActive: isCameraActive,
		loading: isCameraLoading,
		error: cameraError,
		startCamera,
		stopCamera,
		capturePhoto,
		faceDetected,
		isFaceCentered,
		faceMessage,
		countdownProgress,
		isAutoCapturing,
	} = useInAppCamera({
		targetWidth: 720,
		targetHeight: 900,
		enableAutoCapture: true,
		onAutoCaptured: handlePhotoCaptured,
	});

	const {
		coords,
		loading: isGpsLoading,
		error: gpsError,
		acquireLocation,
	} = useHighPrecisionLocation();

	// Start camera and acquire GPS when modal opens
	useEffect(() => {
		if (open) {
			setCapturedPhoto(null);
			setSubmitError(null);
			startCamera();
			acquireLocation();
		} else {
			stopCamera();
		}
	}, [open, startCamera, stopCamera, acquireLocation]);

	useEffect(() => {
		if (capturedPhoto) {
			stopCamera();
		}
	}, [capturedPhoto, stopCamera]);

	const handleRetake = () => {
		setCapturedPhoto(null);
		setSubmitError(null);
		startCamera();
	};

	const handleCapture = async () => {
		setSubmitError(null);
		const photo = await capturePhoto();
		if (photo) {
			setCapturedPhoto(photo);
			stopCamera();
		} else {
			setSubmitError(
				'No se detectó un rostro en la fotografía. Debes encuadrar tu rostro dentro del óvalo para continuar.',
			);
		}
	};

	const handleConfirmSubmission = async () => {
		if (!capturedPhoto) {
			setSubmitError(
				'Debes capturar una fotografía válida de tu rostro para continuar.',
			);
			return;
		}

		if (!coords) {
			setSubmitError(
				'Se requiere una lectura de GPS precisa para registrar la asistencia.',
			);
			return;
		}

		setIsSubmitting(true);
		setSubmitError(null);

		try {
			const fileId = await uploadAttendancePhoto(
				capturedPhoto.blob,
				`marcacion_${eventName.replace(/\s+/g, '_')}_${Date.now()}.jpg`,
			);

			await onConfirm({
				latitude: coords.latitude,
				longitude: coords.longitude,
				accuracy: coords.accuracy,
				photo: fileId,
			});

			onClose();
		} catch (err: any) {
			console.error('❌ Error guardando verificación:', err);
			setSubmitError(
				err?.message || 'Error al procesar la marcación con foto y GPS.',
			);
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<Dialog
			open={open}
			onClose={isSubmitting ? undefined : onClose}
			maxWidth="xs"
			fullWidth
			slotProps={{
				paper: {
					sx: {
						borderRadius: 4,
						overflow: 'hidden',
						p: 0,
						bgcolor: '#ffffff',
						m: { xs: 1.5, sm: 3 },
					},
				},
			}}
		>
			<DialogTitle
				sx={{
					m: 0,
					px: 3,
					py: 2,
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'space-between',
					borderBottom: '1px solid #f1f5f9',
				}}
			>
				<Box>
					<Typography
						variant="caption"
						sx={{ color: '#64748b', fontWeight: 600 }}
					>
						Verificación de Asistencia
					</Typography>
					<Typography
						variant="h6"
						sx={{ fontWeight: 700, color: '#0f172a', fontSize: '1.1rem' }}
					>
						{eventName}
					</Typography>
					<Typography
						variant="body2"
						sx={{ color: '#475569', fontWeight: 500 }}
					>
						{employeeName}
					</Typography>
				</Box>
				{!isSubmitting && (
					<IconButton onClick={onClose} size="small" sx={{ color: '#94a3b8' }}>
						<X size={20} />
					</IconButton>
				)}
			</DialogTitle>

			<DialogContent
				sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 2 }}
			>
				<VerificationGpsBanner
					coords={coords}
					isGpsLoading={isGpsLoading}
					gpsError={gpsError}
					onAcquireLocation={acquireLocation}
					disabled={isSubmitting}
				/>

				<VerificationViewfinder
					videoRef={videoRef}
					isCameraActive={isCameraActive}
					isCameraLoading={isCameraLoading}
					cameraError={cameraError}
					onRetryCamera={startCamera}
					capturedPhoto={capturedPhoto}
					faceDetected={faceDetected}
					isFaceCentered={isFaceCentered}
					faceMessage={faceMessage}
					countdownProgress={countdownProgress}
					isAutoCapturing={isAutoCapturing}
				/>

				{submitError && (
					<Alert
						severity="error"
						sx={{ py: 0.5, px: 1.5, fontSize: '0.78rem' }}
					>
						{submitError}
					</Alert>
				)}

				<VerificationActions
					capturedPhoto={capturedPhoto}
					isSubmitting={isSubmitting}
					canConfirm={!isSubmitting && !!coords}
					isCameraActive={isCameraActive}
					isCameraLoading={isCameraLoading}
					hasGps={!!coords}
					isGpsLoading={isGpsLoading}
					faceDetected={faceDetected}
					isFaceCentered={isFaceCentered}
					onRetake={handleRetake}
					onConfirm={handleConfirmSubmission}
					onCapture={handleCapture}
				/>
			</DialogContent>
		</Dialog>
	);
};
