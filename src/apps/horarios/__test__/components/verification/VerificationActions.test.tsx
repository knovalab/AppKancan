import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { VerificationActions } from '@/apps/horarios/components/verification/VerificationActions';
import type { CapturedPhoto } from '@/apps/horarios/hooks/useInAppCamera';

describe('VerificationActions', () => {
	const mockOnRetake = vi.fn();
	const mockOnConfirm = vi.fn();
	const mockOnCapture = vi.fn();

	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe('Pre-capture manual button states', () => {
		it('should show "Iniciando cámara..." and be disabled when camera is loading or inactive', () => {
			render(
				<VerificationActions
					capturedPhoto={null}
					isSubmitting={false}
					canConfirm={false}
					isCameraActive={false}
					isCameraLoading={true}
					hasGps={true}
					isGpsLoading={false}
					faceDetected={false}
					isFaceCentered={false}
					onRetake={mockOnRetake}
					onConfirm={mockOnConfirm}
					onCapture={mockOnCapture}
				/>,
			);

			const btn = screen.getByRole('button', { name: /Iniciando cámara/i });
			expect(btn).toBeDisabled();
		});

		it('should show "Buscando señal GPS..." when camera is active but GPS is acquiring', () => {
			render(
				<VerificationActions
					capturedPhoto={null}
					isSubmitting={false}
					canConfirm={false}
					isCameraActive={true}
					isCameraLoading={false}
					hasGps={false}
					isGpsLoading={true}
					faceDetected={true}
					isFaceCentered={true}
					onRetake={mockOnRetake}
					onConfirm={mockOnConfirm}
					onCapture={mockOnCapture}
				/>,
			);

			const btn = screen.getByRole('button', {
				name: /Buscando señal GPS.../i,
			});
			expect(btn).toBeDisabled();
		});

		it('should show "Ubicación GPS requerida" when GPS is not available and not loading', () => {
			render(
				<VerificationActions
					capturedPhoto={null}
					isSubmitting={false}
					canConfirm={false}
					isCameraActive={true}
					isCameraLoading={false}
					hasGps={false}
					isGpsLoading={false}
					faceDetected={true}
					isFaceCentered={true}
					onRetake={mockOnRetake}
					onConfirm={mockOnConfirm}
					onCapture={mockOnCapture}
				/>,
			);

			const btn = screen.getByRole('button', {
				name: /Ubicación GPS requerida/i,
			});
			expect(btn).toBeDisabled();
		});

		it('should show "Encuadra tu rostro" when camera and GPS are ready but no face is detected', () => {
			render(
				<VerificationActions
					capturedPhoto={null}
					isSubmitting={false}
					canConfirm={false}
					isCameraActive={true}
					isCameraLoading={false}
					hasGps={true}
					isGpsLoading={false}
					faceDetected={false}
					isFaceCentered={false}
					onRetake={mockOnRetake}
					onConfirm={mockOnConfirm}
					onCapture={mockOnCapture}
				/>,
			);

			const btn = screen.getByRole('button', {
				name: /Encuadra tu rostro/i,
			});
			expect(btn).toBeDisabled();
		});

		it('should show "Centra tu rostro en el óvalo" when face is detected but not centered', () => {
			render(
				<VerificationActions
					capturedPhoto={null}
					isSubmitting={false}
					canConfirm={false}
					isCameraActive={true}
					isCameraLoading={false}
					hasGps={true}
					isGpsLoading={false}
					faceDetected={true}
					isFaceCentered={false}
					onRetake={mockOnRetake}
					onConfirm={mockOnConfirm}
					onCapture={mockOnCapture}
				/>,
			);

			const btn = screen.getByRole('button', {
				name: /Centra tu rostro en el óvalo/i,
			});
			expect(btn).toBeDisabled();
		});

		it('should enable button with "Tomar Fotografía" when camera, GPS, and centered face are verified', () => {
			render(
				<VerificationActions
					capturedPhoto={null}
					isSubmitting={false}
					canConfirm={false}
					isCameraActive={true}
					isCameraLoading={false}
					hasGps={true}
					isGpsLoading={false}
					faceDetected={true}
					isFaceCentered={true}
					onRetake={mockOnRetake}
					onConfirm={mockOnConfirm}
					onCapture={mockOnCapture}
				/>,
			);

			const btn = screen.getByRole('button', {
				name: /Tomar Fotografía/i,
			});
			expect(btn).toBeEnabled();

			fireEvent.click(btn);
			expect(mockOnCapture).toHaveBeenCalledTimes(1);
		});
	});

	describe('Post-capture actions', () => {
		const mockPhoto: CapturedPhoto = {
			blob: new Blob(['fake']),
			dataUrl: 'data:image/jpeg;base64,mock',
		};

		it('should render "Tomar otra" and "Confirmar" buttons when photo is captured', () => {
			render(
				<VerificationActions
					capturedPhoto={mockPhoto}
					isSubmitting={false}
					canConfirm={true}
					isCameraActive={false}
					isCameraLoading={false}
					hasGps={true}
					isGpsLoading={false}
					faceDetected={false}
					isFaceCentered={false}
					onRetake={mockOnRetake}
					onConfirm={mockOnConfirm}
					onCapture={mockOnCapture}
				/>,
			);

			const retakeBtn = screen.getByRole('button', { name: /Tomar otra/i });
			const confirmBtn = screen.getByRole('button', { name: /Confirmar/i });

			expect(retakeBtn).toBeEnabled();
			expect(confirmBtn).toBeEnabled();

			fireEvent.click(retakeBtn);
			expect(mockOnRetake).toHaveBeenCalledTimes(1);

			fireEvent.click(confirmBtn);
			expect(mockOnConfirm).toHaveBeenCalledTimes(1);
		});

		it('should disable "Confirmar" button when canConfirm is false', () => {
			render(
				<VerificationActions
					capturedPhoto={mockPhoto}
					isSubmitting={false}
					canConfirm={false}
					isCameraActive={false}
					isCameraLoading={false}
					hasGps={false}
					isGpsLoading={false}
					faceDetected={false}
					isFaceCentered={false}
					onRetake={mockOnRetake}
					onConfirm={mockOnConfirm}
					onCapture={mockOnCapture}
				/>,
			);

			const confirmBtn = screen.getByRole('button', { name: /Confirmar/i });
			expect(confirmBtn).toBeDisabled();
		});

		it('should display "Guardando..." and disable "Tomar otra" when isSubmitting is true', () => {
			render(
				<VerificationActions
					capturedPhoto={mockPhoto}
					isSubmitting={true}
					canConfirm={false}
					isCameraActive={false}
					isCameraLoading={false}
					hasGps={true}
					isGpsLoading={false}
					faceDetected={false}
					isFaceCentered={false}
					onRetake={mockOnRetake}
					onConfirm={mockOnConfirm}
					onCapture={mockOnCapture}
				/>,
			);

			expect(
				screen.getByRole('button', { name: /Guardando.../i }),
			).toBeDisabled();
			expect(
				screen.getByRole('button', { name: /Tomar otra/i }),
			).toBeDisabled();
		});
	});
});
