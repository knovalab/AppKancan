import {
	Alert,
	Box,
	Button,
	Chip,
	CircularProgress,
	Dialog,
	DialogContent,
	DialogTitle,
	IconButton,
	Typography,
} from '@mui/material';
import {
	AlertTriangle,
	Camera,
	Check,
	MapPin,
	RefreshCw,
	X,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { uploadAttendancePhoto } from '../api/directus/upload';
import { useHighPrecisionLocation } from '../hooks/useHighPrecisionLocation';
import { CapturedPhoto, useInAppCamera } from '../hooks/useInAppCamera';

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
	const {
		videoRef,
		isActive: isCameraActive,
		loading: isCameraLoading,
		error: cameraError,
		startCamera,
		stopCamera,
		capturePhoto,
	} = useInAppCamera({
		targetWidth: 720,
		targetHeight: 900,
	});

	const {
		coords,
		loading: isGpsLoading,
		error: gpsError,
		acquireLocation,
	} = useHighPrecisionLocation();

	const [capturedPhoto, setCapturedPhoto] = useState<CapturedPhoto | null>(
		null,
	);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [submitError, setSubmitError] = useState<string | null>(null);

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
		}
	};

	const handleConfirmSubmission = async () => {
		if (!capturedPhoto) {
			setSubmitError('Por favor captura una fotografía para continuar.');
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
			// 1. Upload photo to Directus
			const fileId = await uploadAttendancePhoto(
				capturedPhoto.blob,
				`marcacion_${eventName.replace(/\s+/g, '_')}_${Date.now()}.jpg`,
			);

			// 2. Call onConfirm with verification payload
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
				{/* GPS Precision Status Banner */}
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
							onClick={() => acquireLocation()}
							disabled={isSubmitting}
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

				{/* Camera Viewfinder / Preview Box */}
				<Box
					sx={{
						position: 'relative',
						width: '100%',
						maxWidth: 360,
						mx: 'auto',
						aspectRatio: '4/5',
						borderRadius: 3.5,
						overflow: 'hidden',
						bgcolor: '#090d16',
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'center',
						boxShadow:
							'0 10px 25px -5px rgba(0,0,0,0.3), inset 0 0 20px rgba(0,0,0,0.5)',
					}}
				>
					{capturedPhoto ? (
						<Box
							component="img"
							src={capturedPhoto.dataUrl}
							alt="Foto capturada"
							sx={{
								width: '100%',
								height: '100%',
								objectFit: 'cover',
								transform: 'scaleX(-1)', // Match selfie mirror
							}}
						/>
					) : (
						<>
							<video
								ref={videoRef}
								autoPlay
								playsInline
								muted
								style={{
									width: '100%',
									height: '100%',
									objectFit: 'cover',
									transform: 'scaleX(-1)', // Mirror viewfinder
									display: isCameraActive ? 'block' : 'none',
								}}
							/>

							{isCameraLoading && (
								<Box
									sx={{
										display: 'flex',
										flexDirection: 'column',
										alignItems: 'center',
										gap: 1,
									}}
								>
									<CircularProgress size={28} sx={{ color: '#38bdf8' }} />
									<Typography variant="caption" sx={{ color: '#94a3b8' }}>
										Iniciando cámara frontal...
									</Typography>
								</Box>
							)}

							{cameraError && !isCameraLoading && (
								<Box sx={{ p: 2, textAlign: 'center' }}>
									<AlertTriangle
										size={28}
										color="#f87171"
										style={{ margin: '0 auto 8px' }}
									/>
									<Typography
										variant="caption"
										sx={{ color: '#fca5a5', display: 'block' }}
									>
										{cameraError}
									</Typography>
									<Button
										size="small"
										variant="outlined"
										onClick={startCamera}
										sx={{
											mt: 1.5,
											color: '#38bdf8',
											borderColor: '#0284c7',
											textTransform: 'none',
										}}
									>
										Reintentar cámara
									</Button>
								</Box>
							)}

							{/* Framing Guide Overlay - Facial Oval for Mobile */}
							{isCameraActive && (
								<Box
									sx={{
										position: 'absolute',
										inset: 0,
										display: 'flex',
										flexDirection: 'column',
										alignItems: 'center',
										justifyContent: 'center',
										pointerEvents: 'none',
									}}
								>
									{/* Face-proportioned vertical oval (height > width) with outer darkening */}
									<Box
										sx={{
											width: '68%',
											height: '76%',
											borderRadius: '50%',
											border: '2px dashed rgba(255, 255, 255, 0.75)',
											boxShadow: '0 0 0 9999px rgba(10, 15, 26, 0.35)',
										}}
									/>

									{/* Bottom Helper Prompt */}
									<Box
										sx={{
											position: 'absolute',
											bottom: 12,
											bgcolor: 'rgba(15, 23, 42, 0.75)',
											backdropFilter: 'blur(6px)',
											px: 1.5,
											py: 0.5,
											borderRadius: 4,
											border: '1px solid rgba(255, 255, 255, 0.15)',
										}}
									>
										<Typography
											variant="caption"
											sx={{
												color: '#f8fafc',
												fontSize: '0.72rem',
												fontWeight: 600,
												letterSpacing: '0.01em',
											}}
										>
											Ubica tu rostro dentro del óvalo
										</Typography>
									</Box>
								</Box>
							)}
						</>
					)}

					{/* Live Indicator Badge */}
					{isCameraActive && !capturedPhoto && (
						<Chip
							label="En vivo"
							size="small"
							sx={{
								position: 'absolute',
								top: 10,
								left: 10,
								height: 22,
								fontSize: '0.65rem',
								fontWeight: 700,
								bgcolor: 'rgba(239, 68, 68, 0.85)',
								color: '#ffffff',
							}}
						/>
					)}
				</Box>

				{submitError && (
					<Alert
						severity="error"
						sx={{ py: 0.5, px: 1.5, fontSize: '0.78rem' }}
					>
						{submitError}
					</Alert>
				)}

				{/* Action Controls */}
				<Box sx={{ display: 'flex', gap: 1.5, mt: 1 }}>
					{capturedPhoto ? (
						<>
							<Button
								variant="outlined"
								fullWidth
								onClick={handleRetake}
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
								onClick={handleConfirmSubmission}
								disabled={isSubmitting || !coords}
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
							onClick={handleCapture}
							disabled={!isCameraActive || isCameraLoading}
							startIcon={<Camera size={18} />}
							sx={{
								borderRadius: 2.5,
								py: 1.3,
								textTransform: 'none',
								fontWeight: 700,
								bgcolor: '#0f172a',
								'&:hover': { bgcolor: '#1e293b' },
							}}
						>
							Tomar Fotografía
						</Button>
					)}
				</Box>
			</DialogContent>
		</Dialog>
	);
};
