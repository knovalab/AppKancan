import { fireEvent, render, screen } from '@testing-library/react';
import type React from 'react';
import { createRef } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { VerificationViewfinder } from '@/apps/horarios/components/verification/VerificationViewfinder';
import type { CapturedPhoto } from '@/apps/horarios/hooks/useInAppCamera';

describe('VerificationViewfinder', () => {
	const mockOnRetryCamera = vi.fn();
	let videoRef: React.RefObject<HTMLVideoElement>;

	beforeEach(() => {
		vi.clearAllMocks();
		videoRef = createRef<HTMLVideoElement>();
	});

	it('should render captured photo image when capturedPhoto is provided', () => {
		const mockPhoto: CapturedPhoto = {
			blob: new Blob(['fake']),
			dataUrl: 'data:image/jpeg;base64,captured-selfie',
		};

		render(
			<VerificationViewfinder
				videoRef={videoRef}
				isCameraActive={false}
				isCameraLoading={false}
				cameraError={null}
				onRetryCamera={mockOnRetryCamera}
				capturedPhoto={mockPhoto}
				faceDetected={false}
				isFaceCentered={false}
				faceMessage="Ubica tu rostro"
				countdownProgress={0}
				isAutoCapturing={false}
			/>,
		);

		const img = screen.getByRole('img', { name: /Foto capturada/i });
		expect(img).toBeInTheDocument();
		expect(img).toHaveAttribute(
			'src',
			'data:image/jpeg;base64,captured-selfie',
		);
	});

	it('should render loading indicator when isCameraLoading is true', () => {
		render(
			<VerificationViewfinder
				videoRef={videoRef}
				isCameraActive={false}
				isCameraLoading={true}
				cameraError={null}
				onRetryCamera={mockOnRetryCamera}
				capturedPhoto={null}
				faceDetected={false}
				isFaceCentered={false}
				faceMessage="Ubica tu rostro"
				countdownProgress={0}
				isAutoCapturing={false}
			/>,
		);

		expect(screen.getByText('Iniciando cámara frontal...')).toBeInTheDocument();
		expect(screen.getByRole('progressbar')).toBeInTheDocument();
	});

	it('should render camera error and retry button', () => {
		render(
			<VerificationViewfinder
				videoRef={videoRef}
				isCameraActive={false}
				isCameraLoading={false}
				cameraError="Permiso de cámara denegado."
				onRetryCamera={mockOnRetryCamera}
				capturedPhoto={null}
				faceDetected={false}
				isFaceCentered={false}
				faceMessage="Ubica tu rostro"
				countdownProgress={0}
				isAutoCapturing={false}
			/>,
		);

		expect(screen.getByText('Permiso de cámara denegado.')).toBeInTheDocument();

		const retryBtn = screen.getByRole('button', {
			name: /Reintentar cámara/i,
		});
		fireEvent.click(retryBtn);

		expect(mockOnRetryCamera).toHaveBeenCalledTimes(1);
	});

	it('should render face guiding message and badges when camera is active', () => {
		render(
			<VerificationViewfinder
				videoRef={videoRef}
				isCameraActive={true}
				isCameraLoading={false}
				cameraError={null}
				onRetryCamera={mockOnRetryCamera}
				capturedPhoto={null}
				faceDetected={false}
				isFaceCentered={false}
				faceMessage="Centra tu rostro en el óvalo"
				countdownProgress={0}
				isAutoCapturing={false}
			/>,
		);

		expect(screen.getByText('En vivo')).toBeInTheDocument();
		expect(screen.getByText('Buscando rostro...')).toBeInTheDocument();
		expect(
			screen.getByText('Centra tu rostro en el óvalo'),
		).toBeInTheDocument();
	});

	it('should render countdown progress percentage when face is centered', () => {
		render(
			<VerificationViewfinder
				videoRef={videoRef}
				isCameraActive={true}
				isCameraLoading={false}
				cameraError={null}
				onRetryCamera={mockOnRetryCamera}
				capturedPhoto={null}
				faceDetected={true}
				isFaceCentered={true}
				faceMessage="¡Perfecto! No te muevas..."
				countdownProgress={0.75}
				isAutoCapturing={false}
			/>,
		);

		expect(screen.getByText('Rostro alineado')).toBeInTheDocument();
		expect(screen.getByText('¡No te muevas! (75%)')).toBeInTheDocument();
	});

	it('should display "¡Capturando fotografía!" when isAutoCapturing is true', () => {
		render(
			<VerificationViewfinder
				videoRef={videoRef}
				isCameraActive={true}
				isCameraLoading={false}
				cameraError={null}
				onRetryCamera={mockOnRetryCamera}
				capturedPhoto={null}
				faceDetected={true}
				isFaceCentered={true}
				faceMessage="¡Perfecto!"
				countdownProgress={1}
				isAutoCapturing={true}
			/>,
		);

		expect(screen.getByText('¡Capturando fotografía!')).toBeInTheDocument();
	});
});
