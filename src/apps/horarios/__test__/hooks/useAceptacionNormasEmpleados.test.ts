import { act, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as rulesApi from '../../api/directus/rules';
import { useAceptacionNormasEmpleados } from '../../hooks/useAceptacionNormasEmpleados';
import useHorariosPolicies from '../../hooks/useHorariosPolicies';
import { createMockNormas } from '../utils/mocks/rules.mock';
import { renderHookWithQuery } from '../utils/test-utils';

vi.mock('../../api/directus/rules', () => ({
	getNormasActivas: vi.fn(),
	getEmpleadosQueAceptaronNormas: vi.fn(),
}));

vi.mock('../../hooks/useHorariosPolicies', () => ({
	default: vi.fn(),
}));

describe('useAceptacionNormasEmpleados', () => {
	const mockedGetNormasActivas = vi.mocked(rulesApi.getNormasActivas);
	const mockedGetEmpleadosQueAceptaronNormas = vi.mocked(
		rulesApi.getEmpleadosQueAceptaronNormas,
	);
	const mockedUseHorariosPolicies = vi.mocked(useHorariosPolicies);

	beforeEach(() => {
		vi.resetAllMocks();
		// Default: user has temporal policy
		mockedUseHorariosPolicies.mockReturnValue({
			tieneTemporal: () => true,
			hasPolicy: () => false,
			esAdmin: () => false,
			esAreaManager: () => false,
			esReport: () => false, esComercial: () => false,
			puedeVerDemo: () => false,
		});
	});

	it('should return safe defaults while loading (yaAcepto returns true)', () => {
		mockedGetNormasActivas.mockReturnValue(new Promise(() => {})); // Never resolves
		mockedGetEmpleadosQueAceptaronNormas.mockResolvedValue(new Set());

		const { result } = renderHookWithQuery(() =>
			useAceptacionNormasEmpleados(['1', '2']),
		);

		expect(result.current.normas).toBeNull();
		expect(result.current.puedeAceptar).toBe(true);
		// While loading or disabled, yaAcepto returns true as safeguard
		expect(result.current.yaAcepto('1')).toBe(true);
	});

	it('should sanitize, deduplicate, filter demo employees, and query acceptance with sorted IDs', async () => {
		const mockNormas = createMockNormas({ id: 10, version: 3 });
		mockedGetNormasActivas.mockResolvedValue(mockNormas);
		mockedGetEmpleadosQueAceptaronNormas.mockResolvedValue(new Set([2, 5]));

		const rawIds = ['10', '99999', '5', '10', 'invalid-id', '2'];

		const { result } = renderHookWithQuery(() =>
			useAceptacionNormasEmpleados(rawIds),
		);

		await waitFor(() => {
			expect(result.current.normas).toEqual(mockNormas);
		});

		await waitFor(() => {
			expect(mockedGetEmpleadosQueAceptaronNormas).toHaveBeenCalledWith(
				[2, 5, 10], // Sanitized, unique, non-demo, sorted
				10,
				3,
			);
		});

		expect(result.current.yaAcepto('2')).toBe(true);
		expect(result.current.yaAcepto('5')).toBe(true);
		expect(result.current.yaAcepto('10')).toBe(false);
		expect(result.current.yaAcepto('99999')).toBe(true); // Demo employee always returns true
	});

	it('should disable acceptance query when user lacks temporal policy', async () => {
		mockedUseHorariosPolicies.mockReturnValue({
			tieneTemporal: () => false,
			hasPolicy: () => false,
			esAdmin: () => false,
			esAreaManager: () => false,
			esReport: () => false, esComercial: () => false,
			puedeVerDemo: () => false,
		});

		const mockNormas = createMockNormas();
		mockedGetNormasActivas.mockResolvedValue(mockNormas);

		const { result } = renderHookWithQuery(() =>
			useAceptacionNormasEmpleados(['1', '2']),
		);

		await waitFor(() => {
			expect(result.current.normas).toEqual(mockNormas);
		});

		expect(result.current.puedeAceptar).toBe(false);
		expect(mockedGetEmpleadosQueAceptaronNormas).not.toHaveBeenCalled();
		// When query is disabled, yaAcepto returns true to avoid blocking
		expect(result.current.yaAcepto('1')).toBe(true);
	});

	it('should disable acceptance query when list of employee IDs is empty', async () => {
		const mockNormas = createMockNormas();
		mockedGetNormasActivas.mockResolvedValue(mockNormas);

		const { result } = renderHookWithQuery(() =>
			useAceptacionNormasEmpleados([]),
		);

		await waitFor(() => {
			expect(result.current.normas).toEqual(mockNormas);
		});

		expect(mockedGetEmpleadosQueAceptaronNormas).not.toHaveBeenCalled();
	});

	it('should optimistically update cache when marcarAceptado is called', async () => {
		const mockNormas = createMockNormas();
		mockedGetNormasActivas.mockResolvedValue(mockNormas);
		mockedGetEmpleadosQueAceptaronNormas.mockResolvedValue(new Set([1]));

		const { result } = renderHookWithQuery(() =>
			useAceptacionNormasEmpleados(['1', '2']),
		);

		await waitFor(() => {
			expect(result.current.yaAcepto('2')).toBe(false);
		});

		act(() => {
			result.current.marcarAceptado('2');
		});

		await waitFor(() => {
			expect(result.current.yaAcepto('2')).toBe(true);
		});
		expect(result.current.yaAcepto('1')).toBe(true);
	});

	it('should verify acceptance directly with verificarAceptacion and synchronize cache', async () => {
		const mockNormas = createMockNormas({ id: 5, version: 1 });
		mockedGetNormasActivas.mockResolvedValue(mockNormas);
		mockedGetEmpleadosQueAceptaronNormas.mockResolvedValueOnce(new Set([])); // Store query: neither accepted

		const { result } = renderHookWithQuery(() =>
			useAceptacionNormasEmpleados(['3']),
		);

		await waitFor(() => {
			expect(result.current.yaAcepto('3')).toBe(false);
		});

		// Fresh check reports employee 3 has accepted
		mockedGetEmpleadosQueAceptaronNormas.mockResolvedValueOnce(new Set([3]));

		let verificationResult = false;
		await act(async () => {
			verificationResult = await result.current.verificarAceptacion('3');
		});

		expect(verificationResult).toBe(true);
		// Cache should be synchronized
		await waitFor(() => {
			expect(result.current.yaAcepto('3')).toBe(true);
		});
	});

	it('should return true immediately from verificarAceptacion for demo employees or when no normas exist', async () => {
		// Test demo employee
		const mockNormas = createMockNormas();
		mockedGetNormasActivas.mockResolvedValue(mockNormas);

		const { result } = renderHookWithQuery(() =>
			useAceptacionNormasEmpleados([]),
		);

		let demoResult = false;
		await act(async () => {
			demoResult = await result.current.verificarAceptacion('99999');
		});
		expect(demoResult).toBe(true);
		expect(mockedGetEmpleadosQueAceptaronNormas).not.toHaveBeenCalled();

		// Test when no normas exist
		mockedGetNormasActivas.mockResolvedValue(null);
		const { result: resultNoNormas } = renderHookWithQuery(() =>
			useAceptacionNormasEmpleados([]),
		);

		let noNormasResult = false;
		await act(async () => {
			noNormasResult = await resultNoNormas.current.verificarAceptacion('1');
		});
		expect(noNormasResult).toBe(true);
	});

	it('should fallback to true in verificarAceptacion when network call fails', async () => {
		const mockNormas = createMockNormas();
		mockedGetNormasActivas.mockResolvedValue(mockNormas);

		// With empty IDs array, the store query remains disabled and does not call getEmpleadosQueAceptaronNormas
		const { result } = renderHookWithQuery(() =>
			useAceptacionNormasEmpleados([]),
		);

		await waitFor(() => {
			expect(result.current.normas).toEqual(mockNormas);
		});

		// Spy on console.error to keep test output clean
		const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

		// Now make the direct verification request fail
		mockedGetEmpleadosQueAceptaronNormas.mockRejectedValueOnce(
			new Error('Network failure'),
		);

		let fallbackResult = false;
		await act(async () => {
			fallbackResult = await result.current.verificarAceptacion('4');
		});

		expect(fallbackResult).toBe(true);
		expect(consoleSpy).toHaveBeenCalled();
		consoleSpy.mockRestore();
	});
});
