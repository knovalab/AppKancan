import { waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as directusRead from '../../api/directus/read';
import { LOG_TYPE } from '../../domain/registro';
import { useHistorial } from '../../hooks/useHistorial';
import {
	createMockFullDayRecords,
	createMockTimeRecord,
} from '../utils/mocks/records.mock';
import { renderHookWithQuery } from '../utils/test-utils';

vi.mock('../../api/directus/read', () => ({
	fetchTimeRecords: vi.fn(),
	getStoreIdUsuarioActual: vi.fn(),
}));

describe('useHistorial', () => {
	const mockedFetchTimeRecords = vi.mocked(directusRead.fetchTimeRecords);
	const mockedGetStoreIdUsuarioActual = vi.mocked(
		directusRead.getStoreIdUsuarioActual,
	);

	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('should query records directly with overrideStoreId without fetching user store', async () => {
		const mockRecords = createMockFullDayRecords();
		mockedFetchTimeRecords.mockResolvedValueOnce(mockRecords);

		const { result } = renderHookWithQuery(() =>
			useHistorial('2026-10-01', '2026-10-14', 99),
		);

		await waitFor(() => {
			expect(result.current.isSuccess).toBe(true);
		});

		expect(mockedGetStoreIdUsuarioActual).not.toHaveBeenCalled();
		expect(mockedFetchTimeRecords).toHaveBeenCalledWith(
			'2026-10-01',
			'2026-10-14',
			99,
		);
		expect(result.current.data).toHaveLength(1);
	});

	it('should resolve user store ID first when overrideStoreId is not provided', async () => {
		mockedGetStoreIdUsuarioActual.mockResolvedValueOnce(55);
		mockedFetchTimeRecords.mockResolvedValueOnce([]);

		const { result } = renderHookWithQuery(() =>
			useHistorial('2026-10-01', '2026-10-14'),
		);

		await waitFor(() => {
			expect(result.current.isSuccess).toBe(true);
		});

		expect(mockedGetStoreIdUsuarioActual).toHaveBeenCalledTimes(1);
		expect(mockedFetchTimeRecords).toHaveBeenCalledWith(
			'2026-10-01',
			'2026-10-14',
			55,
		);
		expect(result.current.data).toEqual([]);
	});

	it('should keep query disabled when no override is set and user store ID is null', async () => {
		mockedGetStoreIdUsuarioActual.mockResolvedValueOnce(null);

		const { result } = renderHookWithQuery(() =>
			useHistorial('2026-10-01', '2026-10-14'),
		);

		await waitFor(() => {
			expect(mockedGetStoreIdUsuarioActual).toHaveBeenCalledTimes(1);
		});

		expect(mockedFetchTimeRecords).not.toHaveBeenCalled();
		expect(result.current.fetchStatus).toBe('idle');
	});

	it('should correctly group full-day records into a single HistorialRow with all shift events', async () => {
		const fullDayRecords = createMockFullDayRecords();
		mockedFetchTimeRecords.mockResolvedValueOnce(fullDayRecords);

		const { result } = renderHookWithQuery(() =>
			useHistorial('2026-10-14', '2026-10-14', 5),
		);

		await waitFor(() => {
			expect(result.current.isSuccess).toBe(true);
		});

		const rows = result.current.data ?? [];
		expect(rows).toHaveLength(1);

		const row = rows[0];
		expect(row.fecha).toBe('2026-10-14');
		expect(row.empleado).toBe('Juan Carlos Pérez Gómez');
		expect(row.documento).toBe('1234567890');
		expect(row.inicio_turno).toBe('08:00:00');
		expect(row.inicio_almuerzo).toBe('12:30:00');
		expect(row.fin_almuerzo).toBe('13:30:00');
		expect(row.fin_turno).toBe('17:00:00');
		expect(row.tiendaNombre).toBe('Tienda Central');

		// Check observations mapping (only non-empty ones included)
		expect(row.observaciones_evento).toEqual([
			{
				evento: LOG_TYPE.inicioAlmuerzo,
				hora: '12:30:00',
				observacion: 'Almuerzo regular',
			},
			{
				evento: LOG_TYPE.finJornada,
				hora: '17:00:00',
				observacion: 'Cierre puntual',
			},
		]);
	});

	it('should group records by employee and date into separate rows', async () => {
		const records = [
			// Employee 1 on day 1
			createMockTimeRecord({
				id: 1,
				record_date: '2026-10-14',
				log_type: LOG_TYPE.inicioJornada,
				record_time: '08:00:00',
				employee_id: {
					id: 1,
					first_name: 'Ana',
					middle_name: null,
					last_name: 'Gómez',
					second_last_name: null,
				},
			}),
			// Employee 1 on day 2
			createMockTimeRecord({
				id: 2,
				record_date: '2026-10-15',
				log_type: LOG_TYPE.inicioJornada,
				record_time: '08:15:00',
				employee_id: {
					id: 1,
					first_name: 'Ana',
					middle_name: null,
					last_name: 'Gómez',
					second_last_name: null,
				},
			}),
			// Employee 2 on day 1
			createMockTimeRecord({
				id: 3,
				record_date: '2026-10-14',
				log_type: LOG_TYPE.inicioJornada,
				record_time: '09:00:00',
				employee_id: {
					id: 2,
					first_name: 'Carlos',
					middle_name: null,
					last_name: 'Ruiz',
					second_last_name: null,
				},
			}),
		];

		mockedFetchTimeRecords.mockResolvedValueOnce(records);

		const { result } = renderHookWithQuery(() =>
			useHistorial('2026-10-14', '2026-10-15', 10),
		);

		await waitFor(() => {
			expect(result.current.isSuccess).toBe(true);
		});

		expect(result.current.data).toHaveLength(3);
		const empleados = (result.current.data ?? []).map((r) => r.empleado);
		expect(empleados).toContain('Ana Gómez');
		expect(empleados).toContain('Carlos Ruiz');
	});

	it('should handle missing employee gracefully with "Sin nombre" and null documento', async () => {
		const recordWithoutEmployee = createMockTimeRecord({
			employee_id: null,
			store_id: 'Non-object-store',
		});

		mockedFetchTimeRecords.mockResolvedValueOnce([recordWithoutEmployee]);

		const { result } = renderHookWithQuery(() =>
			useHistorial('2026-10-14', '2026-10-14', 1),
		);

		await waitFor(() => {
			expect(result.current.isSuccess).toBe(true);
		});

		const row = result.current.data?.[0];
		expect(row?.empleado).toBe('Sin nombre');
		expect(row?.documento).toBeNull();
		expect(row?.tiendaNombre).toBe('—');
	});

	it('should handle API failure gracefully with isError true', async () => {
		mockedFetchTimeRecords.mockRejectedValueOnce(
			new Error('Network error loading Directus records'),
		);

		const { result } = renderHookWithQuery(() =>
			useHistorial('2026-10-14', '2026-10-14', 1),
		);

		await waitFor(() => {
			expect(result.current.isError).toBe(true);
		});

		expect(result.current.error?.message).toBe(
			'Network error loading Directus records',
		);
	});
});
