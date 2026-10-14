import { vi } from 'vitest';

export interface MockGeolocation {
	getCurrentPosition: ReturnType<typeof vi.fn>;
	watchPosition: ReturnType<typeof vi.fn>;
	clearWatch: ReturnType<typeof vi.fn>;
}

export function createGeolocationPosition(
	coords: Partial<GeolocationCoordinates> = {},
	timestamp: number = Date.now(),
): GeolocationPosition {
	return {
		coords: {
			latitude: coords.latitude ?? 4.6097,
			longitude: coords.longitude ?? -74.0817,
			accuracy: coords.accuracy ?? 5,
			altitude: coords.altitude ?? null,
			altitudeAccuracy: coords.altitudeAccuracy ?? null,
			heading: coords.heading ?? null,
			speed: coords.speed ?? null,
			toJSON: () => ({}),
		},
		timestamp,
		toJSON: () => ({}),
	};
}

export function createGeolocationError(
	code: number,
	message = '',
): GeolocationPositionError {
	return {
		code,
		message,
		PERMISSION_DENIED: 1,
		POSITION_UNAVAILABLE: 2,
		TIMEOUT: 3,
	};
}

export function setupMockGeolocation(): MockGeolocation {
	const mock: MockGeolocation = {
		getCurrentPosition: vi.fn(),
		watchPosition: vi.fn(),
		clearWatch: vi.fn(),
	};

	Object.defineProperty(navigator, 'geolocation', {
		value: mock,
		configurable: true,
		writable: true,
	});

	return mock;
}
