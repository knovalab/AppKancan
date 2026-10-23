import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type CapturedPhoto, useInAppCamera } from '../../hooks/useInAppCamera';
import * as faceDetectorUtils from '../../utils/faceDetector';

const mockDetectorInstance = {
	init: vi.fn().mockResolvedValue(true),
	isReady: true,
	detect: vi.fn().mockResolvedValue({
		x: 100,
		y: 100,
		width: 300,
		height: 350,
	}),
};

vi.mock('../../utils/faceDetector', () => ({
	checkFaceFraming: vi.fn(() => ({
		isCentered: true,
		message: '¡Perfecto! No te muevas...',
	})),
	validateCapturedImage: vi.fn(() => ({ isValid: true })),
	LocalFaceDetector: vi.fn().mockImplementation(() => mockDetectorInstance),
}));

function createMockVideoElement() {
	const mockVideo = document.createElement('video');
	mockVideo.play = vi.fn().mockResolvedValue(undefined);
	Object.defineProperty(mockVideo, 'videoWidth', {
		value: 1280,
		configurable: true,
	});
	Object.defineProperty(mockVideo, 'videoHeight', {
		value: 720,
		configurable: true,
	});
	Object.defineProperty(mockVideo, 'readyState', {
		value: 4,
		configurable: true,
	});
	return mockVideo;
}

describe('useInAppCamera', () => {
	let mockStream: MediaStream;
	let mockTrack: MediaStreamTrack;

	beforeEach(() => {
		vi.clearAllMocks();

		mockDetectorInstance.init.mockResolvedValue(true);
		mockDetectorInstance.isReady = true;
		mockDetectorInstance.detect.mockResolvedValue({
			x: 100,
			y: 100,
			width: 300,
			height: 350,
		});

		vi.mocked(faceDetectorUtils.validateCapturedImage).mockReturnValue({
			isValid: true,
		});
		vi.mocked(faceDetectorUtils.checkFaceFraming).mockReturnValue({
			isCentered: true,
			message: '¡Perfecto! No te muevas...',
		});

		mockTrack = {
			stop: vi.fn(),
		} as unknown as MediaStreamTrack;

		mockStream = {
			getTracks: vi.fn(() => [mockTrack]),
		} as unknown as MediaStream;

		// Setup navigator.mediaDevices.getUserMedia
		Object.defineProperty(navigator, 'mediaDevices', {
			value: {
				getUserMedia: vi.fn().mockResolvedValue(mockStream),
			},
			configurable: true,
			writable: true,
		});

		// Mock canvas context and blob generation
		HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({
			drawImage: vi.fn(),
		} as unknown as CanvasRenderingContext2D);

		HTMLCanvasElement.prototype.toDataURL = vi
			.fn()
			.mockReturnValue('data:image/jpeg;base64,fake');

		HTMLCanvasElement.prototype.toBlob = vi
			.fn()
			.mockImplementation((callback: BlobCallback) => {
				const blob = new Blob(['fake'], { type: 'image/jpeg' });
				callback(blob);
			});
	});

	it('should return initial idle state with all default face detection states', () => {
		const { result } = renderHook(() => useInAppCamera());

		expect(result.current.isActive).toBe(false);
		expect(result.current.loading).toBe(false);
		expect(result.current.error).toBeNull();
		expect(result.current.videoRef.current).toBeNull();
		expect(result.current.faceDetected).toBe(false);
		expect(result.current.isFaceCentered).toBe(false);
		expect(result.current.faceMessage).toBe('Ubica tu rostro dentro del óvalo');
		expect(result.current.countdownProgress).toBe(0);
		expect(result.current.isAutoCapturing).toBe(false);
		expect(result.current.detectorReady).toBe(false);
	});

	it('should handle browsers without mediaDevices or getUserMedia support', async () => {
		Object.defineProperty(navigator, 'mediaDevices', {
			value: undefined,
			configurable: true,
			writable: true,
		});

		const { result } = renderHook(() => useInAppCamera());

		let success = true;
		await act(async () => {
			success = await result.current.startCamera();
		});

		expect(success).toBe(false);
		expect(result.current.isActive).toBe(false);
		expect(result.current.error).toBe(
			'Tu dispositivo o navegador no tiene soporte para captura de video en vivo.',
		);
	});

	it('should successfully start camera, bind stream to video element and initialize detector', async () => {
		const mockVideo = createMockVideoElement();
		const { result } = renderHook(() => useInAppCamera());

		Object.defineProperty(result.current.videoRef, 'current', {
			value: mockVideo,
			writable: true,
		});

		let success = false;
		await act(async () => {
			success = await result.current.startCamera();
		});

		expect(success).toBe(true);
		expect(result.current.isActive).toBe(true);
		expect(result.current.loading).toBe(false);
		expect(result.current.error).toBeNull();
		expect(mockVideo.srcObject).toBe(mockStream);
		expect(mockVideo.play).toHaveBeenCalledTimes(1);

		await waitFor(() => {
			expect(result.current.detectorReady).toBe(true);
		});

		expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({
			video: {
				facingMode: 'user',
				width: { ideal: 1280 },
				height: { ideal: 720 },
			},
			audio: false,
		});
	});

	it('should stop camera tracks and reset video srcObject and face states', async () => {
		const mockVideo = createMockVideoElement();
		const { result } = renderHook(() => useInAppCamera());

		Object.defineProperty(result.current.videoRef, 'current', {
			value: mockVideo,
			writable: true,
		});

		await act(async () => {
			await result.current.startCamera();
		});

		act(() => {
			result.current.stopCamera();
		});

		expect(mockTrack.stop).toHaveBeenCalledTimes(1);
		expect(mockVideo.srcObject).toBeNull();
		expect(result.current.isActive).toBe(false);
		expect(result.current.faceDetected).toBe(false);
		expect(result.current.isFaceCentered).toBe(false);
		expect(result.current.countdownProgress).toBe(0);
		expect(result.current.isAutoCapturing).toBe(false);
	});

	describe('camera error handling', () => {
		it('should handle NotAllowedError', async () => {
			const error = new Error('Permission denied');
			error.name = 'NotAllowedError';
			vi.mocked(navigator.mediaDevices.getUserMedia).mockRejectedValueOnce(
				error,
			);

			const { result } = renderHook(() => useInAppCamera());

			let success = true;
			await act(async () => {
				success = await result.current.startCamera();
			});

			expect(success).toBe(false);
			expect(result.current.error).toBe(
				'Permiso de cámara denegado. Permite el acceso a la cámara en la configuración del navegador.',
			);
		});

		it('should handle NotFoundError', async () => {
			const error = new Error('No device');
			error.name = 'NotFoundError';
			vi.mocked(navigator.mediaDevices.getUserMedia).mockRejectedValueOnce(
				error,
			);

			const { result } = renderHook(() => useInAppCamera());

			await act(async () => {
				await result.current.startCamera();
			});

			expect(result.current.error).toBe(
				'No se encontró ninguna cámara disponible en tu dispositivo.',
			);
		});

		it('should handle NotReadableError', async () => {
			const error = new Error('Camera in use');
			error.name = 'NotReadableError';
			vi.mocked(navigator.mediaDevices.getUserMedia).mockRejectedValueOnce(
				error,
			);

			const { result } = renderHook(() => useInAppCamera());

			await act(async () => {
				await result.current.startCamera();
			});

			expect(result.current.error).toBe(
				'La cámara está siendo utilizada por otra aplicación.',
			);
		});

		it('should handle generic errors', async () => {
			const error = new Error('Unknown hardware glitch');
			vi.mocked(navigator.mediaDevices.getUserMedia).mockRejectedValueOnce(
				error,
			);

			const { result } = renderHook(() => useInAppCamera());

			await act(async () => {
				await result.current.startCamera();
			});

			expect(result.current.error).toBe('No se pudo acceder a la cámara.');
		});
	});

	describe('capturePhoto', () => {
		it('should return null and set error if video is not ready or dimensions are 0', async () => {
			const { result } = renderHook(() => useInAppCamera());

			let photo: CapturedPhoto | null = null;
			await act(async () => {
				photo = await result.current.capturePhoto();
			});

			expect(photo).toBeNull();
			expect(result.current.error).toBe(
				'La cámara no está lista para capturar la imagen.',
			);
		});

		it('should capture photo with cover crop calculation when video is ready', async () => {
			const mockVideo = createMockVideoElement();

			const { result } = renderHook(() =>
				useInAppCamera({ targetWidth: 720, targetHeight: 900, quality: 0.85 }),
			);

			Object.defineProperty(result.current.videoRef, 'current', {
				value: mockVideo,
				writable: true,
			});

			await act(async () => {
				await result.current.startCamera();
			});

			const photoRef = { current: null as CapturedPhoto | null };
			await act(async () => {
				photoRef.current = await result.current.capturePhoto();
			});

			expect(photoRef.current).not.toBeNull();
			expect(photoRef.current?.dataUrl).toBe('data:image/jpeg;base64,fake');
			expect(photoRef.current?.blob).toBeInstanceOf(Blob);
		});

		it('should return null and set error if photo fails content validation', async () => {
			const mockVideo = createMockVideoElement();

			vi.mocked(faceDetectorUtils.validateCapturedImage).mockReturnValueOnce({
				isValid: false,
				error:
					'No se detectó un rostro en la fotografía. Debes encuadrar tu rostro.',
			});

			const { result } = renderHook(() => useInAppCamera());

			Object.defineProperty(result.current.videoRef, 'current', {
				value: mockVideo,
				writable: true,
			});

			await act(async () => {
				await result.current.startCamera();
			});

			const photoRef = { current: null as CapturedPhoto | null };
			await act(async () => {
				photoRef.current = await result.current.capturePhoto();
			});

			expect(photoRef.current).toBeNull();
			expect(result.current.error).toBe(
				'No se detectó un rostro en la fotografía. Debes encuadrar tu rostro.',
			);
		});

		it('should trigger navigator.vibrate when photo is successfully captured', async () => {
			const mockVideo = createMockVideoElement();
			const mockVibrate = vi.fn();
			Object.defineProperty(navigator, 'vibrate', {
				value: mockVibrate,
				configurable: true,
				writable: true,
			});

			const { result } = renderHook(() => useInAppCamera());

			Object.defineProperty(result.current.videoRef, 'current', {
				value: mockVideo,
				writable: true,
			});

			await act(async () => {
				await result.current.startCamera();
			});

			await act(async () => {
				await result.current.capturePhoto();
			});

			expect(mockVibrate).toHaveBeenCalledWith([40]);
		});
	});

	describe('auto face detection and auto capture loop', () => {
		beforeEach(() => {
			vi.useFakeTimers();
		});

		afterEach(() => {
			vi.useRealTimers();
		});

		it('should update face status in detection loop when face is centered', async () => {
			const mockVideo = createMockVideoElement();
			const { result } = renderHook(() =>
				useInAppCamera({
					enableAutoCapture: true,
					detectionIntervalMs: 100,
					holdDurationMs: 500,
				}),
			);

			Object.defineProperty(result.current.videoRef, 'current', {
				value: mockVideo,
				writable: true,
			});

			await act(async () => {
				await result.current.startCamera();
			});

			await act(async () => {
				await vi.advanceTimersByTimeAsync(100);
			});

			expect(result.current.faceDetected).toBe(true);
			expect(result.current.isFaceCentered).toBe(true);
			expect(result.current.faceMessage).toBe('¡Perfecto! No te muevas...');
			expect(result.current.countdownProgress).toBeCloseTo(0.2);
		});

		it('should trigger onAutoCaptured and set progress to 1 when held for holdDurationMs', async () => {
			const mockVideo = createMockVideoElement();
			const onAutoCaptured = vi.fn();

			const { result } = renderHook(() =>
				useInAppCamera({
					enableAutoCapture: true,
					detectionIntervalMs: 100,
					holdDurationMs: 200,
					onAutoCaptured,
				}),
			);

			Object.defineProperty(result.current.videoRef, 'current', {
				value: mockVideo,
				writable: true,
			});

			await act(async () => {
				await result.current.startCamera();
			});

			// Interval 1: held 100ms
			await act(async () => {
				await vi.advanceTimersByTimeAsync(100);
			});

			expect(onAutoCaptured).not.toHaveBeenCalled();

			// Interval 2: held 200ms -> triggers capturePhoto and onAutoCaptured
			await act(async () => {
				await vi.advanceTimersByTimeAsync(100);
			});

			expect(result.current.countdownProgress).toBe(1);
			expect(onAutoCaptured).toHaveBeenCalledTimes(1);
			expect(onAutoCaptured).toHaveBeenCalledWith({
				blob: expect.any(Blob),
				dataUrl: 'data:image/jpeg;base64,fake',
			});
		});

		it('should reset countdown progress when face is not centered', async () => {
			const mockVideo = createMockVideoElement();
			const { result } = renderHook(() =>
				useInAppCamera({
					enableAutoCapture: true,
					detectionIntervalMs: 100,
					holdDurationMs: 500,
				}),
			);

			Object.defineProperty(result.current.videoRef, 'current', {
				value: mockVideo,
				writable: true,
			});

			await act(async () => {
				await result.current.startCamera();
			});

			await act(async () => {
				await vi.advanceTimersByTimeAsync(100);
			});
			expect(result.current.countdownProgress).toBeCloseTo(0.2);

			// Now face goes off-center
			vi.mocked(faceDetectorUtils.checkFaceFraming).mockReturnValueOnce({
				isCentered: false,
				message: 'Centra tu rostro en el óvalo',
			});

			await act(async () => {
				await vi.advanceTimersByTimeAsync(100);
			});

			expect(result.current.isFaceCentered).toBe(false);
			expect(result.current.faceMessage).toBe('Centra tu rostro en el óvalo');
			expect(result.current.countdownProgress).toBe(0);
		});

		it('should not run auto face detection when enableAutoCapture is false', async () => {
			const mockVideo = createMockVideoElement();
			const { result } = renderHook(() =>
				useInAppCamera({
					enableAutoCapture: false,
					detectionIntervalMs: 100,
				}),
			);

			Object.defineProperty(result.current.videoRef, 'current', {
				value: mockVideo,
				writable: true,
			});

			await act(async () => {
				await result.current.startCamera();
			});

			await act(async () => {
				await vi.advanceTimersByTimeAsync(200);
			});

			expect(mockDetectorInstance.detect).not.toHaveBeenCalled();
			expect(result.current.faceDetected).toBe(false);
			expect(result.current.countdownProgress).toBe(0);
		});
	});

	it('should clean up stream tracks on unmount', async () => {
		const mockVideo = createMockVideoElement();
		const { result, unmount } = renderHook(() => useInAppCamera());

		Object.defineProperty(result.current.videoRef, 'current', {
			value: mockVideo,
			writable: true,
		});

		await act(async () => {
			await result.current.startCamera();
		});

		unmount();

		expect(mockTrack.stop).toHaveBeenCalledTimes(1);
	});
});
