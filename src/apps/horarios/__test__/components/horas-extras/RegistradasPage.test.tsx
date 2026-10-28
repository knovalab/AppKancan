import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createQueryWrapper } from '../../utils/test-utils';

const listarHorasExtras = vi.fn();
vi.mock('@/apps/horarios/api/directus/horasExtras', () => ({
	listarHorasExtras: (f: unknown) => listarHorasExtras(f),
}));
vi.mock(
	'@/apps/horarios/components/horas-extras/RegistrarHoraExtraModal',
	() => ({
		RegistrarHoraExtraModal: () => null,
	}),
);
vi.mock('@/apps/horarios/api/directus/read', () => ({
	getStores: async () => [],
}));
vi.mock('@/apps/horarios/api/directus/readBulk', () => ({
	getEmpleadosBulk: async () => [],
}));
vi.mock('@/apps/horarios/hooks/useHorariosLayout', () => ({
	useHorariosLayout: () => ({
		irA: vi.fn(),
		acceso: {
			roles: new Set(['areaManager']),
			tiendasPermitidas: [
				{ id: 30, name: 'Pasto' },
				{ id: 26, name: 'Ipiales' },
			],
		},
	}),
}));

import RegistradasPage from '@/apps/horarios/pages/horas-extras/RegistradasPage';

beforeEach(() => {
	vi.clearAllMocks();
	listarHorasExtras.mockResolvedValue([]);
});

describe('RegistradasPage', () => {
	it('arranca con todas las tiendas del jefe y filtra por una', async () => {
		render(<RegistradasPage />, { wrapper: createQueryWrapper() });
		await waitFor(() =>
			expect(listarHorasExtras).toHaveBeenCalledWith(
				expect.objectContaining({ tiendas: [30, 26] }),
			),
		);
		fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Tienda' }));
		fireEvent.click(await screen.findByRole('option', { name: 'Ipiales' }));
		await waitFor(() =>
			expect(listarHorasExtras).toHaveBeenLastCalledWith(
				expect.objectContaining({ tiendas: [26] }),
			),
		);
	});
});
