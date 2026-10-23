import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { VerificationGpsBanner } from '@/apps/horarios/components/verification/VerificationGpsBanner';
import type { LocationCoordinates } from '@/apps/horarios/hooks/useHighPrecisionLocation';

describe('VerificationGpsBanner', () => {
	const mockOnAcquireLocation = vi.fn();

	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('should render loading state when isGpsLoading is true', () => {
		render(
			<VerificationGpsBanner
				coords={null}
				isGpsLoading={true}
				gpsError={null}
				onAcquireLocation={mockOnAcquireLocation}
			/>,
		);

		expect(
			screen.getByText('Adquiriendo ubicación GPS...'),
		).toBeInTheDocument();
		expect(screen.getByRole('progressbar')).toBeInTheDocument();
		expect(screen.queryByTitle('Reintentar señal GPS')).not.toBeInTheDocument();
	});

	it('should render confirmed GPS state when coordinates are provided', () => {
		const mockCoords: LocationCoordinates = {
			latitude: 4.6097,
			longitude: -74.0817,
			accuracy: 12,
			timestamp: Date.now(),
		};

		render(
			<VerificationGpsBanner
				coords={mockCoords}
				isGpsLoading={false}
				gpsError={null}
				onAcquireLocation={mockOnAcquireLocation}
			/>,
		);

		expect(screen.getByText('Ubicación GPS confirmada')).toBeInTheDocument();
		expect(screen.getByText('Ubicación asegurada')).toBeInTheDocument();
		expect(screen.getByTitle('Reintentar señal GPS')).toBeInTheDocument();
	});

	it('should render required state when no coordinates and not loading', () => {
		render(
			<VerificationGpsBanner
				coords={null}
				isGpsLoading={false}
				gpsError={null}
				onAcquireLocation={mockOnAcquireLocation}
			/>,
		);

		expect(screen.getByText('Ubicación GPS requerida')).toBeInTheDocument();
		expect(screen.queryByText('Ubicación asegurada')).not.toBeInTheDocument();
		expect(screen.getByTitle('Reintentar señal GPS')).toBeInTheDocument();
	});

	it('should render warning alert when gpsError is present', () => {
		render(
			<VerificationGpsBanner
				coords={null}
				isGpsLoading={false}
				gpsError="Permiso de ubicación denegado"
				onAcquireLocation={mockOnAcquireLocation}
			/>,
		);

		expect(
			screen.getByText('Permiso de ubicación denegado'),
		).toBeInTheDocument();
		expect(screen.getByRole('alert')).toBeInTheDocument();
	});

	it('should trigger onAcquireLocation when retry button is clicked', () => {
		render(
			<VerificationGpsBanner
				coords={null}
				isGpsLoading={false}
				gpsError={null}
				onAcquireLocation={mockOnAcquireLocation}
			/>,
		);

		const retryBtn = screen.getByTitle('Reintentar señal GPS');
		fireEvent.click(retryBtn);

		expect(mockOnAcquireLocation).toHaveBeenCalledTimes(1);
	});

	it('should disable retry button when disabled prop is true', () => {
		render(
			<VerificationGpsBanner
				coords={null}
				isGpsLoading={false}
				gpsError={null}
				onAcquireLocation={mockOnAcquireLocation}
				disabled={true}
			/>,
		);

		const retryBtn = screen.getByTitle('Reintentar señal GPS');
		expect(retryBtn).toBeDisabled();
	});
});
