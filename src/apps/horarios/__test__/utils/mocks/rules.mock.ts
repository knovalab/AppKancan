import type { Normas } from '@/apps/horarios/api/directus/rules';

export function createMockNormas(overrides: Partial<Normas> = {}): Normas {
	return {
		id: 1,
		version: 2,
		title: 'Normas de Convivencia y Seguridad',
		content: 'Contenido detallado de las normas laborales...',
		...overrides,
	};
}

