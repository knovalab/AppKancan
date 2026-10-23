import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import dayjs from 'dayjs';
import type React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as directusRead from '../../api/directus/read';
import { LOG_TYPE } from '../../domain/registro';
import { useMonitoreoFotos } from '../../hooks/useMonitoreoFotos';
import type { TimeRecordDto } from '../../interfaces/api/timeRecords';
import type { Tienda } from '../../interfaces/tiendas';

vi.mock('../../api/directus/read', () => ({
	fetchTimeRecords: vi.fn(),
}));

const mockTiendas: Tienda[] = [
	{ id: 1, name: 'Tienda Norte' },
	{ id: 2, name: 'Tienda Sur' },
];

function createWrapper() {
	const queryClient = new QueryClient({
		defaultOptions: {
			queries: { retry: false },
		},
	});
	return ({ children }: { children: React.ReactNode }) => (
		<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
	);
}

describe('useMonitoreoFotos', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('hierarchically groups records with photos into stores, dates, and non-empty log types', async () => {
		vi.mocked(directusRead.fetchTimeRecords).mockResolvedValue([
			// Tienda 1, Date 2026-10-17, Inicio Jornada
			{
				id: 101,
				store_id: 1,
				record_date: '2026-10-17',
				record_time: '08:00:00',
				log_type: LOG_TYPE.inicioJornada,
				photo: 'uuid-photo-1',
				employee_id: {
					first_name: 'Carlos',
					last_name: 'Pérez',
					document_number: '12345',
				},
			},
			// Tienda 1, Date 2026-10-17, Fin Jornada
			{
				id: 102,
				store_id: 1,
				record_date: '2026-10-17',
				record_time: '17:00:00',
				log_type: LOG_TYPE.finJornada,
				photo: 'uuid-photo-2',
				employee_id: {
					first_name: 'Carlos',
					last_name: 'Pérez',
					document_number: '12345',
				},
			},
			// Tienda 1, Date 2026-10-16, Inicio Jornada
			{
				id: 103,
				store_id: 1,
				record_date: '2026-10-16',
				record_time: '08:05:00',
				log_type: LOG_TYPE.inicioJornada,
				photo: 'uuid-photo-3',
				employee_id: {
					first_name: 'Carlos',
					last_name: 'Pérez',
					document_number: '12345',
				},
			},
			// Tienda 2, Date 2026-10-17, Iniciar Almuerzo
			{
				id: 201,
				store_id: 2,
				record_date: '2026-10-17',
				record_time: '13:00:00',
				log_type: LOG_TYPE.inicioAlmuerzo,
				photo: 'uuid-photo-4',
				employee_id: {
					first_name: 'Ana',
					last_name: 'Gómez',
					document_number: '67890',
				},
			},
			// Record WITHOUT photo - must be omitted completely
			{
				id: 202,
				store_id: 2,
				record_date: '2026-10-17',
				record_time: '14:00:00',
				log_type: LOG_TYPE.finAlmuerzo,
				photo: null,
				employee_id: {
					first_name: 'Ana',
					last_name: 'Gómez',
					document_number: '67890',
				},
			},
		] as unknown as TimeRecordDto[]);

		const { result } = renderHook(
			() =>
				useMonitoreoFotos({
					tiendas: mockTiendas,
					initialFechaInicio: dayjs('2026-10-16'),
					initialFechaFin: dayjs('2026-10-17'),
				}),
			{ wrapper: createWrapper() },
		);

		await waitFor(() => {
			expect(result.current.loading).toBe(false);
		});

		expect(result.current.totalPhotos).toBe(4);
		expect(result.current.storeGroups).toHaveLength(2);

		// Store 1: Tienda Norte
		const store1 = result.current.storeGroups.find((s) => s.storeId === 1);
		expect(store1).toBeDefined();
		expect(store1?.storeName).toBe('Tienda Norte');
		expect(store1?.totalPhotos).toBe(3);
		expect(store1?.dates).toHaveLength(2);

		// Dates are sorted descending: 2026-10-17 first, then 2026-10-16
		expect(store1?.dates[0].date).toBe('2026-10-17');
		expect(store1?.dates[0].totalPhotos).toBe(2);
		expect(store1?.dates[0].sections).toHaveLength(2);
		expect(store1?.dates[0].sections[0].logType).toBe(LOG_TYPE.inicioJornada);
		expect(store1?.dates[0].sections[1].logType).toBe(LOG_TYPE.finJornada);

		expect(store1?.dates[1].date).toBe('2026-10-16');
		expect(store1?.dates[1].totalPhotos).toBe(1);
		expect(store1?.dates[1].sections).toHaveLength(1);

		// Store 2: Tienda Sur
		const store2 = result.current.storeGroups.find((s) => s.storeId === 2);
		expect(store2).toBeDefined();
		expect(store2?.storeName).toBe('Tienda Sur');
		expect(store2?.totalPhotos).toBe(1);
		expect(store2?.dates).toHaveLength(1);
		expect(store2?.dates[0].sections[0].logType).toBe(LOG_TYPE.inicioAlmuerzo);
	});

	it('filters photos locally by employee name and document number', async () => {
		vi.mocked(directusRead.fetchTimeRecords).mockResolvedValue([
			{
				id: 1,
				store_id: 1,
				record_date: '2026-10-17',
				record_time: '08:00:00',
				log_type: LOG_TYPE.inicioJornada,
				photo: 'uuid-1',
				employee_id: {
					first_name: 'Juan',
					last_name: 'Pérez',
					document_number: '112233',
				},
			},
			{
				id: 2,
				store_id: 1,
				record_date: '2026-10-17',
				record_time: '08:30:00',
				log_type: LOG_TYPE.inicioJornada,
				photo: 'uuid-2',
				employee_id: {
					first_name: 'María',
					last_name: 'López',
					document_number: '998877',
				},
			},
		] as unknown as TimeRecordDto[]);

		const { result } = renderHook(
			() =>
				useMonitoreoFotos({
					tiendas: mockTiendas,
				}),
			{ wrapper: createWrapper() },
		);

		await waitFor(() => {
			expect(result.current.loading).toBe(false);
		});

		expect(result.current.totalPhotos).toBe(2);

		// Search by document number
		act(() => {
			result.current.setSearchEmpleado('998877');
		});

		expect(result.current.totalPhotos).toBe(1);
		expect(
			result.current.storeGroups[0].dates[0].sections[0].records[0].id,
		).toBe(2);

		// Search with no matches
		act(() => {
			result.current.setSearchEmpleado('inexistente');
		});

		expect(result.current.totalPhotos).toBe(0);
		expect(result.current.storeGroups).toHaveLength(0);
	});
});
