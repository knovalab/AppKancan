import { describe, expect, it } from 'vitest';
import { aPunto, coordenadasDe } from '@/apps/horarios/domain/ubicacion';

describe('domain/ubicacion', () => {
	it('aPunto guarda en orden GeoJSON [longitud, latitud]', () => {
		expect(aPunto({ latitud: 4.61, longitud: -74.08 })).toEqual({
			type: 'Point',
			coordinates: [-74.08, 4.61],
		});
	});

	it('coordenadasDe lee el punto GeoJSON en el orden correcto', () => {
		expect(
			coordenadasDe({
				location: { type: 'Point', coordinates: [-74.08, 4.61] },
			}),
		).toEqual({ latitud: 4.61, longitud: -74.08 });
	});

	it('coordenadasDe prioriza los campos sueltos (registros antiguos o ya mapeados)', () => {
		expect(
			coordenadasDe({
				latitude: 1,
				longitude: 2,
				location: { type: 'Point', coordinates: [9, 9] },
			}),
		).toEqual({ latitud: 1, longitud: 2 });
	});

	it('sin datos devuelve null en ambos', () => {
		expect(coordenadasDe({})).toEqual({ latitud: null, longitud: null });
		expect(coordenadasDe({ latitude: null, location: null })).toEqual({
			latitud: null,
			longitud: null,
		});
	});

	it('ida y vuelta conserva las coordenadas', () => {
		const punto = aPunto({ latitud: 6.25, longitud: -75.56 });
		expect(coordenadasDe({ location: punto })).toEqual({
			latitud: 6.25,
			longitud: -75.56,
		});
	});
});
