import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuth } from '@/auth/hooks/useAuth';
import {
	useHorariosAcceso,
} from '../../hooks/useHorariosAcceso';
import {
	HorariosLayoutContext,
	useHorariosLayout,
	useHorariosLayoutState,
} from '../../hooks/useHorariosLayout';
import { useIrA, useSeccionActiva } from '../../hooks/useSeccionActiva';
import {
	useTiendaSeleccionada,
} from '../../hooks/useTiendaSeleccionada';
import { SECCIONES } from '../../navigation/secciones';
import type { HorariosAcceso } from '../../interfaces/acceso';
import type { TiendaSeleccionada } from '../../interfaces/tiendas';

vi.mock('@/auth/hooks/useAuth', () => ({
	useAuth: vi.fn(),
}));

vi.mock('../../hooks/useHorariosAcceso', () => ({
	useHorariosAcceso: vi.fn(),
}));

vi.mock('../../hooks/useSeccionActiva', () => ({
	useSeccionActiva: vi.fn(),
	useIrA: vi.fn(),
}));

vi.mock('../../hooks/useTiendaSeleccionada', () => ({
	useTiendaSeleccionada: vi.fn(),
}));

describe('useHorariosLayout', () => {
	const mockedUseAuth = vi.mocked(useAuth);
	const mockedUseHorariosAcceso = vi.mocked(useHorariosAcceso);
	const mockedUseSeccionActiva = vi.mocked(useSeccionActiva);
	const mockedUseIrA = vi.mocked(useIrA);
	const mockedUseTiendaSeleccionada = vi.mocked(useTiendaSeleccionada);

	const mockIrAFn = vi.fn();
	const mockTiendaState = {
		id: 1,
		nombre: 'Tienda Central',
		cambiar: vi.fn(),
		selectorHabilitado: true,
	};

	beforeEach(() => {
		vi.resetAllMocks();

		mockedUseAuth.mockReturnValue({
			user: {
				id: '1',
				email: 'test@kancan.com',
				nombre: 'Test',
				apellido: 'User',
				company: 'Kancan',
				ultra_code: 'U1',
				store_name: 'Tienda Central',
			},
			loading: false,
			isAuthenticated: true,
			login: vi.fn(),
			logout: vi.fn(),
		});

		mockedUseIrA.mockReturnValue(mockIrAFn);
		mockedUseSeccionActiva.mockReturnValue({
			seccion: SECCIONES[0], // registros
			subseccion: null,
		});
		mockedUseTiendaSeleccionada.mockReturnValue(
			mockTiendaState as unknown as TiendaSeleccionada,
		);
	});

	describe('useHorariosLayout consumer', () => {
		it('should throw an error when used outside of HorariosLayoutContext', () => {
			expect(() => renderHook(() => useHorariosLayout())).toThrow(
				'useHorariosLayout debe usarse dentro de <HorariosLayout>',
			);
		});

		it('should return context value when used within HorariosLayoutContext.Provider', () => {
			const mockLayoutValue = {
				acceso: {} as unknown as HorariosAcceso,
				tienda: mockTiendaState as unknown as TiendaSeleccionada,
				seccion: SECCIONES[0],
				subseccion: null,
				seccionesVisibles: [SECCIONES[0]],
				irA: mockIrAFn,
			};

			const wrapper = ({ children }: { children: ReactNode }) => (
				<HorariosLayoutContext.Provider value={mockLayoutValue}>
					{children}
				</HorariosLayoutContext.Provider>
			);

			const { result } = renderHook(() => useHorariosLayout(), { wrapper });
			expect(result.current).toBe(mockLayoutValue);
		});
	});

	describe('useHorariosLayoutState', () => {
		it('should filter seccionesVisibles for standard tienda user (and exclude disabled sections like malla)', () => {
			const mockAcceso = {
				puede: vi.fn((roles: readonly string[]) => roles.includes('tienda')),
				roles: new Set(['tienda']),
				rolPrincipal: 'tienda',
				inicio: 'registros',
				cargando: false,
				puedeVerDemo: false,
				tiendaPropia: 1,
				tiendasPermitidas: [],
			};
			mockedUseHorariosAcceso.mockReturnValue(
				mockAcceso as unknown as HorariosAcceso,
			);

			const { result } = renderHook(() => useHorariosLayoutState());

			const paths = result.current.seccionesVisibles.map((s) => s.path);
			// Standard tienda user can see registros, novedades, historial
			expect(paths).toContain('registros');
			expect(paths).toContain('novedades');
			expect(paths).toContain('historial');

			// malla has habilitada: false -> must be excluded
			expect(paths).not.toContain('malla');
			// admin & monitoreo & reportes require elevated roles
			expect(paths).not.toContain('admin');
			expect(paths).not.toContain('monitoreo');
			expect(paths).not.toContain('reportes');

			expect(mockedUseTiendaSeleccionada).toHaveBeenCalledWith(
				mockAcceso,
				SECCIONES[0].tienda,
				'Tienda Central',
			);
		});

		it('should filter seccionesVisibles for admin user', () => {
			const mockAcceso = {
				puede: vi.fn((roles: readonly string[]) => roles.includes('admin')),
				roles: new Set(['admin']),
				rolPrincipal: 'admin',
				inicio: 'registros',
				cargando: false,
				puedeVerDemo: false,
				tiendaPropia: 1,
				tiendasPermitidas: [],
			};
			mockedUseHorariosAcceso.mockReturnValue(
				mockAcceso as unknown as HorariosAcceso,
			);

			const { result } = renderHook(() => useHorariosLayoutState());

			const paths = result.current.seccionesVisibles.map((s) => s.path);
			expect(paths).toContain('registros');
			expect(paths).toContain('novedades');
			expect(paths).toContain('historial');
			expect(paths).toContain('monitoreo');
			expect(paths).toContain('admin');

			// malla is disabled even for admin
			expect(paths).not.toContain('malla');
		});

		it('should use "ninguno" as fallback tienda mode when seccion is null', () => {
			mockedUseSeccionActiva.mockReturnValue({
				seccion: null,
				subseccion: null,
			});

			const mockAcceso = {
				puede: vi.fn(() => false),
				roles: new Set(),
				rolPrincipal: 'tienda',
			};
			mockedUseHorariosAcceso.mockReturnValue(
				mockAcceso as unknown as HorariosAcceso,
			);

			renderHook(() => useHorariosLayoutState());

			expect(mockedUseTiendaSeleccionada).toHaveBeenCalledWith(
				mockAcceso,
				'ninguno',
				'Tienda Central',
			);
		});
	});
});
