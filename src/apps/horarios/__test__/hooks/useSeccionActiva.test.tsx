import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { useIrA, useSeccionActiva } from '../../hooks/useSeccionActiva';

describe('useSeccionActiva and useIrA', () => {
	const createRouterWrapper = (initialEntries: string[]) => {
		return function RouterWrapper({ children }: { children: ReactNode }) {
			return (
				<MemoryRouter initialEntries={initialEntries}>{children}</MemoryRouter>
			);
		};
	};

	describe('useSeccionActiva', () => {
		it('should resolve active section without subseccion', () => {
			const wrapper = createRouterWrapper(['/horarios/registros']);
			const { result } = renderHook(() => useSeccionActiva(), { wrapper });

			expect(result.current.seccion?.path).toBe('registros');
			expect(result.current.subseccion).toBeNull();
		});

		it('should resolve active section and matching subseccion', () => {
			const wrapper = createRouterWrapper(['/horarios/monitoreo/resumen']);
			const { result } = renderHook(() => useSeccionActiva(), { wrapper });

			expect(result.current.seccion?.path).toBe('monitoreo');
			expect(result.current.subseccion?.path).toBe('resumen');
			expect(result.current.subseccion?.label).toBe('Resumen de Asistencia');
		});

		it('should return nulls when route does not match any known section', () => {
			const wrapper = createRouterWrapper(['/horarios/seccion_inexistente']);
			const { result } = renderHook(() => useSeccionActiva(), { wrapper });

			expect(result.current.seccion).toBeNull();
			expect(result.current.subseccion).toBeNull();
		});

		it('should return nulls when outside /horarios base route', () => {
			const wrapper = createRouterWrapper(['/facturacion/panel']);
			const { result } = renderHook(() => useSeccionActiva(), { wrapper });

			expect(result.current.seccion).toBeNull();
			expect(result.current.subseccion).toBeNull();
		});
	});

	describe('useIrA', () => {
		it('should navigate to destination while preserving existing search parameters', () => {
			const locationRef = {
				current: null as ReturnType<typeof useLocation> | null,
			};

			function LocationProbe() {
				locationRef.current = useLocation();
				return null;
			}

			const wrapper = ({ children }: { children: ReactNode }) => (
				<MemoryRouter
					initialEntries={['/horarios/registros?tienda=5&desde=2026-10-01']}
				>
					<LocationProbe />
					{children}
				</MemoryRouter>
			);

			const { result } = renderHook(() => useIrA(), { wrapper });

			act(() => {
				result.current('novedades');
			});

			expect(locationRef.current?.pathname).toBe('/horarios/novedades');
			expect(locationRef.current?.search).toBe('?tienda=5&desde=2026-10-01');
		});
	});
});
