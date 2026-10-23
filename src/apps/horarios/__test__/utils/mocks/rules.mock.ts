import type { Normas } from '../../../interfaces/normas';

export function createMockNormas(overrides: Partial<Normas> = {}): Normas {
	return {
		id: 1,
		version: 2,
		title: 'Normas de Convivencia y Seguridad',
		content: 'Contenido detallado de las normas laborales...',
		...overrides,
	};
}
