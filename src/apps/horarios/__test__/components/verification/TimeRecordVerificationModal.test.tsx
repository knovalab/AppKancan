import { act, fireEvent, render, screen } from '@testing-library/react';
import { createRef } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as directusUpload from '@/apps/horarios/api/directus/upload';
import { TimeRecordVerificationModal } from '@/apps/horarios/components/verification/TimeRecordVerificationModal';
import * as locationHook from '@/apps/horarios/hooks/useHighPrecisionLocation';
import * as cameraHook from '@/apps/horarios/hooks/useInAppCamera';

vi.mock('@/apps/horarios/api/directus/upload', () => ({
	uploadAttendancePhoto: vi.fn(),
}));

vi.mock('@/apps/horarios/hooks/useInAppCamera', () => ({
	useInAppCamera: vi.fn(),
}));

vi.mock('@/apps/horarios/hooks/useHighPrecisionLocation', () => ({
	useHighPrecisionLocation: vi.fn(),
}));

describe('TimeRecordVerificationModal', () => {
	const mockedUploadAttendancePhoto = vi.mocked(
		directusUpload.uploadAttendancePhoto,
	);
	const mockedUseInAppCamera = vi.mocked(cameraHook.useInAppCamera);
	const mockedUseHighPrecisionLocation = vi.mocked(
		locationHook.useHighPrecisionLocation,
	);

	const mockOnClose = vi.fn();
	const mockOnConfirm = vi.fn();

	const mockStartCamera = vi.fn();
	const mockStopCamera = vi.fn();
	const mockCapturePhoto = vi.fn();
	const mockAcquireLocation = vi.fn();

	const defaultCameraReturn: cameraHook.UseInAppCameraReturn = {
		videoRef: createRef<HTMLVideoElement>(),
		isActive: true,
		loading: false,
		error: null,
		startCamera: mockStartCamera,
		stopCamera: mockStopCamera,
		capturePhoto: mockCapturePhoto,
		faceDetected: true,
		isFaceCentered: true,
		faceMessage: '¡Perfecto! No te muevas...',
		countdownProgress: 0,
		isAutoCapturing: false,
		detectorReady: true,
	};

	const defaultGpsCoords: locationHook.LocationCoordinates = {
		latitude: 4.6097,
		longitude: -74.0817,
		accuracy: 10,
		timestamp: Date.now(),
	};

	const defaultLocationReturn: locationHook.UseHighPrecisionLocationReturn = {
		coords: defaultGpsCoords,
		loading: false,
		error: null,
		acquireLocation: mockAcquireLocation,
	};

	beforeEach(() => {
		vi.clearAllMocks();

		mockedUseInAppCamera.mockReturnValue({ ...defaultCameraReturn });
		mockedUseHighPrecisionLocation.mockReturnValue({
			...defaultLocationReturn,
		});
		mockedUploadAttendancePhoto.mockResolvedValue('file-upload-uuid-123');
		mockOnConfirm.mockResolvedValue(undefined);
	});

	it('should render modal header with event and employee name and start camera/GPS on open', () => {
		render(
			<TimeRecordVerificationModal
				open={true}
				onClose={mockOnClose}
				employeeName="Laura Martínez"
				eventName="Comenzar Jornada"
				onConfirm={mockOnConfirm}
			/>,
		);

		expect(screen.getByText('Verificación de Asistencia')).toBeInTheDocument();
		expect(screen.getByText('Comenzar Jornada')).toBeInTheDocument();
		expect(screen.getByText('Laura Martínez')).toBeInTheDocument();

		expect(mockStartCamera).toHaveBeenCalledTimes(1);
		expect(mockAcquireLocation).toHaveBeenCalledTimes(1);
	});

	it('should call onClose when close button is clicked', () => {
		render(
			<TimeRecordVerificationModal
				open={true}
				onClose={mockOnClose}
				employeeName="Laura Martínez"
				eventName="Comenzar Jornada"
				onConfirm={mockOnConfirm}
			/>,
		);

		const closeButton = screen.getByRole('button', { name: '' });
		fireEvent.click(closeButton);

		expect(mockOnClose).toHaveBeenCalledTimes(1);
	});

	it('should call stopCamera when modal is closed', () => {
		const { rerender } = render(
			<TimeRecordVerificationModal
				open={true}
				onClose={mockOnClose}
				employeeName="Laura Martínez"
				eventName="Comenzar Jornada"
				onConfirm={mockOnConfirm}
			/>,
		);

		rerender(
			<TimeRecordVerificationModal
				open={false}
				onClose={mockOnClose}
				employeeName="Laura Martínez"
				eventName="Comenzar Jornada"
				onConfirm={mockOnConfirm}
			/>,
		);

		expect(mockStopCamera).toHaveBeenCalled();
	});

	it('should handle manual photo capture success and transition to confirm/retake state', async () => {
		const mockCapturedPhoto: cameraHook.CapturedPhoto = {
			blob: new Blob(['fake-img'], { type: 'image/jpeg' }),
			dataUrl: 'data:image/jpeg;base64,captured-selfie',
		};
		mockCapturePhoto.mockResolvedValueOnce(mockCapturedPhoto);

		render(
			<TimeRecordVerificationModal
				open={true}
				onClose={mockOnClose}
				employeeName="Laura Martínez"
				eventName="Comenzar Jornada"
				onConfirm={mockOnConfirm}
			/>,
		);

		const captureBtn = screen.getByRole('button', {
			name: /Tomar Fotografía/i,
		});

		await act(async () => {
			fireEvent.click(captureBtn);
		});

		expect(mockCapturePhoto).toHaveBeenCalledTimes(1);
		expect(mockStopCamera).toHaveBeenCalled();

		expect(
			screen.getByRole('button', { name: /Tomar otra/i }),
		).toBeInTheDocument();
		expect(
			screen.getByRole('button', { name: /Confirmar/i }),
		).toBeInTheDocument();
	});

	it('should display error message if manual capture fails or detects no face', async () => {
		mockCapturePhoto.mockResolvedValueOnce(null);

		render(
			<TimeRecordVerificationModal
				open={true}
				onClose={mockOnClose}
				employeeName="Laura Martínez"
				eventName="Comenzar Jornada"
				onConfirm={mockOnConfirm}
			/>,
		);

		const captureBtn = screen.getByRole('button', {
			name: /Tomar Fotografía/i,
		});

		await act(async () => {
			fireEvent.click(captureBtn);
		});

		expect(
			screen.getByText(
				'No se detectó un rostro en la fotografía. Debes encuadrar tu rostro dentro del óvalo para continuar.',
			),
		).toBeInTheDocument();
	});

	it('should restart camera when retake button is clicked', async () => {
		const mockCapturedPhoto: cameraHook.CapturedPhoto = {
			blob: new Blob(['fake-img']),
			dataUrl: 'data:image/jpeg;base64,captured',
		};
		mockCapturePhoto.mockResolvedValueOnce(mockCapturedPhoto);

		render(
			<TimeRecordVerificationModal
				open={true}
				onClose={mockOnClose}
				employeeName="Laura Martínez"
				eventName="Comenzar Jornada"
				onConfirm={mockOnConfirm}
			/>,
		);

		await act(async () => {
			fireEvent.click(
				screen.getByRole('button', { name: /Tomar Fotografía/i }),
			);
		});

		const retakeBtn = screen.getByRole('button', { name: /Tomar otra/i });
		fireEvent.click(retakeBtn);

		expect(mockStartCamera).toHaveBeenCalledTimes(2);
		expect(
			screen.getByRole('button', { name: /Tomar Fotografía/i }),
		).toBeInTheDocument();
	});

	it('should prevent confirmation when GPS coordinates are unavailable', async () => {
		mockedUseHighPrecisionLocation.mockReturnValue({
			...defaultLocationReturn,
			coords: null,
		});

		const mockCapturedPhoto: cameraHook.CapturedPhoto = {
			blob: new Blob(['fake-img']),
			dataUrl: 'data:image/jpeg;base64,captured',
		};
		mockCapturePhoto.mockResolvedValueOnce(mockCapturedPhoto);

		render(
			<TimeRecordVerificationModal
				open={true}
				onClose={mockOnClose}
				employeeName="Laura Martínez"
				eventName="Comenzar Jornada"
				onConfirm={mockOnConfirm}
			/>,
		);

		await act(async () => {
			fireEvent.click(
				screen.getByRole('button', { name: /Ubicación GPS requerida/i }),
			);
		});

		// Confirm button should be disabled when coords is null
		expect(mockOnConfirm).not.toHaveBeenCalled();
		expect(mockedUploadAttendancePhoto).not.toHaveBeenCalled();
	});

	it('should upload photo, call onConfirm with verification data and close modal on successful confirmation', async () => {
		const mockCapturedPhoto: cameraHook.CapturedPhoto = {
			blob: new Blob(['fake-img'], { type: 'image/jpeg' }),
			dataUrl: 'data:image/jpeg;base64,captured-selfie',
		};
		mockCapturePhoto.mockResolvedValueOnce(mockCapturedPhoto);

		render(
			<TimeRecordVerificationModal
				open={true}
				onClose={mockOnClose}
				employeeName="Laura Martínez"
				eventName="Comenzar Jornada"
				onConfirm={mockOnConfirm}
			/>,
		);

		await act(async () => {
			fireEvent.click(
				screen.getByRole('button', { name: /Tomar Fotografía/i }),
			);
		});

		const confirmBtn = screen.getByRole('button', { name: /Confirmar/i });

		await act(async () => {
			fireEvent.click(confirmBtn);
		});

		expect(mockedUploadAttendancePhoto).toHaveBeenCalledWith(
			mockCapturedPhoto.blob,
			expect.stringMatching(/^marcacion_Comenzar_Jornada_\d+\.jpg$/),
		);

		expect(mockOnConfirm).toHaveBeenCalledWith({
			latitude: 4.6097,
			longitude: -74.0817,
			accuracy: 10,
			photo: 'file-upload-uuid-123',
		});

		expect(mockOnClose).toHaveBeenCalledTimes(1);
	});

	it('should handle photo upload failure gracefully and display error alert', async () => {
		const mockCapturedPhoto: cameraHook.CapturedPhoto = {
			blob: new Blob(['fake-img']),
			dataUrl: 'data:image/jpeg;base64,captured',
		};
		mockCapturePhoto.mockResolvedValueOnce(mockCapturedPhoto);
		mockedUploadAttendancePhoto.mockRejectedValueOnce(
			new Error('Fallo de red al subir foto'),
		);

		render(
			<TimeRecordVerificationModal
				open={true}
				onClose={mockOnClose}
				employeeName="Laura Martínez"
				eventName="Comenzar Jornada"
				onConfirm={mockOnConfirm}
			/>,
		);

		await act(async () => {
			fireEvent.click(
				screen.getByRole('button', { name: /Tomar Fotografía/i }),
			);
		});

		const confirmBtn = screen.getByRole('button', { name: /Confirmar/i });

		await act(async () => {
			fireEvent.click(confirmBtn);
		});

		expect(screen.getByText('Fallo de red al subir foto')).toBeInTheDocument();
		expect(mockOnConfirm).not.toHaveBeenCalled();
		expect(mockOnClose).not.toHaveBeenCalled();
	});
});
