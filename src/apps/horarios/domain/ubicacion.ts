/**
 * Ubicación de una marcación. Directus la guarda como GeoJSON (`location`), con
 * el orden [longitud, latitud]; la UI trabaja con latitud/longitud por separado.
 * Este archivo es el ÚNICO sitio que conoce ese orden.
 */

/** Punto GeoJSON tal como lo guarda Directus (`com_time_records.location`). */
export interface PuntoGeo {
	type: 'Point';
	/** [longitud, latitud] — orden GeoJSON. */
	coordinates: [number, number];
}

export interface Coordenadas {
	latitud: number;
	longitud: number;
}

/** Latitud/longitud → GeoJSON. */
export const aPunto = ({ latitud, longitud }: Coordenadas): PuntoGeo => ({
	type: 'Point',
	coordinates: [Number(longitud), Number(latitud)],
});

/**
 * Coordenadas de un registro: primero los campos sueltos `latitude`/`longitude`
 * (registros antiguos o ya mapeados) y, si faltan, el punto GeoJSON `location`.
 * Cada valor se resuelve por separado, igual que hacían las pantallas antes.
 */
export function coordenadasDe(registro: {
	latitude?: number | null;
	longitude?: number | null;
	location?: PuntoGeo | null;
}): { latitud: number | null; longitud: number | null } {
	return {
		latitud: registro.latitude ?? registro.location?.coordinates?.[1] ?? null,
		longitud: registro.longitude ?? registro.location?.coordinates?.[0] ?? null,
	};
}

/** Distancia en metros entre dos coordenadas (Haversine). */
export function distanciaMetros(a: Coordenadas, b: Coordenadas): number {
	const rad = Math.PI / 180;
	const dLat = (b.latitud - a.latitud) * rad;
	const dLon = (b.longitud - a.longitud) * rad;
	const h =
		Math.sin(dLat / 2) ** 2 +
		Math.cos(a.latitud * rad) *
			Math.cos(b.latitud * rad) *
			Math.sin(dLon / 2) ** 2;
	return 2 * 6371000 * Math.asin(Math.sqrt(h));
}

/** "85 m" bajo 1 km, "1.2 km" desde ahí. */
export const formatDistancia = (metros: number): string =>
	metros < 1000
		? `${Math.round(metros)} m`
		: `${(metros / 1000).toFixed(1)} km`;
