import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { User } from '@/auth/hooks/AuthContext';
import { useAuth } from '@/auth/hooks/useAuth';
import { ensureValidToken } from '@/auth/services/directusInterceptor';
import {
	cargarTokenStorage,
	type StoredTokens,
} from '@/auth/services/tokenDirectus';
import {
	type NombreSeparado,
	useParseNombreIA,
} from '../../hooks/useParseNombreIA';

vi.mock('@/auth/hooks/useAuth', () => ({
	useAuth: vi.fn(),
}));

vi.mock('@/auth/services/tokenDirectus', () => ({
	cargarTokenStorage: vi.fn(),
}));

vi.mock('@/auth/services/directusInterceptor', () => ({
	ensureValidToken: vi.fn(),
}));

describe('useParseNombreIA', () => {
	const mockedUseAuth = vi.mocked(useAuth);
	const mockedEnsureValidToken = vi.mocked(ensureValidToken);
	const mockedCargarTokenStorage = vi.mocked(cargarTokenStorage);

	const defaultUser: User = {
		id: '1',
		email: 'admin@kancan.com',
		nombre: 'Admin',
		apellido: 'Kancan',
		company: 'Kancan',
		ultra_code: 'U1',
		ia_key: 'encrypted-gemini-key',
		models_ia: JSON.stringify([{ name: 'gemini-test-model' }]),
	};

	const defaultTokens: StoredTokens = {
		access: 'fake-access-token',
		refresh: 'fake-refresh',
		expires_at: Date.now() + 100000,
	};

	beforeEach(() => {
		vi.resetAllMocks();

		mockedUseAuth.mockReturnValue({
			user: defaultUser,
			loading: false,
			isAuthenticated: true,
			login: vi.fn(),
			logout: vi.fn(),
		});

		mockedEnsureValidToken.mockResolvedValue(undefined);
		mockedCargarTokenStorage.mockReturnValue(defaultTokens);
	});

	it('should report disponible as true when ia_key is present in user', () => {
		const { result } = renderHook(() => useParseNombreIA());
		expect(result.current.disponible).toBe(true);
	});

	it('should report disponible as false when ia_key is absent', () => {
		mockedUseAuth.mockReturnValue({
			user: { ...defaultUser, ia_key: undefined },
			loading: false,
			isAuthenticated: true,
			login: vi.fn(),
			logout: vi.fn(),
		});

		const { result } = renderHook(() => useParseNombreIA());
		expect(result.current.disponible).toBe(false);
	});

	it('should throw an error when nombre is empty or whitespace', async () => {
		const { result } = renderHook(() => useParseNombreIA());

		await expect(result.current.separarNombre('   ')).rejects.toThrow(
			'Escribe el nombre completo',
		);
	});

	it('should throw an error when ia_key is missing upon separation attempt', async () => {
		mockedUseAuth.mockReturnValue({
			user: { ...defaultUser, ia_key: undefined },
			loading: false,
			isAuthenticated: true,
			login: vi.fn(),
			logout: vi.fn(),
		});

		const { result } = renderHook(() => useParseNombreIA());

		await expect(
			result.current.separarNombre('Juan Carlos Perez'),
		).rejects.toThrow('No tienes una clave de IA configurada en tu cuenta');
	});

	it('should call Gemini API, parse response JSON, and return formatted name parts', async () => {
		const mockResponseText = JSON.stringify({
			first_name: 'juan',
			middle_name: 'carlos',
			last_name: 'perez',
			second_last_name: 'gomez',
		});

		const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
			ok: true,
			json: async () => ({ text: mockResponseText }),
		} as Response);

		const { result } = renderHook(() => useParseNombreIA());

		let separated: NombreSeparado | null = null;
		await act(async () => {
			separated = await result.current.separarNombre('JUAN CARLOS PEREZ GOMEZ');
		});

		expect(fetchSpy).toHaveBeenCalledTimes(1);
		expect(separated).toEqual({
			first_name: 'Juan',
			middle_name: 'Carlos',
			last_name: 'Perez',
			second_last_name: 'Gomez',
		});

		fetchSpy.mockRestore();
	});

	it('should handle markdown fenced code blocks from IA response', async () => {
		const fencedResponse =
			'```json\n{"first_name": "Maria", "middle_name": "Jose", "last_name": "de la Rosa", "second_last_name": "Lopez"}\n```';

		const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
			ok: true,
			json: async () => ({ text: fencedResponse }),
		} as Response);

		const { result } = renderHook(() => useParseNombreIA());

		const separatedRef = { current: null as NombreSeparado | null };
		await act(async () => {
			separatedRef.current = await result.current.separarNombre(
				'Maria Jose de la Rosa',
			);
		});

		expect(separatedRef.current?.first_name).toBe('Maria');
		expect(separatedRef.current?.last_name).toBe('De la Rosa');

		fetchSpy.mockRestore();
	});

	it('should try subsequent models when the first one fails', async () => {
		mockedUseAuth.mockReturnValue({
			user: {
				...defaultUser,
				models_ia: [{ name: 'primary-model' }, { name: 'backup-model' }],
			},
			loading: false,
			isAuthenticated: true,
			login: vi.fn(),
			logout: vi.fn(),
		});

		const fetchSpy = vi
			.spyOn(globalThis, 'fetch')
			.mockResolvedValueOnce({
				ok: false,
				status: 500,
				json: async () => ({ message: 'Model unavailable' }),
			} as Response)
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					text: '{"first_name":"Ana","middle_name":"","last_name":"Diaz","second_last_name":""}',
				}),
			} as Response);

		const { result } = renderHook(() => useParseNombreIA());

		const separatedRef = { current: null as NombreSeparado | null };
		await act(async () => {
			separatedRef.current = await result.current.separarNombre('Ana Diaz');
		});

		expect(fetchSpy).toHaveBeenCalledTimes(2);
		expect(separatedRef.current?.first_name).toBe('Ana');

		fetchSpy.mockRestore();
	});
});
