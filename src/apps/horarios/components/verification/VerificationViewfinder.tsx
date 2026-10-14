import { Box, Button, Chip, CircularProgress, Typography } from '@mui/material';
import { AlertTriangle } from 'lucide-react';
import type React from 'react';
import type { CapturedPhoto } from '../../hooks/useInAppCamera';

interface VerificationViewfinderProps {
	videoRef: React.RefObject<HTMLVideoElement>;
	isCameraActive: boolean;
	isCameraLoading: boolean;
	cameraError: string | null;
	onRetryCamera: () => void;
	capturedPhoto: CapturedPhoto | null;
	faceDetected: boolean;
	isFaceCentered: boolean;
	faceMessage: string;
	countdownProgress: number;
	isAutoCapturing: boolean;
}

export const VerificationViewfinder: React.FC<VerificationViewfinderProps> = ({
	videoRef,
	isCameraActive,
	isCameraLoading,
	cameraError,
	onRetryCamera,
	capturedPhoto,
	faceDetected,
	isFaceCentered,
	faceMessage,
	countdownProgress,
	isAutoCapturing,
}) => {
	return (
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
								onClick={onRetryCamera}
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

					{/* Facial Oval Framing Guide with dynamic colors */}
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
							<Box
								sx={{
									width: '68%',
									height: '76%',
									borderRadius: '50%',
									border: isFaceCentered
										? '3px solid #22c55e'
										: faceDetected
											? '2px dashed #f59e0b'
											: '2px dashed rgba(255, 255, 255, 0.75)',
									boxShadow: isFaceCentered
										? '0 0 20px rgba(34, 197, 94, 0.5), 0 0 0 9999px rgba(10, 15, 26, 0.35)'
										: '0 0 0 9999px rgba(10, 15, 26, 0.35)',
									transition: 'border 0.2s ease, box-shadow 0.2s ease',
								}}
							/>

							{/* Bottom Prompt with countdown progress */}
							<Box
								sx={{
									position: 'absolute',
									bottom: 12,
									bgcolor: isFaceCentered
										? 'rgba(22, 101, 52, 0.9)'
										: faceDetected
											? 'rgba(180, 83, 9, 0.9)'
											: 'rgba(15, 23, 42, 0.75)',
									backdropFilter: 'blur(6px)',
									px: 1.8,
									py: 0.6,
									borderRadius: 4,
									border: '1px solid',
									borderColor: isFaceCentered
										? '#4ade80'
										: faceDetected
											? '#fbbf24'
											: 'rgba(255, 255, 255, 0.15)',
									transition: 'all 0.2s ease',
								}}
							>
								<Typography
									variant="caption"
									sx={{
										color: '#f8fafc',
										fontSize: '0.74rem',
										fontWeight: 700,
										letterSpacing: '0.01em',
									}}
								>
									{isAutoCapturing
										? '¡Capturando fotografía!'
										: isFaceCentered
											? `¡No te muevas! (${Math.round(countdownProgress * 100)}%)`
											: faceMessage}
								</Typography>
							</Box>
						</Box>
					)}
				</>
			)}

			{/* Top Live Badges */}
			{isCameraActive && !capturedPhoto && (
				<Box
					sx={{
						position: 'absolute',
						top: 10,
						left: 10,
						display: 'flex',
						gap: 0.8,
						alignItems: 'center',
					}}
				>
					<Chip
						label="En vivo"
						size="small"
						sx={{
							height: 22,
							fontSize: '0.65rem',
							fontWeight: 700,
							bgcolor: 'rgba(239, 68, 68, 0.85)',
							color: '#ffffff',
						}}
					/>
					<Chip
						label={
							isFaceCentered
								? 'Rostro alineado'
								: faceDetected
									? 'Rostro detectado'
									: 'Buscando rostro...'
						}
						size="small"
						sx={{
							height: 22,
							fontSize: '0.65rem',
							fontWeight: 700,
							bgcolor: isFaceCentered
								? 'rgba(34, 197, 94, 0.9)'
								: faceDetected
									? 'rgba(245, 158, 11, 0.9)'
									: 'rgba(15, 23, 42, 0.75)',
							color: '#ffffff',
							border: '1px solid rgba(255, 255, 255, 0.2)',
						}}
					/>
				</Box>
			)}
		</Box>
	);
};
