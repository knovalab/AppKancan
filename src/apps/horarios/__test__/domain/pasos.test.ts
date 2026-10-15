import { describe, expect, it } from 'vitest';
import { LOG_TYPE, pasosPrevios } from '@/apps/horarios/domain/registro';

describe('pasosPrevios (R9)', () => {
	const real = { esDemo: false, hayNormas: true };

	it('Comenzar Jornada: normas y después foto + GPS', () => {
		expect(pasosPrevios(LOG_TYPE.inicioJornada, real)).toEqual([
			'normas',
			'verificacion',
		]);
	});

	it('sin normas vigentes solo pide foto + GPS', () => {
		expect(
			pasosPrevios(LOG_TYPE.inicioJornada, { ...real, hayNormas: false }),
		).toEqual(['verificacion']);
	});

	it('Terminar Jornada: solo foto + GPS', () => {
		expect(pasosPrevios(LOG_TYPE.finJornada, real)).toEqual(['verificacion']);
	});

	it('almuerzos: sin pasos previos', () => {
		expect(pasosPrevios(LOG_TYPE.inicioAlmuerzo, real)).toEqual([]);
		expect(pasosPrevios(LOG_TYPE.finAlmuerzo, real)).toEqual([]);
	});

	it('demo: nunca pide normas ni cámara', () => {
		expect(
			pasosPrevios(LOG_TYPE.inicioJornada, { ...real, esDemo: true }),
		).toEqual([]);
	});
});
