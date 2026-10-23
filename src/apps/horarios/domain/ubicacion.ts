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
