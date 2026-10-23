import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { useTiendaSeleccionada } from '../../hooks/useTiendaSeleccionada';
import { createMockTiendas } from '../utils/mocks/stores.mock';
import type { HorariosAcceso } from '../../interfaces/acceso';

describe('useTiendaSeleccionada', () => {
	const mockStores = createMockTiendas(); // IDs: 1, 2, 3, 5

	const createWrapper = (initialEntry = '/horarios/registros') => {
		return function RouterWrapper({ children }: { children: ReactNode }) {
			return (
				<MemoryRouter initialEntries={[initialEntry]}>{children}</MemoryRouter>
			);
		};
	};

	const createMockAcceso = (
		overrides: Partial<HorariosAcceso> = {},
	): HorariosAcceso =>
		({
			roles: new Set(['admin']),
			rolPrincipal: 'admin',
			cargando: false,
			puede: () => true,
			inicio: 'registros',
			puedeVerDemo: false,
			tiendaPropia: 1,
			tiendasPermitidas: mockStores,
			...overrides,
		}) as unknown as HorariosAcceso;

	it('should always select { tipo: "propia" } for store employees (tienda) regardless of URL params', () => {
		const accesoTienda = createMockAcceso({
			roles: new Set(['tienda']),
			rolPrincipal: 'tienda',
			tiendaPropia: 2,
			tiendasPermitidas: [],
		});

		// URL attempts to request store 3 or todas
		const wrapper = createWrapper('/horarios/registros?tienda=3');
		const { result } = renderHook(
			() => useTiendaSeleccionada(accesoTienda, 'una', 'Mi Tienda'),
			{ wrapper },
		);

		expect(result.current.seleccion).toEqual({ tipo: 'propia' });
		expect(result.current.storeId).toBe(2);
		expect(result.current.storeIds).toEqual([2]);
		expect(result.current.nombre).toBe('Mi Tienda');
	});

	it('should select requested store from URL when permitted for admin', () => {
		const accesoAdmin = createMockAcceso({
			roles: new Set(['admin']),
			tiendasPermitidas: mockStores,
		});

		const wrapper = createWrapper('/horarios/registros?tienda=2');
		const { result } = renderHook(
			() => useTiendaSeleccionada(accesoAdmin, 'una'),
			{ wrapper },
		);

		expect(result.current.seleccion).toEqual({ tipo: 'una', id: 2 });
		expect(result.current.storeId).toBe(2);
		expect(result.current.storeIds).toEqual([2]);
		expect(result.current.nombre).toBe('Tienda Sur');
	});

	it('should fallback when requested URL store is not permitted', () => {
		const accesoAdmin = createMockAcceso({
			roles: new Set(['admin']),
			tiendaPropia: 1,
			tiendasPermitidas: mockStores, // 1, 2, 3, 5
		});

		// URL requests non-permitted store 999
		const wrapper = createWrapper('/horarios/registros?tienda=999');
		const { result } = renderHook(
			() => useTiendaSeleccionada(accesoAdmin, 'una'),
			{ wrapper },
		);

		// Fallback to own store 1 since it is permitted
		expect(result.current.seleccion).toEqual({ tipo: 'propia' });
		expect(result.current.storeId).toBe(1);
	});

	it('should support selection "todas" when modo is "una-o-todas"', () => {
		const accesoAdmin = createMockAcceso({
			roles: new Set(['admin']),
			tiendasPermitidas: mockStores,
		});

		const wrapper = createWrapper('/horarios/historial?tienda=todas');
		const { result } = renderHook(
			() => useTiendaSeleccionada(accesoAdmin, 'una-o-todas'),
			{ wrapper },
		);

		expect(result.current.seleccion).toEqual({ tipo: 'todas' });
		expect(result.current.storeId).toBeNull();
		expect(result.current.storeIds).toEqual([1, 2, 3, 5]);
		expect(result.current.nombre).toBe('');
	});

	it('should reject "todas" when section requires a specific store (modo: "una")', () => {
		const accesoAdmin = createMockAcceso({
			roles: new Set(['admin']),
			tiendaPropia: null,
			tiendasPermitidas: mockStores,
		});

		const wrapper = createWrapper('/horarios/registros?tienda=todas');
		const { result } = renderHook(
			() => useTiendaSeleccionada(accesoAdmin, 'una'),
			{ wrapper },
		);

		// Since modo is 'una' and tiendaPropia is null, falls back to first permitted store
		expect(result.current.seleccion).toEqual({ tipo: 'una', id: 1 });
		expect(result.current.storeId).toBe(1);
	});

	it('should default to "todas" for role "report" when in "una-o-todas" mode', () => {
		const accesoReport = createMockAcceso({
			roles: new Set(['report']),
			rolPrincipal: 'report',
			tiendaPropia: 1,
			tiendasPermitidas: mockStores,
		});

		// No tienda query param in URL
		const wrapper = createWrapper('/horarios/reportes');
		const { result } = renderHook(
			() => useTiendaSeleccionada(accesoReport, 'una-o-todas'),
			{ wrapper },
		);

		expect(result.current.seleccion).toEqual({ tipo: 'todas' });
		expect(result.current.storeId).toBeNull();
		expect(result.current.storeIds).toEqual([1, 2, 3, 5]);
	});

	it('should update URL search parameters via setSeleccion', () => {
		const accesoAdmin = createMockAcceso();

		const wrapper = createWrapper('/horarios/registros');
		const { result } = renderHook(
			() => useTiendaSeleccionada(accesoAdmin, 'una-o-todas'),
			{ wrapper },
		);

		act(() => {
			result.current.setSeleccion({ tipo: 'una', id: 3 });
		});
		expect(result.current.seleccion).toEqual({ tipo: 'una', id: 3 });

		act(() => {
			result.current.setSeleccion({ tipo: 'todas' });
		});
		expect(result.current.seleccion).toEqual({ tipo: 'todas' });

		act(() => {
			result.current.setSeleccion({ tipo: 'propia' });
		});
		expect(result.current.seleccion).toEqual({ tipo: 'propia' });
	});
});
