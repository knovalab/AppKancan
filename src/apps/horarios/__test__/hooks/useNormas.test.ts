import { act, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { User } from '@/auth/hooks/AuthContext';
import { useAuth } from '@/auth/hooks/useAuth';
import * as rulesApi from '../../api/directus/rules';
import { useNormas } from '../../hooks/useNormas';
import { createMockNormas } from '../utils/mocks/rules.mock';
import { renderHookWithQuery } from '../utils/test-utils';

vi.mock('@/auth/hooks/useAuth', () => ({
	useAuth: vi.fn(),
}));

vi.mock('../../api/directus/rules', () => ({
	getNormasActivas: vi.fn(),
}));

describe('useNormas', () => {
	const mockedUseAuth = vi.mocked(useAuth);
	const mockedGetNormasActivas = vi.mocked(rulesApi.getNormasActivas);

	const mockUser: User = {
		id: 'usr-42',
		email: 'empleado@kancan.com',
		nombre: 'Empleado',
		apellido: 'Prueba',
		company: 'Kancan',
		ultra_code: 'U1',
	};

	beforeEach(() => {
		vi.resetAllMocks();
		localStorage.clear();

		mockedUseAuth.mockReturnValue({
			user: mockUser,
			loading: false,
			isAuthenticated: true,
			login: vi.fn(),
			logout: vi.fn(),
		});

		mockedGetNormasActivas.mockResolvedValue(
			createMockNormas({ id: 1, version: 2 }),
		);
	});

	it('should not require acceptance (debeAceptar: false) if user is not authenticated', async () => {
		mockedUseAuth.mockReturnValue({
			user: null,
			loading: false,
			isAuthenticated: false,
			login: vi.fn(),
			logout: vi.fn(),
		});

		const { result } = renderHookWithQuery(() => useNormas());

		await waitFor(() => {
			expect(result.current.normas).not.toBeNull();
		});

		expect(result.current.debeAceptar).toBe(false);
	});

	it('should not require acceptance (debeAceptar: false) if normas query resolves to null', async () => {
		mockedGetNormasActivas.mockResolvedValue(null);

		const { result } = renderHookWithQuery(() => useNormas());

		await waitFor(() => {
			expect(result.current.normas).toBeNull();
		});

		expect(result.current.debeAceptar).toBe(false);
	});

	it('should require acceptance (debeAceptar: true) when user has not accepted current version in localStorage', async () => {
		const { result } = renderHookWithQuery(() => useNormas());

		await waitFor(() => {
			expect(result.current.normas?.version).toBe(2);
		});

		await waitFor(() => {
			expect(result.current.debeAceptar).toBe(true);
		});
	});

	it('should not require acceptance (debeAceptar: false) if already accepted in localStorage', async () => {
		localStorage.setItem('kancan_rules_accepted_usr-42_v2', 'true');

		const { result } = renderHookWithQuery(() => useNormas());

		await waitFor(() => {
			expect(result.current.normas?.version).toBe(2);
		});

		await waitFor(() => {
			expect(result.current.debeAceptar).toBe(false);
		});
	});

	it('should store acceptance in localStorage and update debeAceptar when aceptar() is called', async () => {
		const { result } = renderHookWithQuery(() => useNormas());

		await waitFor(() => {
			expect(result.current.debeAceptar).toBe(true);
		});

		await act(async () => {
			await result.current.aceptar();
		});

		expect(localStorage.getItem('kancan_rules_accepted_usr-42_v2')).toBe(
			'true',
		);
		expect(result.current.debeAceptar).toBe(false);
	});

	it('should manage manualOpen state', () => {
		const { result } = renderHookWithQuery(() => useNormas());

		expect(result.current.manualOpen).toBe(false);

		act(() => {
			result.current.setManualOpen(true);
		});
		expect(result.current.manualOpen).toBe(true);

		act(() => {
			result.current.setManualOpen(false);
		});
		expect(result.current.manualOpen).toBe(false);
	});
});
