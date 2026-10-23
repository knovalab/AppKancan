import { useCallback, useEffect, useState } from 'react';

export interface LocationCoordinates {
	latitude: number;
	longitude: number;
	accuracy: number;
	timestamp: number;
}

export interface UseHighPrecisionLocationReturn {
	coords: LocationCoordinates | null;
	loading: boolean;
	error: string | null;
	acquireLocation: () => Promise<LocationCoordinates | null>;
}

/**
 * Hook to request hardware GPS with maximum precision.
 * Enforces `enableHighAccuracy: true` and `maximumAge: 0` to reject cached locations.
 */
export function useHighPrecisionLocation(
	autoAcquire = false,
): UseHighPrecisionLocationReturn {
	const [coords, setCoords] = useState<LocationCoordinates | null>(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const acquireLocation = useCallback((): Promise<LocationCoordinates | null> => {
		if (typeof window === 'undefined' || !navigator.geolocation) {
			const msg = 'Tu navegador no soporta geolocalización.';
			setError(msg);
			return Promise.resolve(null);
		}

		setLoading(true);
		setError(null);

		return new Promise((resolve) => {
			navigator.geolocation.getCurrentPosition(
				(position) => {
					const data: LocationCoordinates = {
						latitude: position.coords.latitude,
						longitude: position.coords.longitude,
						accuracy: position.coords.accuracy,
						timestamp: position.timestamp,
					};
					setCoords(data);
					setLoading(false);
					setError(null);
					resolve(data);
				},
				(geoError) => {
					let msg = 'Error al obtener la ubicación GPS.';
					switch (geoError.code) {
						case geoError.PERMISSION_DENIED:
							msg =
								'Permiso de ubicación denegado. Habilita los permisos de GPS en tu navegador.';
							break;
						case geoError.POSITION_UNAVAILABLE:
							msg =
								'Señal GPS no disponible. Verifica que tu dispositivo tenga activada la ubicación.';
							break;
						case geoError.TIMEOUT:
							msg =
								'Tiempo de espera agotado buscando GPS con alta precisión. Intenta nuevamente.';
							break;
					}
					setError(msg);
					setLoading(false);
					resolve(null);
				},
				{
					enableHighAccuracy: true,
					timeout: 12000,
					maximumAge: 0,
				},
			);
		});
	}, []);

	useEffect(() => {
		if (autoAcquire) {
			acquireLocation();
		}
	}, [autoAcquire, acquireLocation]);

	return {
		coords,
		loading,
		error,
		acquireLocation,
	};
}
