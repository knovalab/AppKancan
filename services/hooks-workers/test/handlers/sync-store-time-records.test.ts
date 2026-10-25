import { describe, expect, it, vi } from 'vitest';
import syncStoreTimeRecordsHandler from '../../src/handlers/sync-store-time-records.ts';
import type {
	DirectusService,
	Store,
	TimeRecordStore,
	TimeRecords,
	WorkerContext,
	WorkerLogger,
} from '../../src/types/index.ts';

function createMockContext(
	mockDirectus: Partial<DirectusService>,
): WorkerContext {
	const mockLogger: WorkerLogger = {
		debug: vi.fn(),
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
	};

	return {
		jobId: 'job_test_123',
		hookName: syncStoreTimeRecordsHandler.name,
		directus: mockDirectus as DirectusService,
		logger: mockLogger,
		log: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
	};
}

describe('sync-store-time-records handler', () => {
	it('creates new TimeRecordStore with earliest "Comenzar Jornada" ISO timestamp when no record exists', async () => {
		const stores: Store[] = [{ id: 'store-1', name: 'Downtown Store' }];
		const timeRecords: TimeRecords[] = [
			{
				id: 101,
				store_id: 'store-1',
				employee_id: 'emp-later',
				log_type: 'Comenzar Jornada',
				record_time: '09:30',
				record_date: '2026-10-22',
			},
			{
				id: 102,
				store_id: 'store-1',
				employee_id: 'emp-earliest',
				log_type: 'Comenzar Jornada',
				record_time: '08:15',
				record_date: '2026-10-22',
			},
			{
				id: 103,
				store_id: 'store-1',
				employee_id: 'emp-earliest',
				log_type: 'Iniciar Almuerzo',
				record_time: '13:00',
				record_date: '2026-10-22',
			},
		];

		const createTimeRecordStoreMock = vi.fn().mockResolvedValue({
			id: 501,
			store: 'store-1',
			work_date: '2026-10-22',
			open_time: '2026-10-22T13:15:00.000Z',
			open_user: 'emp-earliest',
		});

		const context = createMockContext({
			getStores: vi.fn().mockResolvedValue(stores),
			getTimeRecords: vi.fn().mockResolvedValue(timeRecords),
			getTimeRecordStores: vi.fn().mockResolvedValue([]),
			createTimeRecordStore: createTimeRecordStoreMock,
			updateTimeRecordStore: vi.fn(),
		});

		const result = await syncStoreTimeRecordsHandler.run(
			{ date: '2026-10-22' },
			context,
		);

		expect(result.created).toBe(1);
		expect(result.updated).toBe(0);
		expect(result.unchanged).toBe(0);
		expect(createTimeRecordStoreMock).toHaveBeenCalledWith(
			expect.objectContaining({
				store: 'store-1',
				work_date: '2026-10-22',
				open_time: '2026-10-22T13:15:00.000Z',
				open_user: 'emp-earliest',
				close_time: null,
			}),
		);
	});

	it('updates existing TimeRecordStore with ISO timestamp when a secure match exists with different open_time', async () => {
		const stores: Store[] = [{ id: 'store-2', name: 'Mall Store' }];
		const timeRecords: TimeRecords[] = [
			{
				id: 201,
				store_id: 'store-2',
				employee_id: 'emp-opener',
				log_type: 'Comenzar Jornada',
				record_time: '07:45',
				record_date: '2026-10-22',
			},
		];

		const existingStoreRecord: TimeRecordStore = {
			id: 777,
			store: 'store-2',
			work_date: '2026-10-22',
			open_time: null,
			open_user: null,
			close_time: null,
			close_user: null,
			operative_time: null,
		};

		const updateTimeRecordStoreMock = vi.fn().mockResolvedValue({
			...existingStoreRecord,
			open_time: '2026-10-22T12:45:00.000Z',
			open_user: 'emp-opener',
		});

		const context = createMockContext({
			getStores: vi.fn().mockResolvedValue(stores),
			getTimeRecords: vi.fn().mockResolvedValue(timeRecords),
			getTimeRecordStores: vi.fn().mockResolvedValue([existingStoreRecord]),
			createTimeRecordStore: vi.fn(),
			updateTimeRecordStore: updateTimeRecordStoreMock,
		});

		const result = await syncStoreTimeRecordsHandler.run(
			{ date: '2026-10-22' },
			context,
		);

		expect(result.created).toBe(0);
		expect(result.updated).toBe(1);
		expect(updateTimeRecordStoreMock).toHaveBeenCalledWith(777, {
			open_time: '2026-10-22T12:45:00.000Z',
			open_user: 'emp-opener',
		});
	});

	it('creates empty TimeRecordStore with null open and close times when store has no time records', async () => {
		const stores: Store[] = [{ id: 'store-empty', name: 'Unopened Store' }];
		const createTimeRecordStoreMock = vi.fn().mockResolvedValue({
			id: 888,
			store: 'store-empty',
			work_date: '2026-10-22',
			open_time: null,
			open_user: null,
			close_time: null,
		});

		const context = createMockContext({
			getStores: vi.fn().mockResolvedValue(stores),
			getTimeRecords: vi.fn().mockResolvedValue([]),
			getTimeRecordStores: vi.fn().mockResolvedValue([]),
			createTimeRecordStore: createTimeRecordStoreMock,
			updateTimeRecordStore: vi.fn(),
		});

		const result = await syncStoreTimeRecordsHandler.run(
			{ date: '2026-10-22' },
			context,
		);

		expect(result.created).toBe(1);
		expect(result.updated).toBe(0);
		expect(result.details[0].openTime).toBeNull();
		expect(result.details[0].hasTimeRecords).toBe(false);
		expect(createTimeRecordStoreMock).toHaveBeenCalledWith(
			expect.objectContaining({
				store: 'store-empty',
				work_date: '2026-10-22',
				open_time: null,
				close_time: null,
				open_user: null,
			}),
		);
	});

	it('keeps existing TimeRecordStore unchanged when store has no new time records and already exists', async () => {
		const stores: Store[] = [{ id: 'store-existing', name: 'Existing Store' }];
		const existingStoreRecord: TimeRecordStore = {
			id: 999,
			store: 'store-existing',
			work_date: '2026-10-22',
			open_time: null,
			open_user: null,
			close_time: null,
			close_user: null,
			operative_time: null,
		};

		const createMock = vi.fn();
		const updateMock = vi.fn();

		const context = createMockContext({
			getStores: vi.fn().mockResolvedValue(stores),
			getTimeRecords: vi.fn().mockResolvedValue([]),
			getTimeRecordStores: vi.fn().mockResolvedValue([existingStoreRecord]),
			createTimeRecordStore: createMock,
			updateTimeRecordStore: updateMock,
		});

		const result = await syncStoreTimeRecordsHandler.run(
			{ date: '2026-10-22' },
			context,
		);

		expect(result.created).toBe(0);
		expect(result.updated).toBe(0);
		expect(result.unchanged).toBe(1);
		expect(createMock).not.toHaveBeenCalled();
		expect(updateMock).not.toHaveBeenCalled();
	});

	it('filters by single store when payload.store_id is provided', async () => {
		const getStoresMock = vi
			.fn()
			.mockResolvedValue([{ id: 'store-specific', name: 'Target' }]);
		const context = createMockContext({
			getStores: getStoresMock,
			getTimeRecords: vi.fn().mockResolvedValue([]),
			getTimeRecordStores: vi.fn().mockResolvedValue([]),
			createTimeRecordStore: vi.fn().mockResolvedValue({ id: 100 }),
		});

		await syncStoreTimeRecordsHandler.run(
			{ date: '2026-10-22', store_id: 'store-specific' },
			context,
		);

		expect(getStoresMock).toHaveBeenCalledWith({
			filter: { id: { _eq: 'store-specific' } },
		});
	});
});
