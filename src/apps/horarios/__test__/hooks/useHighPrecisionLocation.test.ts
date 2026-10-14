import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import {
	type LocationCoordinates,
	useHighPrecisionLocation,
} from '../../hooks/useHighPrecisionLocation';
import {
	createGeolocationError,
	createGeolocationPosition,
	type MockGeolocation,
	setupMockGeolocation,
} from '../utils/mocks/geolocation.mock';

describe('useHighPrecisionLocation', () => {
	let mockGeo: MockGeolocation;

	beforeEach(() => {
		mockGeo = setupMockGeolocation();
	});

	it('should return initial idle state when autoAcquire is false', () => {
		const { result } = renderHook(() => useHighPrecisionLocation(false));

		expect(result.current.coords).toBeNull();
		expect(result.current.loading).toBe(false);
		expect(result.current.error).toBeNull();
		expect(mockGeo.getCurrentPosition).not.toHaveBeenCalled();
	});

	it('should acquire location successfully and update coords state', async () => {
		const fakePosition = createGeolocationPosition({
			latitude: 6.2442,
			longitude: -75.5812,
			accuracy: 8.5,
		});

		mockGeo.getCurrentPosition.mockImplementation((success) => {
			success(fakePosition);
		});

		const { result } = renderHook(() => useHighPrecisionLocation(false));

		let acquired: LocationCoordinates | null = null;
		await act(async () => {
			acquired = await result.current.acquireLocation();
		});

		expect(acquired).toEqual({
			latitude: 6.2442,
			longitude: -75.5812,
			accuracy: 8.5,
			timestamp: fakePosition.timestamp,
		});
		expect(result.current.coords).toEqual(acquired);
		expect(result.current.loading).toBe(false);
		expect(result.current.error).toBeNull();

		// Verify GPS accuracy options
		expect(mockGeo.getCurrentPosition).toHaveBeenCalledWith(
			expect.any(Function),
			expect.any(Function),
			{
				enableHighAccuracy: true,
				timeout: 12000,
				maximumAge: 0,
			},
		);
	});

	it('should automatically acquire location when autoAcquire is true', async () => {
		const fakePosition = createGeolocationPosition();
		mockGeo.getCurrentPosition.mockImplementation((success) => {
			success(fakePosition);
		});

		const { result } = renderHook(() => useHighPrecisionLocation(true));

		expect(mockGeo.getCurrentPosition).toHaveBeenCalledTimes(1);
		expect(result.current.coords).toEqual({
			latitude: fakePosition.coords.latitude,
			longitude: fakePosition.coords.longitude,
			accuracy: fakePosition.coords.accuracy,
			timestamp: fakePosition.timestamp,
		});
	});

	it('should handle PERMISSION_DENIED error correctly', async () => {
		mockGeo.getCurrentPosition.mockImplementation((_, error) => {
			error(createGeolocationError(1, 'User denied Geolocation'));
		});

		const { result } = renderHook(() => useHighPrecisionLocation(false));

		let acquired: LocationCoordinates | null = null;
		await act(async () => {
			acquired = await result.current.acquireLocation();
		});

		expect(acquired).toBeNull();
		expect(result.current.coords).toBeNull();
		expect(result.current.loading).toBe(false);
		expect(result.current.error).toBe(
			'Permiso de ubicación denegado. Habilita los permisos de GPS en tu navegador.',
		);
	});

	it('should handle POSITION_UNAVAILABLE error correctly', async () => {
		mockGeo.getCurrentPosition.mockImplementation((_, error) => {
			error(createGeolocationError(2, 'Position unavailable'));
		});

		const { result } = renderHook(() => useHighPrecisionLocation(false));

		await act(async () => {
			await result.current.acquireLocation();
		});

		expect(result.current.coords).toBeNull();
		expect(result.current.error).toBe(
			'Señal GPS no disponible. Verifica que tu dispositivo tenga activada la ubicación.',
		);
	});

	it('should handle TIMEOUT error correctly', async () => {
		mockGeo.getCurrentPosition.mockImplementation((_, error) => {
			error(createGeolocationError(3, 'Timeout'));
		});

		const { result } = renderHook(() => useHighPrecisionLocation(false));

		await act(async () => {
			await result.current.acquireLocation();
		});

		expect(result.current.coords).toBeNull();
		expect(result.current.error).toBe(
			'Tiempo de espera agotado buscando GPS con alta precisión. Intenta nuevamente.',
		);
	});

	it('should handle unknown geolocation errors with fallback message', async () => {
		mockGeo.getCurrentPosition.mockImplementation((_, error) => {
			error(createGeolocationError(99, 'Custom unknown error'));
		});

		const { result } = renderHook(() => useHighPrecisionLocation(false));

		await act(async () => {
			await result.current.acquireLocation();
		});

		expect(result.current.error).toBe('Error al obtener la ubicación GPS.');
	});

	it('should handle unsupported navigator.geolocation gracefully', async () => {
		// Simulate environment without geolocation support
		Object.defineProperty(navigator, 'geolocation', {
			value: undefined,
			configurable: true,
			writable: true,
		});

		const { result } = renderHook(() => useHighPrecisionLocation(false));

		let acquired: LocationCoordinates | null = null;
		await act(async () => {
			acquired = await result.current.acquireLocation();
		});

		expect(acquired).toBeNull();
		expect(result.current.coords).toBeNull();
		expect(result.current.loading).toBe(false);
		expect(result.current.error).toBe(
			'Tu navegador no soporta geolocalización.',
		);
	});

	it('should clear previous error when subsequent acquisition succeeds', async () => {
		// First attempt fails
		mockGeo.getCurrentPosition.mockImplementationOnce((_, error) => {
			error(createGeolocationError(1));
		});

		const { result } = renderHook(() => useHighPrecisionLocation(false));

		await act(async () => {
			await result.current.acquireLocation();
		});
		expect(result.current.error).toBeTruthy();

		// Second attempt succeeds
		const fakePosition = createGeolocationPosition({
			latitude: 10,
			longitude: 20,
		});
		mockGeo.getCurrentPosition.mockImplementationOnce((success) => {
			success(fakePosition);
		});

		await act(async () => {
			await result.current.acquireLocation();
		});

		expect(result.current.error).toBeNull();
		expect(result.current.coords?.latitude).toBe(10);
	});
});
