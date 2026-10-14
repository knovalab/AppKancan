import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { type CapturedPhoto, useInAppCamera } from '../../hooks/useInAppCamera';

describe('useInAppCamera', () => {
	let mockStream: MediaStream;
	let mockTrack: MediaStreamTrack;

	beforeEach(() => {
		vi.resetAllMocks();

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

	it('should return initial idle state', () => {
		const { result } = renderHook(() => useInAppCamera());

		expect(result.current.isActive).toBe(false);
		expect(result.current.loading).toBe(false);
		expect(result.current.error).toBeNull();
		expect(result.current.videoRef.current).toBeNull();
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

	it('should successfully start camera and bind stream to video element', async () => {
		const mockPlay = vi.fn().mockResolvedValue(undefined);
		const mockVideo = document.createElement('video');
		mockVideo.play = mockPlay;

		const { result } = renderHook(() => useInAppCamera());

		// Attach video element to ref
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
		expect(mockPlay).toHaveBeenCalledTimes(1);

		expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({
			video: {
				facingMode: 'user',
				width: { ideal: 1280 },
				height: { ideal: 720 },
			},
			audio: false,
		});
	});

	it('should stop camera tracks and reset video srcObject', async () => {
		const mockVideo = document.createElement('video');
		mockVideo.play = vi.fn().mockResolvedValue(undefined);

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
			const mockVideo = document.createElement('video');
			mockVideo.play = vi.fn().mockResolvedValue(undefined);
			Object.defineProperty(mockVideo, 'videoWidth', { value: 1280 });
			Object.defineProperty(mockVideo, 'videoHeight', { value: 720 });

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
	});

	it('should clean up stream tracks on unmount', async () => {
		const mockVideo = document.createElement('video');
		mockVideo.play = vi.fn().mockResolvedValue(undefined);

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
