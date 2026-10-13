import { useCallback, useEffect, useRef, useState } from 'react';

export interface CapturedPhoto {
	blob: Blob;
	dataUrl: string;
}

export interface UseInAppCameraReturn {
	videoRef: React.RefObject<HTMLVideoElement>;
	isActive: boolean;
	loading: boolean;
	error: string | null;
	startCamera: () => Promise<boolean>;
	stopCamera: () => void;
	capturePhoto: () => Promise<CapturedPhoto | null>;
}

export interface CameraConfig {
	/** Target pixel width for the captured photo. Default: 720 */
	targetWidth?: number;
	/** Target pixel height for the captured photo. Default: 900 (4:5 portrait) */
	targetHeight?: number;
	/** JPEG compression quality between 0.0 and 1.0. Default: 0.82 */
	quality?: number;
}

/**
 * Hook to manage strictly in-app camera capture via WebRTC (navigator.mediaDevices.getUserMedia).
 * Prevents usage of device gallery / file picker and captures frames via offscreen canvas.
 */
export function useInAppCamera(config: CameraConfig = {}): UseInAppCameraReturn {
	const {
		targetWidth = 720,
		targetHeight = 900,
		quality = 0.82,
	} = config;

	const videoRef = useRef<HTMLVideoElement>(null);
	const streamRef = useRef<MediaStream | null>(null);

	const [isActive, setIsActive] = useState(false);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

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
	}, []);

	const startCamera = useCallback(async (): Promise<boolean> => {
		stopCamera();
		setError(null);
		setLoading(true);

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
			if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
				msg =
					'Permiso de cámara denegado. Permite el acceso a la cámara en la configuración del navegador.';
			} else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
				msg = 'No se encontró ninguna cámara disponible en tu dispositivo.';
			} else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
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
		if (!video || !isActive || video.videoWidth === 0 || video.videoHeight === 0) {
			setError('La cámara no está lista para capturar la imagen.');
			return Promise.resolve(null);
		}

		return new Promise((resolve) => {
			try {
				const canvas = document.createElement('canvas');
				canvas.width = targetWidth;
				canvas.height = targetHeight;

				const ctx = canvas.getContext('2d');
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

				const dataUrl = canvas.toDataURL('image/jpeg', quality);

				canvas.toBlob(
					(blob) => {
						if (!blob) {
							resolve(null);
							return;
						}
						resolve({ blob, dataUrl });
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
	};
}
