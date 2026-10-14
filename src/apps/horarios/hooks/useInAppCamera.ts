import { useCallback, useEffect, useRef, useState } from 'react';
import {
	checkFaceFraming,
	LocalFaceDetector,
	validateCapturedImage,
} from '../utils/faceDetector';

export interface CapturedPhoto {
	blob: Blob;
	dataUrl: string;
}

export interface CameraConfig {
	/** Target pixel width for the captured photo. Default: 720 */
	targetWidth?: number;
	/** Target pixel height for the captured photo. Default: 900 (4:5 portrait) */
	targetHeight?: number;
	/** JPEG compression quality between 0.0 and 1.0. Default: 0.82 */
	quality?: number;
	/** Enable automatic shutter when face is centered and steady. Default: true */
	enableAutoCapture?: boolean;
	/** Required steady duration inside the oval in ms before auto snap. Default: 1100ms */
	holdDurationMs?: number;
	/** Sampling interval in ms for face detection loop. Default: 120ms */
	detectionIntervalMs?: number;
	/** Callback fired when auto capture successfully takes a picture */
	onAutoCaptured?: (photo: CapturedPhoto) => void;
}

export interface UseInAppCameraReturn {
	videoRef: React.RefObject<HTMLVideoElement>;
	isActive: boolean;
	loading: boolean;
	error: string | null;
	startCamera: () => Promise<boolean>;
	stopCamera: () => void;
	capturePhoto: () => Promise<CapturedPhoto | null>;
	/** Whether any human face is currently detected in frame */
	faceDetected: boolean;
	/** Whether the detected face is well-centered inside the portrait oval */
	isFaceCentered: boolean;
	/** Real-time status / guiding message for the user */
	faceMessage: string;
	/** Steady hold progress from 0.0 to 1.0 (reaches 1.0 when photo is snapped) */
	countdownProgress: number;
	/** Whether auto capture is in the process of capturing */
	isAutoCapturing: boolean;
	/** Whether a local face detection engine is active and ready */
	detectorReady: boolean;
}

/**
 * Hook to manage strictly in-app camera capture via WebRTC with local auto face detection.
 * Enforces front-facing camera, crops to 4:5 portrait canvas, strictly validates that a real human face
 * is present, and automatically captures the photo once the employee's face is centered and steady.
 */
export function useInAppCamera(
	config: CameraConfig = {},
): UseInAppCameraReturn {
	const {
		targetWidth = 720,
		targetHeight = 900,
		quality = 0.82,
		enableAutoCapture = true,
		holdDurationMs = 1100,
		detectionIntervalMs = 120,
		onAutoCaptured,
	} = config;

	const videoRef = useRef<HTMLVideoElement>(null);
	const streamRef = useRef<MediaStream | null>(null);
	const detectorRef = useRef<LocalFaceDetector | null>(null);
	const sampleCanvasRef = useRef<HTMLCanvasElement | null>(null);

	const [isActive, setIsActive] = useState(false);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	// Auto face detection states
	const [faceDetected, setFaceDetected] = useState(false);
	const [isFaceCentered, setIsFaceCentered] = useState(false);
	const [faceMessage, setFaceMessage] = useState(
		'Ubica tu rostro dentro del óvalo',
	);
	const [countdownProgress, setCountdownProgress] = useState(0);
	const [isAutoCapturing, setIsAutoCapturing] = useState(false);
	const [detectorReady, setDetectorReady] = useState(false);

	const heldDurationRef = useRef(0);
	const isAutoCapturingRef = useRef(false);
	const onAutoCapturedRef = useRef(onAutoCaptured);
	onAutoCapturedRef.current = onAutoCaptured;

	const stopCamera = useCallback(() => {
		if (streamRef.current) {
			for (const track of streamRef.current.getTracks()) {
				track.stop();
			}
			streamRef.current = null;
		}
		if (videoRef.current) {
			videoRef.current.srcObject = null;
		}
		setIsActive(false);
		setLoading(false);
		setFaceDetected(false);
		setIsFaceCentered(false);
		setCountdownProgress(0);
		setIsAutoCapturing(false);
		isAutoCapturingRef.current = false;
		heldDurationRef.current = 0;
	}, []);

	const startCamera = useCallback(async (): Promise<boolean> => {
		stopCamera();
		setError(null);
		setLoading(true);
		heldDurationRef.current = 0;
		isAutoCapturingRef.current = false;

		if (
			typeof window === 'undefined' ||
			!navigator.mediaDevices ||
			!navigator.mediaDevices.getUserMedia
		) {
			setError(
				'Tu dispositivo o navegador no tiene soporte para captura de video en vivo.',
			);
			setLoading(false);
			return false;
		}

		try {
			// Initialize local face detector in the background
			if (!detectorRef.current) {
				detectorRef.current = new LocalFaceDetector();
				detectorRef.current.init().then((ready) => {
					setDetectorReady(ready);
				});
			}

			// Request front-facing camera for employee selfies
			const stream = await navigator.mediaDevices.getUserMedia({
				video: {
					facingMode: 'user',
					width: { ideal: 1280 },
					height: { ideal: 720 },
				},
				audio: false,
			});

			streamRef.current = stream;

			if (videoRef.current) {
				videoRef.current.srcObject = stream;
				await videoRef.current.play();
			}

			setIsActive(true);
			setLoading(false);
			return true;
		} catch (err: any) {
			console.error('❌ Error accediendo a la cámara:', err);
			let msg = 'No se pudo acceder a la cámara.';
			if (
				err.name === 'NotAllowedError' ||
				err.name === 'PermissionDeniedError'
			) {
				msg =
					'Permiso de cámara denegado. Permite el acceso a la cámara en la configuración del navegador.';
			} else if (
				err.name === 'NotFoundError' ||
				err.name === 'DevicesNotFoundError'
			) {
				msg = 'No se encontró ninguna cámara disponible en tu dispositivo.';
			} else if (
				err.name === 'NotReadableError' ||
				err.name === 'TrackStartError'
			) {
				msg = 'La cámara está siendo utilizada por otra aplicación.';
			}
			setError(msg);
			setLoading(false);
			setIsActive(false);
			return false;
		}
	}, [stopCamera]);

	const capturePhoto = useCallback((): Promise<CapturedPhoto | null> => {
		const video = videoRef.current;
		if (
			!video ||
			!isActive ||
			video.videoWidth === 0 ||
			video.videoHeight === 0
		) {
			setError('La cámara no está lista para capturar la imagen.');
			return Promise.resolve(null);
		}

		return new Promise((resolve) => {
			try {
				const canvas = document.createElement('canvas');
				canvas.width = targetWidth;
				canvas.height = targetHeight;

				const ctx = canvas.getContext('2d', { willReadFrequently: true });
				if (!ctx) {
					resolve(null);
					return;
				}

				// Calculate "cover" crop to center video frame without aspect distortion
				const videoRatio = video.videoWidth / video.videoHeight;
				const targetRatio = targetWidth / targetHeight;

				let sx = 0;
				let sy = 0;
				let sWidth = video.videoWidth;
				let sHeight = video.videoHeight;

				if (videoRatio > targetRatio) {
					// Video is wider than target canvas: crop sides evenly
					sWidth = video.videoHeight * targetRatio;
					sx = (video.videoWidth - sWidth) / 2;
				} else {
					// Video is taller than target canvas: crop top and bottom evenly
					sHeight = video.videoWidth / targetRatio;
					sy = (video.videoHeight - sHeight) / 2;
				}

				// Draw cropped video frame scaled into the standard canvas size
				ctx.drawImage(
					video,
					sx,
					sy,
					sWidth,
					sHeight,
					0,
					0,
					targetWidth,
					targetHeight,
				);

				// STRICT CONTENT VALIDATION: Ensure frame is not empty, black, or faceless
				const validation = validateCapturedImage(canvas);
				if (!validation.isValid) {
					const errMsg =
						validation.error ||
						'No se detectó un rostro en la fotografía. Debes encuadrar tu rostro.';
					setError(errMsg);
					resolve(null);
					return;
				}

				setError(null);
				const dataUrl = canvas.toDataURL('image/jpeg', quality);

				canvas.toBlob(
					(blob) => {
						if (!blob) {
							resolve(null);
							return;
						}
						// Optional haptic vibration feedback on mobile
						if (typeof navigator !== 'undefined' && navigator.vibrate) {
							navigator.vibrate([40]);
						}

						const result = { blob, dataUrl };
						resolve(result);
					},
					'image/jpeg',
					quality,
				);
			} catch (captureErr: any) {
				console.error('❌ Error capturando frame de video:', captureErr);
				setError('Error capturando la fotografía.');
				resolve(null);
			}
		});
	}, [isActive, targetWidth, targetHeight, quality]);

	// Auto Face Detection Loop
	useEffect(() => {
		if (!isActive || !enableAutoCapture) {
			return;
		}

		let isCancelled = false;

		const intervalId = setInterval(async () => {
			const video = videoRef.current;
			const detector = detectorRef.current;

			if (
				!video ||
				!isActive ||
				isAutoCapturingRef.current ||
				video.readyState < 2
			) {
				return;
			}

			try {
				let hasFace = false;
				let isCentered = false;
				let message = 'Ubica tu rostro dentro del óvalo';

				// 1. High-precision ML / Shape Detection if ready
				if (detector?.isReady) {
					const box = await detector.detect(video);
					if (isCancelled || isAutoCapturingRef.current) return;

					if (box) {
						// Check anti-occlusion on the frame
						if (!sampleCanvasRef.current) {
							sampleCanvasRef.current = document.createElement('canvas');
							sampleCanvasRef.current.width = 180;
							sampleCanvasRef.current.height = 225;
						}
						const sCanvas = sampleCanvasRef.current;
						const sCtx = sCanvas.getContext('2d', { willReadFrequently: true });
						let isUncovered = true;

						if (sCtx) {
							sCtx.drawImage(video, 0, 0, 180, 225);
							const val = validateCapturedImage(sCanvas);
							if (!val.isValid) {
								isUncovered = false;
								hasFace = true;
								isCentered = false;
								message = val.error || 'Rostro cubierto. Descubre tu rostro.';
							}
						}

						if (isUncovered) {
							hasFace = true;
							const framing = checkFaceFraming(
								box,
								video.videoWidth,
								video.videoHeight,
							);
							isCentered = framing.isCentered;
							message = framing.message;
						}
					}
				} else {
					// 2. Instant canvas skin-tone & presence fallback (works on any browser with zero setup)
					if (!sampleCanvasRef.current) {
						sampleCanvasRef.current = document.createElement('canvas');
						sampleCanvasRef.current.width = 180;
						sampleCanvasRef.current.height = 225;
					}
					const sCanvas = sampleCanvasRef.current;
					const sCtx = sCanvas.getContext('2d', { willReadFrequently: true });
					if (sCtx) {
						sCtx.drawImage(video, 0, 0, 180, 225);
						const val = validateCapturedImage(sCanvas);
						if (val.isValid) {
							hasFace = true;
							isCentered = true;
							message = '¡Rostro detectado! No te muevas...';
						} else {
							hasFace = false;
							isCentered = false;
							message = val.error || 'Ubica tu rostro dentro del óvalo';
						}
					}
				}

				if (isCancelled || isAutoCapturingRef.current) return;

				setFaceDetected(hasFace);
				setIsFaceCentered(isCentered);
				setFaceMessage(message);

				if (isCentered) {
					heldDurationRef.current += detectionIntervalMs;
					const progress = Math.min(
						1,
						heldDurationRef.current / holdDurationMs,
					);
					setCountdownProgress(progress);

					if (
						heldDurationRef.current >= holdDurationMs &&
						!isAutoCapturingRef.current
					) {
						isAutoCapturingRef.current = true;
						setIsAutoCapturing(true);

						const photo = await capturePhoto();
						if (photo) {
							if (onAutoCapturedRef.current) {
								onAutoCapturedRef.current(photo);
							}
						} else {
							// If photo content failed validation, reset countdown
							isAutoCapturingRef.current = false;
							setIsAutoCapturing(false);
							heldDurationRef.current = 0;
							setCountdownProgress(0);
						}
					}
				} else {
					heldDurationRef.current = 0;
					setCountdownProgress(0);
				}
			} catch {
				// Silently ignore detection loop failures
			}
		}, detectionIntervalMs);

		return () => {
			isCancelled = true;
			clearInterval(intervalId);
		};
	}, [
		isActive,
		enableAutoCapture,
		detectionIntervalMs,
		holdDurationMs,
		capturePhoto,
	]);

	// Automatically cleanup stream on unmount
	useEffect(() => {
		return () => {
			stopCamera();
		};
	}, [stopCamera]);

	return {
		videoRef,
		isActive,
		loading,
		error,
		startCamera,
		stopCamera,
		capturePhoto,
		faceDetected,
		isFaceCentered,
		faceMessage,
		countdownProgress,
		isAutoCapturing,
		detectorReady,
	};
}
