import type { Tienda } from '@/apps/horarios/interfaces/horarios.interface';

export function createMockTienda(overrides: Partial<Tienda> = {}): Tienda {
	return {
		id: 1,
		name: 'Tienda 1',
		company: 'Kancan',
		...overrides,
	};
}

export function createMockTiendas(): Tienda[] {
	return [
		createMockTienda({ id: 1, name: 'Tienda Norte' }),
		createMockTienda({ id: 2, name: 'Tienda Sur' }),
		createMockTienda({ id: 3, name: 'Tienda Oriente' }),
		createMockTienda({ id: 5, name: 'Tienda Online' }), // Excluded for Area Manager
	];
}
