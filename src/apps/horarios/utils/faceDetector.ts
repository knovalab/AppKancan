export interface FaceBox {
	x: number;
	y: number;
	width: number;
	height: number;
}

export interface FaceDetectionStatus {
	hasFace: boolean;
	box: FaceBox | null;
	isCentered: boolean;
	message: string;
}

/**
 * Checks if a detected face bounding box is properly centered and sized
 * within the standard portrait framing oval.
 */
export function checkFaceFraming(
	box: FaceBox,
	videoWidth: number,
	videoHeight: number,
): { isCentered: boolean; message: string } {
	if (videoWidth === 0 || videoHeight === 0) {
		return { isCentered: false, message: 'Iniciando cámara...' };
	}

	const faceCenterX = box.x + box.width / 2;
	const faceCenterY = box.y + box.height / 2;

	// Horizontal alignment: Center should be near 50% of the video width (within ±18%)
	const xDeviation = Math.abs(faceCenterX - videoWidth / 2) / videoWidth;

	// Vertical alignment: In portrait selfies, the oval is positioned slightly above mid (44%-50%)
	const yDeviation = Math.abs(faceCenterY - videoHeight * 0.46) / videoHeight;

	// Relative width of face compared to the full frame
	const faceRatio = box.width / videoWidth;

	if (faceRatio < 0.22) {
		return { isCentered: false, message: 'Acércate un poco más a la cámara' };
	}
	if (faceRatio > 0.72) {
		return { isCentered: false, message: 'Aléjate un poco de la cámara' };
	}
	if (xDeviation > 0.18) {
		return { isCentered: false, message: 'Centra tu rostro en el óvalo' };
	}
	if (yDeviation > 0.22) {
		return { isCentered: false, message: 'Alinea tu rostro dentro del óvalo' };
	}

	return { isCentered: true, message: '¡Perfecto! No te muevas...' };
}

export interface ImageValidationResult {
	isValid: boolean;
	error?: string;
	skinRatio?: number;
	avgBrightness?: number;
}

/**
 * Validates that a captured photo canvas contains a well-lit human face/subject,
 * blocking completely empty walls, dark screens, or covered cameras.
 * Works 100% locally and instantly without external dependencies.
 */
export function validateCapturedImage(
	canvas: HTMLCanvasElement,
): ImageValidationResult {
	const ctx = canvas.getContext('2d', { willReadFrequently: true });
	if (!ctx) return { isValid: true };

	const { width, height } = canvas;
	if (width === 0 || height === 0) {
		return { isValid: false, error: 'Dimensiones de imagen inválidas.' };
	}

	try {
		// 1. Analyze overall brightness and contrast
		const fullFrame = ctx.getImageData(0, 0, width, height);
		const data = fullFrame.data;

		let totalBrightness = 0;
		let minB = 255;
		let maxB = 0;
		let sampleCount = 0;

		// Sample every 8th pixel for instant performance
		for (let i = 0; i < data.length; i += 32) {
			const r = data[i];
			const g = data[i + 1];
			const b = data[i + 2];
			const luma = 0.299 * r + 0.587 * g + 0.114 * b;
			totalBrightness += luma;
			if (luma < minB) minB = luma;
			if (luma > maxB) maxB = luma;
			sampleCount++;
		}

		const avgBrightness = sampleCount > 0 ? totalBrightness / sampleCount : 0;
		const contrast = maxB - minB;

		// Pitch black or camera covered
		if (avgBrightness < 15) {
			return {
				isValid: false,
				error:
					'La fotografía está demasiado oscura o la cámara está obstruida.',
				avgBrightness,
			};
		}

		// Completely flat uniform color (blank screen, covered lens, flat solid surface)
		if (contrast < 22) {
			return {
				isValid: false,
				error:
					'No se detecta una imagen válida (cámara tapada o superficie plana).',
				avgBrightness,
			};
		}

		// 2. Analyze the central facial oval region for human presence, skin tones, and facial features
		const ovalX = Math.floor(width * 0.22);
		const ovalY = Math.floor(height * 0.18);
		const ovalW = Math.floor(width * 0.56);
		const ovalH = Math.floor(height * 0.58);

		const centerData = ctx.getImageData(ovalX, ovalY, ovalW, ovalH).data;
		let skinPixels = 0;
		let totalCenterSamples = 0;

		let leftEyeFeatures = 0;
		let rightEyeFeatures = 0;
		let leftEyeSamples = 0;
		let rightEyeSamples = 0;
		let lowerFaceFeatures = 0;
		let lowerFaceSamples = 0;

		const eyeYMin = Math.floor(ovalH * 0.22);
		const eyeYMax = Math.floor(ovalH * 0.52);
		const leftXMin = Math.floor(ovalW * 0.12);
		const leftXMax = Math.floor(ovalW * 0.46);
		const rightXMin = Math.floor(ovalW * 0.54);
		const rightXMax = Math.floor(ovalW * 0.88);

		const mouthYMin = Math.floor(ovalH * 0.6);
		const mouthYMax = Math.floor(ovalH * 0.86);

		// Sample on a grid for optimal performance and spatial accuracy
		const step = 4;
		for (let y = 0; y < ovalH; y += step) {
			for (let x = 0; x < ovalW; x += step) {
				const idx = (y * ovalW + x) * 4;
				const r = centerData[idx];
				const g = centerData[idx + 1];
				const b = centerData[idx + 2];
				const luma = 0.299 * r + 0.587 * g + 0.114 * b;

				totalCenterSamples++;

				// Standard human skin color distribution in RGB across all ethnicities
				const isSkin =
					r > 45 &&
					g > 30 &&
					b > 20 &&
					r > g &&
					r > b &&
					Math.abs(r - g) > 10 &&
					Math.max(r, g, b) - Math.min(r, g, b) > 14;

				if (isSkin) {
					skinPixels++;
				}

				// Check Eye & Brow Band
				if (y >= eyeYMin && y <= eyeYMax) {
					// Left Eye Zone
					if (x >= leftXMin && x <= leftXMax) {
						leftEyeSamples++;
						if (luma < 95 || (isSkin && luma < 120 && Math.abs(r - g) < 18)) {
							leftEyeFeatures++;
						}
					}
					// Right Eye Zone
					if (x >= rightXMin && x <= rightXMax) {
						rightEyeSamples++;
						if (luma < 95 || (isSkin && luma < 120 && Math.abs(r - g) < 18)) {
							rightEyeFeatures++;
						}
					}
				}

				// Check Lower Face (mouth / nose)
				if (y >= mouthYMin && y <= mouthYMax) {
					lowerFaceSamples++;
					if (luma < 100 || (r > g + 25 && g > b)) {
						lowerFaceFeatures++;
					}
				}
			}
		}

		const skinRatio =
			totalCenterSamples > 0 ? skinPixels / totalCenterSamples : 0;

		// Check 1: If not enough human skin/face tone (e.g., empty wall, floor, clothes)
		if (skinRatio < 0.12) {
			return {
				isValid: false,
				error:
					'No se detectó un rostro dentro del óvalo. Por favor encuadra tu rostro.',
				skinRatio,
				avgBrightness,
			};
		}

		// Check 2: Anti-occlusion check (Hand, palm, or object covering face)
		const leftEyeRatio =
			leftEyeSamples > 0 ? leftEyeFeatures / leftEyeSamples : 0;
		const rightEyeRatio =
			rightEyeSamples > 0 ? rightEyeFeatures / rightEyeSamples : 0;
		const lowerRatio =
			lowerFaceSamples > 0 ? lowerFaceFeatures / lowerFaceSamples : 0;

		// If the eye region has no dark eye/brow landmarks (flat hand/palm covering the face)
		if (leftEyeRatio < 0.025 && rightEyeRatio < 0.025) {
			return {
				isValid: false,
				error:
					'Rostro cubierto o no visible. Por favor retira tu mano u objeto de tu rostro.',
				skinRatio,
				avgBrightness,
			};
		}

		if (leftEyeRatio < 0.015 || rightEyeRatio < 0.015) {
			return {
				isValid: false,
				error:
					'Parte de tu rostro está tapada. Asegúrate de mostrar tu rostro completo.',
				skinRatio,
				avgBrightness,
			};
		}

		if (lowerRatio < 0.012 && (leftEyeRatio < 0.04 || rightEyeRatio < 0.04)) {
			return {
				isValid: false,
				error:
					'Rostro parcialmente cubierto. Retira cualquier obstáculo de tu rostro.',
				skinRatio,
				avgBrightness,
			};
		}

		return {
			isValid: true,
			skinRatio,
			avgBrightness,
		};
	} catch (e) {
		console.warn('Error validando contenido de imagen:', e);
		return { isValid: true };
	}
}

/**
 * Local face detector manager.
 * Prefers the native browser Shape Detection API (window.FaceDetector) when available,
 * and seamlessly supports face-api.js (or @vladmandic/face-api) when loaded in window.
 */
export class LocalFaceDetector {
	private nativeDetector: any = null;
	private faceapiInstance: any = null;
	private isInitialized = false;

	async init(): Promise<boolean> {
		if (typeof window === 'undefined') return false;

		// 1. Check native browser Shape Detection API (window.FaceDetector)
		if ('FaceDetector' in window) {
			try {
				this.nativeDetector = new (window as any).FaceDetector({
					fastMode: true,
					maxDetectedFaces: 1,
				});
				this.isInitialized = true;
				console.log(
					'✅ [AutoFace] Usando detector nativo del navegador (Shape Detection API)',
				);
				return true;
			} catch (e) {
				console.warn(
					'⚠️ [AutoFace] Error inicializando FaceDetector nativo:',
					e,
				);
			}
		}

		// 2. Try loading @vladmandic/face-api or window.faceapi
		try {
			let faceapi = (window as any).faceapi;
			if (!faceapi) {
				try {
					faceapi = await import('@vladmandic/face-api');
				} catch (_importErr) {
					console.warn(
						'ℹ️ [AutoFace] El paquete @vladmandic/face-api no está instalado aún en node_modules. Ejecuta: npm install',
					);
				}
			}

			if (faceapi?.nets?.tinyFaceDetector) {
				this.faceapiInstance = faceapi;
				const modelPaths = [
					'/models',
					'/node_modules/@vladmandic/face-api/model',
					'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.12/model',
				];

				for (const path of modelPaths) {
					try {
						if (!faceapi.nets.tinyFaceDetector.isLoaded) {
							await faceapi.nets.tinyFaceDetector.loadFromUri(path);
						}
						if (faceapi.nets.tinyFaceDetector.isLoaded) {
							this.isInitialized = true;
							console.log(
								`✅ [AutoFace] Modelo tinyFaceDetector cargado exitosamente desde: ${path}`,
							);
							return true;
						}
					} catch {
						// Try next path
					}
				}
			}
		} catch (e) {
			console.warn('⚠️ [AutoFace] Error cargando face-api:', e);
		}

		return false;
	}

	async detect(video: HTMLVideoElement): Promise<FaceBox | null> {
		if (!video || video.readyState < 2 || video.paused || video.ended) {
			return null;
		}

		// 1. Native Shape Detection
		if (this.nativeDetector) {
			try {
				const faces = await this.nativeDetector.detect(video);
				if (faces && faces.length > 0) {
					const rect = faces[0].boundingBox;
					return {
						x: rect.x,
						y: rect.y,
						width: rect.width,
						height: rect.height,
					};
				}
				return null;
			} catch {
				return null;
			}
		}

		// 2. face-api.js / @vladmandic/face-api
		const faceapi = this.faceapiInstance || (window as any).faceapi;
		if (faceapi?.nets?.tinyFaceDetector?.isLoaded) {
			try {
				const detection = await faceapi.detectSingleFace(
					video,
					new faceapi.TinyFaceDetectorOptions({
						inputSize: 224,
						scoreThreshold: 0.5,
					}),
				);
				if (detection?.box) {
					return {
						x: detection.box.x,
						y: detection.box.y,
						width: detection.box.width,
						height: detection.box.height,
					};
				}
				return null;
			} catch {
				return null;
			}
		}

		return null;
	}

	get isReady(): boolean {
		return this.isInitialized;
	}
}
