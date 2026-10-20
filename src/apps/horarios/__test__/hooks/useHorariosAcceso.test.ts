import { waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthContextType, User } from '@/auth/hooks/AuthContext';
import { useAuth } from '@/auth/hooks/useAuth';
import { obtenerTiendasIdsUsuarioActual } from '@/services/directus/userStores';
import * as directusRead from '../../api/directus/read';
import { useHorariosAcceso } from '../../hooks/useHorariosAcceso';
import useHorariosPolicies from '../../hooks/useHorariosPolicies';
import { createMockTiendas } from '../utils/mocks/stores.mock';
import { renderHookWithQuery } from '../utils/test-utils';

vi.mock('@/auth/hooks/useAuth', () => ({
	useAuth: vi.fn(),
}));

vi.mock('@/services/directus/userStores', () => ({
	obtenerTiendasIdsUsuarioActual: vi.fn(),
}));

vi.mock('../../api/directus/read', () => ({
	getStoreIdUsuarioActual: vi.fn(),
	getStores: vi.fn(),
}));

vi.mock('../../hooks/useHorariosPolicies', () => ({
	default: vi.fn(),
}));

describe('useHorariosAcceso', () => {
	const mockedUseAuth = vi.mocked(useAuth);
	const mockedUseHorariosPolicies = vi.mocked(useHorariosPolicies);
	const mockedGetStoreIdUsuarioActual = vi.mocked(
		directusRead.getStoreIdUsuarioActual,
	);
	const mockedGetStores = vi.mocked(directusRead.getStores);
	const mockedObtenerTiendasIdsUsuarioActual = vi.mocked(
		obtenerTiendasIdsUsuarioActual,
	);

	const defaultUser: NonNullable<User> = {
		id: 'user-123',
		email: 'empleado@kancan.com',
		nombre: 'Empleado',
		apellido: 'Prueba',
		company: 'Kancan',
		ultra_code: 'K01',
		policies: [],
	};

	const createMockAuthContext = (
		overrides: Partial<AuthContextType> = {},
	): AuthContextType => ({
		user: defaultUser,
		loading: false,
		isAuthenticated: true,
		login: vi.fn(),
		logout: vi.fn(),
		...overrides,
	});

	beforeEach(() => {
		vi.resetAllMocks();

		// Default auth state
		mockedUseAuth.mockReturnValue(createMockAuthContext());

		// Default policy functions: standard tienda user
		mockedUseHorariosPolicies.mockReturnValue({
			hasPolicy: () => false,
			esAdmin: () => false,
			esAreaManager: () => false,
			esReport: () => false, esComercial: () => false,
			tieneTemporal: () => false,
			puedeVerDemo: () => false,
		});

		mockedGetStoreIdUsuarioActual.mockResolvedValue(1);
		mockedGetStores.mockResolvedValue(createMockTiendas());
		mockedObtenerTiendasIdsUsuarioActual.mockResolvedValue([1, 2]);
	});

	it('should return role "tienda" with inicio "registros" and empty tiendasPermitidas for basic store user', async () => {
		const { result } = renderHookWithQuery(() => useHorariosAcceso());

		await waitFor(() => {
			expect(result.current.cargando).toBe(false);
		});

		expect(result.current.roles.has('tienda')).toBe(true);
		expect(result.current.roles.has('admin')).toBe(false);
		expect(result.current.roles.has('areaManager')).toBe(false);
		expect(result.current.roles.has('report')).toBe(false);

		expect(result.current.rolPrincipal).toBe('tienda');
		expect(result.current.inicio).toBe('registros');
		expect(result.current.tiendasPermitidas).toEqual([]);
		expect(result.current.puede(['tienda'])).toBe(true);
		expect(result.current.puede(['admin', 'areaManager'])).toBe(false);

		// Queries for admin stores and area manager stores are not triggered
		expect(mockedGetStores).not.toHaveBeenCalled();
		expect(mockedObtenerTiendasIdsUsuarioActual).not.toHaveBeenCalled();
	});

	it('should return role "admin" with all stores in tiendasPermitidas and inicio "registros"', async () => {
		mockedUseHorariosPolicies.mockReturnValue({
			hasPolicy: () => true,
			esAdmin: () => true,
			esAreaManager: () => false,
			esReport: () => false, esComercial: () => false,
			tieneTemporal: () => false,
			puedeVerDemo: () => false,
		});

		const mockStores = createMockTiendas();
		mockedGetStores.mockResolvedValue(mockStores);

		const { result } = renderHookWithQuery(() => useHorariosAcceso());

		await waitFor(() => {
			expect(result.current.cargando).toBe(false);
		});

		expect(result.current.roles.has('admin')).toBe(true);
		expect(result.current.rolPrincipal).toBe('admin');
		expect(result.current.inicio).toBe('registros');
		expect(result.current.tiendasPermitidas).toEqual(mockStores);
		expect(result.current.puede(['admin'])).toBe(true);
		expect(result.current.puede(['areaManager'])).toBe(false);

		// Admin triggers getStores, but NOT area manager store access query
		expect(mockedGetStores).toHaveBeenCalledTimes(1);
		expect(mockedObtenerTiendasIdsUsuarioActual).not.toHaveBeenCalled();
	});

	it('should give admin precedence over areaManager when user has both policies', async () => {
		mockedUseHorariosPolicies.mockReturnValue({
			hasPolicy: () => true,
			esAdmin: () => true,
			esAreaManager: () => true, // User has both policies
			esReport: () => false, esComercial: () => false,
			tieneTemporal: () => false,
			puedeVerDemo: () => false,
		});

		const { result } = renderHookWithQuery(() => useHorariosAcceso());

		await waitFor(() => {
			expect(result.current.cargando).toBe(false);
		});

		expect(result.current.roles.has('admin')).toBe(true);
		// areaManager = esAreaManager() && !admin -> must be false
		expect(result.current.roles.has('areaManager')).toBe(false);
		expect(result.current.rolPrincipal).toBe('admin');
	});

	it('should return role "areaManager" with assigned stores filtered and store 5 excluded', async () => {
		mockedUseHorariosPolicies.mockReturnValue({
			hasPolicy: () => true,
			esAdmin: () => false,
			esAreaManager: () => true,
			esReport: () => false, esComercial: () => false,
			tieneTemporal: () => false,
			puedeVerDemo: () => true,
		});

		const allStores = createMockTiendas(); // IDs 1, 2, 3, 5
		mockedGetStores.mockResolvedValue(allStores);
		// User has access to store 2, store 3, and store 5 (5 must be filtered out as TIENDA_EXCLUIDA_AREA)
		mockedObtenerTiendasIdsUsuarioActual.mockResolvedValue([2, 3, 5]);

		const { result } = renderHookWithQuery(() => useHorariosAcceso());

		await waitFor(() => {
			expect(result.current.cargando).toBe(false);
		});

		expect(result.current.roles.has('areaManager')).toBe(true);
		expect(result.current.rolPrincipal).toBe('areaManager');
		expect(result.current.inicio).toBe('monitoreo');
		expect(result.current.puedeVerDemo).toBe(true);

		// Stores 2 and 3 should be permitted; store 5 excluded; store 1 not assigned
		const permittedIds = result.current.tiendasPermitidas.map((t) => t.id);
		expect(permittedIds).toEqual([2, 3]);

		expect(mockedGetStores).toHaveBeenCalledTimes(1);
		expect(mockedObtenerTiendasIdsUsuarioActual).toHaveBeenCalledWith({
			excludeOnline: true,
		});
	});

	it('should support object shape in tiendasAcceso for areaManager ({ id } or { store_id })', async () => {
		mockedUseHorariosPolicies.mockReturnValue({
			hasPolicy: () => true,
			esAdmin: () => false,
			esAreaManager: () => true,
			esReport: () => false, esComercial: () => false,
			tieneTemporal: () => false,
			puedeVerDemo: () => false,
		});

		const allStores = createMockTiendas(); // IDs 1, 2, 3, 5
		mockedGetStores.mockResolvedValue(allStores);
		// Access returned as objects
		mockedObtenerTiendasIdsUsuarioActual.mockResolvedValue([
			{ id: 1 },
			{ store_id: 2 },
		] as unknown as number[]);

		const { result } = renderHookWithQuery(() => useHorariosAcceso());

		await waitFor(() => {
			expect(result.current.cargando).toBe(false);
		});

		const permittedIds = result.current.tiendasPermitidas.map((t) => t.id);
		expect(permittedIds).toEqual([1, 2]);
	});

	it('should return role "report" with inicio "reportes" and all stores in tiendasPermitidas', async () => {
		mockedUseHorariosPolicies.mockReturnValue({
			hasPolicy: () => true,
			esAdmin: () => false,
			esAreaManager: () => false,
			esReport: () => true, esComercial: () => false,
			tieneTemporal: () => false,
			puedeVerDemo: () => false,
		});

		const allStores = createMockTiendas();
		mockedGetStores.mockResolvedValue(allStores);

		const { result } = renderHookWithQuery(() => useHorariosAcceso());

		await waitFor(() => {
			expect(result.current.cargando).toBe(false);
		});

		expect(result.current.roles.has('report')).toBe(true);
		expect(result.current.rolPrincipal).toBe('report');
		expect(result.current.inicio).toBe('reportes');
		expect(result.current.tiendasPermitidas).toEqual(allStores);
		expect(result.current.puede(['report'])).toBe(true);
		expect(result.current.puede(['admin'])).toBe(false);
	});

	it('comercial se suma: un usuario de tienda conserva su rol, su inicio y sus tiendas', async () => {
		mockedUseHorariosPolicies.mockReturnValue({
			hasPolicy: () => true,
			esAdmin: () => false,
			esAreaManager: () => false,
			esReport: () => false, esComercial: () => true,
			tieneTemporal: () => false,
			puedeVerDemo: () => false,
		});
		const allStores = createMockTiendas();
		mockedGetStores.mockResolvedValue(allStores);

		const { result } = renderHookWithQuery(() => useHorariosAcceso());
		await waitFor(() => expect(result.current.cargando).toBe(false));

		expect([...result.current.roles].sort()).toEqual(['comercial', 'tienda']);
		expect(result.current.rolPrincipal).toBe('tienda');
		expect(result.current.inicio).toBe('registros');
		expect(result.current.tiendasPermitidas).toEqual([]);
		expect(result.current.tiendasComercial).toEqual(allStores);
	});

	it('comercial + areaManager: mantiene sus tiendas asignadas y suma el rol comercial', async () => {
		mockedUseHorariosPolicies.mockReturnValue({
			hasPolicy: () => true,
			esAdmin: () => false,
			esAreaManager: () => true,
			esReport: () => true, esComercial: () => true,
			tieneTemporal: () => false,
			puedeVerDemo: () => false,
		});

		const { result } = renderHookWithQuery(() => useHorariosAcceso());
		await waitFor(() => expect(result.current.cargando).toBe(false));

		expect(result.current.roles.has('areaManager')).toBe(true);
		expect(result.current.roles.has('report')).toBe(true);
		expect(result.current.roles.has('comercial')).toBe(true);
		expect(result.current.inicio).toBe('monitoreo');
		expect(result.current.tiendasPermitidas.map((t) => Number(t.id)).sort()).toEqual([1, 2]);
	});

	it('should prioritize areaManager over report when user has both roles', async () => {
		mockedUseHorariosPolicies.mockReturnValue({
			hasPolicy: () => true,
			esAdmin: () => false,
			esAreaManager: () => true,
			esReport: () => true, esComercial: () => false,
			tieneTemporal: () => false,
			puedeVerDemo: () => false,
		});

		mockedObtenerTiendasIdsUsuarioActual.mockResolvedValue([1]);

		const { result } = renderHookWithQuery(() => useHorariosAcceso());

		await waitFor(() => {
			expect(result.current.cargando).toBe(false);
		});

		expect(result.current.roles.has('areaManager')).toBe(true);
		expect(result.current.roles.has('report')).toBe(true);
		// PRIORIDAD_ROL puts areaManager before report
		expect(result.current.rolPrincipal).toBe('areaManager');
		expect(result.current.inicio).toBe('monitoreo');
	});

	it('should report cargando as true when auth is loading or user is null', () => {
		mockedUseAuth.mockReturnValue(
			createMockAuthContext({
				user: null,
				loading: true,
			}),
		);

		const { result } = renderHookWithQuery(() => useHorariosAcceso());

		expect(result.current.cargando).toBe(true);
	});

	it('should reflect tiendaPropia from getStoreIdUsuarioActual', async () => {
		mockedGetStoreIdUsuarioActual.mockResolvedValue(42);

		const { result } = renderHookWithQuery(() => useHorariosAcceso());

		await waitFor(() => {
			expect(result.current.tiendaPropia).toBe(42);
		});
	});
});
