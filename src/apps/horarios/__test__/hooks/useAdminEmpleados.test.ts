import { act, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAvisos } from '../../hooks/useAvisos';
import * as directusCreate from '../../api/directus/create';
import * as directusRead from '../../api/directus/read';
import {
	TIPOS_DOCUMENTO,
	useAdminEmpleados,
} from '../../hooks/useAdminEmpleados';
import {
	createMockCargo,
	createMockEmpleadoAdmin,
} from '../utils/mocks/employees.mock';
import { createMockTiendas } from '../utils/mocks/stores.mock';
import { renderHookWithQuery } from '../utils/test-utils';

vi.mock('../../hooks/useAvisos', () => ({
	useAvisos: vi.fn(),
}));

vi.mock('../../api/directus/read', () => ({
	getStores: vi.fn(),
	getCargos: vi.fn(),
	buscarEmpleados: vi.fn(),
	listarEmpleadosTienda: vi.fn(),
}));

vi.mock('../../api/directus/create', () => ({
	crearEmpleado: vi.fn(),
	actualizarEmpleado: vi.fn(),
}));

describe('useAdminEmpleados', () => {
	const mockedUseAvisos = vi.mocked(useAvisos);
	const mockedGetStores = vi.mocked(directusRead.getStores);
	const mockedGetCargos = vi.mocked(directusRead.getCargos);
	const mockedBuscarEmpleados = vi.mocked(directusRead.buscarEmpleados);
	const mockedListarEmpleadosTienda = vi.mocked(
		directusRead.listarEmpleadosTienda,
	);
	const mockedCrearEmpleado = vi.mocked(directusCreate.crearEmpleado);
	const mockedActualizarEmpleado = vi.mocked(directusCreate.actualizarEmpleado);

	const mockShowSnackbar = vi.fn();
	const mockSetTiendaSel = vi.fn();

	beforeEach(() => {
		vi.resetAllMocks();

		mockedUseAvisos.mockReturnValue({
			showSnackbar: mockShowSnackbar,
		});

		mockedGetStores.mockResolvedValue(createMockTiendas());
		mockedGetCargos.mockResolvedValue([createMockCargo()]);
		mockedListarEmpleadosTienda.mockResolvedValue([createMockEmpleadoAdmin()]);
		mockedBuscarEmpleados.mockResolvedValue([createMockEmpleadoAdmin()]);
	});

	it('should load tiendas and cargos catalogs and expose TIPOS_DOCUMENTO', async () => {
		const { result } = renderHookWithQuery(() =>
			useAdminEmpleados(null, mockSetTiendaSel),
		);

		await waitFor(() => {
			expect(result.current.loadingCatalogos).toBe(false);
		});

		expect(result.current.tiendas).toHaveLength(4);
		expect(result.current.cargos).toHaveLength(1);
		expect(result.current.tiposDocumento).toEqual(TIPOS_DOCUMENTO);
	});

	it('should disable store employees query when tiendaSel is null', () => {
		const { result } = renderHookWithQuery(() =>
			useAdminEmpleados(null, mockSetTiendaSel),
		);

		expect(mockedListarEmpleadosTienda).not.toHaveBeenCalled();
		expect(result.current.empleadosTienda).toEqual([]);
	});

	it('should fetch store employees when tiendaSel is provided', async () => {
		const mockEmployees = [
			createMockEmpleadoAdmin({ id: 1, first_name: 'Ana' }),
			createMockEmpleadoAdmin({ id: 2, first_name: 'Carlos' }),
		];
		mockedListarEmpleadosTienda.mockResolvedValue(mockEmployees);

		const { result } = renderHookWithQuery(() =>
			useAdminEmpleados(3, mockSetTiendaSel),
		);

		await waitFor(() => {
			expect(result.current.loadingTienda).toBe(false);
		});

		expect(mockedListarEmpleadosTienda).toHaveBeenCalledWith(3);
		expect(result.current.empleadosTienda).toEqual(mockEmployees);
	});

	describe('search and selection', () => {
		it('should ignore empty search queries', async () => {
			const { result } = renderHookWithQuery(() =>
				useAdminEmpleados(null, mockSetTiendaSel),
			);

			await act(async () => {
				await result.current.buscar('   ');
			});

			expect(mockedBuscarEmpleados).not.toHaveBeenCalled();
			expect(result.current.yaBusco).toBe(false);
		});

		it('should search employees and populate resultados', async () => {
			const foundEmployees = [
				createMockEmpleadoAdmin({ id: 5, first_name: 'María' }),
			];
			mockedBuscarEmpleados.mockResolvedValue(foundEmployees);

			const { result } = renderHookWithQuery(() =>
				useAdminEmpleados(null, mockSetTiendaSel),
			);

			await act(async () => {
				await result.current.buscar('María');
			});

			expect(mockedBuscarEmpleados).toHaveBeenCalledWith('María');
			expect(result.current.resultados).toEqual(foundEmployees);
			expect(result.current.yaBusco).toBe(true);
			expect(result.current.buscando).toBe(false);
		});

		it('should handle search errors and show snackbar', async () => {
			mockedBuscarEmpleados.mockRejectedValue(new Error('Fallo de red'));

			const { result } = renderHookWithQuery(() =>
				useAdminEmpleados(null, mockSetTiendaSel),
			);

			await act(async () => {
				await result.current.buscar('test');
			});

			expect(mockShowSnackbar).toHaveBeenCalledWith('Fallo de red', 'error');
			expect(result.current.resultados).toEqual([]);
			expect(result.current.buscando).toBe(false);
		});

		it('should select and clear search correctly', async () => {
			const employee = createMockEmpleadoAdmin();
			const { result } = renderHookWithQuery(() =>
				useAdminEmpleados(null, mockSetTiendaSel),
			);

			act(() => {
				result.current.seleccionar(employee);
			});
			expect(result.current.empleado).toBe(employee);

			act(() => {
				result.current.limpiarBusqueda();
			});
			expect(result.current.empleado).toBeNull();
			expect(result.current.resultados).toEqual([]);
			expect(result.current.yaBusco).toBe(false);
		});
	});

	describe('mutations', () => {
		it('should execute crearEmpleado mutation successfully and invalidate queries', async () => {
			mockedCrearEmpleado.mockResolvedValue({ id: 99 } as unknown as Awaited<
				ReturnType<typeof directusCreate.crearEmpleado>
			>);

			const { result, queryClient } = renderHookWithQuery(() =>
				useAdminEmpleados(null, mockSetTiendaSel),
			);

			const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

			const newEmployee = {
				document_type: 'Cédula de Ciudadanía',
				document_number: '98765432',
				first_name: 'Pedro',
				last_name: 'López',
				store_id: 1,
				position_id: 1,
			};

			await act(async () => {
				await result.current.crearEmpleado(newEmployee);
			});

			expect(mockedCrearEmpleado).toHaveBeenCalledWith(
				newEmployee,
				expect.anything(),
			);
			expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['empleados'] });
			expect(invalidateSpy).toHaveBeenCalledWith({
				queryKey: ['adminEmpleadosTienda'],
			});
			expect(invalidateSpy).toHaveBeenCalledWith({
				queryKey: ['adminTodosEmpleados'],
			});
		});

		it('should execute actualizarEmpleado mutation, update local state, and show success snackbar', async () => {
			const initialEmp = createMockEmpleadoAdmin({
				id: 10,
				first_name: 'Laura',
			});
			mockedActualizarEmpleado.mockResolvedValue({
				...initialEmp,
				first_name: 'Laura Sofía',
			});

			const { result } = renderHookWithQuery(() =>
				useAdminEmpleados(null, mockSetTiendaSel),
			);

			// Pre-populate search results and selected employee
			act(() => {
				result.current.seleccionar(initialEmp);
			});

			await act(async () => {
				await result.current.actualizarEmpleado({
					id: 10,
					data: { first_name: 'Laura Sofía' },
				});
			});

			expect(mockedActualizarEmpleado).toHaveBeenCalledWith(10, {
				first_name: 'Laura Sofía',
			});
			expect(result.current.empleado?.first_name).toBe('Laura Sofía');
			expect(mockShowSnackbar).toHaveBeenCalledWith(
				'Empleado actualizado correctamente',
				'success',
			);
		});

		it('should show error snackbar when actualizarEmpleado fails', async () => {
			mockedActualizarEmpleado.mockRejectedValue(
				new Error('Error al actualizar'),
			);

			const { result } = renderHookWithQuery(() =>
				useAdminEmpleados(null, mockSetTiendaSel),
			);

			await act(async () => {
				try {
					await result.current.actualizarEmpleado({
						id: 10,
						data: { first_name: 'Nuevo' },
					});
				} catch {
					// Expected mutation rejection
				}
			});

			expect(mockShowSnackbar).toHaveBeenCalledWith(
				'Error al actualizar',
				'error',
			);
		});
	});
});
