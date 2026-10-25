import { describe, expect, it, vi } from 'vitest';
import syncStoreCloseTimeRecordsHandler from '../../src/handlers/sync-store-close-time-records.ts';
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
		jobId: 'job_test_close_123',
		hookName: syncStoreCloseTimeRecordsHandler.name,
		directus: mockDirectus as DirectusService,
		logger: mockLogger,
		signal: new AbortController().signal,
		log: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
	};
}

describe('sync-store-close-time-records handler', () => {
	it('takes the most late "Terminar Jornada" punch when multiple exist and calculates operative time', async () => {
		const stores: Store[] = [{ id: 'store-1', name: 'Downtown Store' }];
		const timeRecords: TimeRecords[] = [
			{
				id: 101,
				store_id: 'store-1',
				employee_id: 'emp-early-start',
				log_type: 'Comenzar Jornada',
				record_time: '08:00',
				record_date: '2026-10-22',
			},
			{
				id: 102,
				store_id: 'store-1',
				employee_id: 'emp-mid-finish',
				log_type: 'Terminar Jornada',
				record_time: '17:00',
				record_date: '2026-10-22',
			},
			{
				id: 103,
				store_id: 'store-1',
				employee_id: 'emp-late-finish',
				log_type: 'Terminar Jornada',
				record_time: '20:30',
				record_date: '2026-10-22',
			},
		];

		const createTimeRecordStoreMock = vi.fn().mockResolvedValue({
			id: 501,
			store: 'store-1',
			work_date: '2026-10-22',
			open_time: '2026-10-22T13:00:00.000Z',
			close_time: '2026-10-23T01:30:00.000Z',
			close_user: 'emp-late-finish',
			operative_time: 750, // 12 hours 30 min = 750 min
		});

		const context = createMockContext({
			getStores: vi.fn().mockResolvedValue(stores),
			getTimeRecords: vi.fn().mockResolvedValue(timeRecords),
			getTimeRecordStores: vi.fn().mockResolvedValue([]),
			createTimeRecordStore: createTimeRecordStoreMock,
			updateTimeRecordStore: vi.fn(),
		});

		const result = await syncStoreCloseTimeRecordsHandler.run(
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
				open_time: '2026-10-22T13:00:00.000Z',
				close_time: '2026-10-23T01:30:00.000Z',
				close_user: 'emp-late-finish',
				operative_time: 750,
			}),
		);
	});

	it('updates existing TimeRecordStore with latest closing time and recalculates operative time', async () => {
		const stores: Store[] = [{ id: 'store-1', name: 'Downtown Store' }];
		const timeRecords: TimeRecords[] = [
			{
				id: 201,
				store_id: 'store-1',
				employee_id: 'emp-late',
				log_type: 'Terminar Jornada',
				record_time: '21:00',
				record_date: '2026-10-22',
			},
		];

		const existingStoreRecord: TimeRecordStore = {
			id: 777,
			store: 'store-1',
			work_date: '2026-10-22',
			open_time: '2026-10-22T14:00:00.000Z',
			open_user: 'emp-opener',
			close_time: '2026-10-22T23:00:00.000Z', // older closing
			close_user: 'emp-opener',
			operative_time: 540,
		};

		const updateTimeRecordStoreMock = vi.fn().mockResolvedValue({
			...existingStoreRecord,
			close_time: '2026-10-23T02:00:00.000Z',
			close_user: 'emp-late',
			operative_time: 720, // 12 hours = 720 min
		});

		const context = createMockContext({
			getStores: vi.fn().mockResolvedValue(stores),
			getTimeRecords: vi.fn().mockResolvedValue(timeRecords),
			getTimeRecordStores: vi.fn().mockResolvedValue([existingStoreRecord]),
			createTimeRecordStore: vi.fn(),
			updateTimeRecordStore: updateTimeRecordStoreMock,
		});

		const result = await syncStoreCloseTimeRecordsHandler.run(
			{ date: '2026-10-22' },
			context,
		);

		expect(result.created).toBe(0);
		expect(result.updated).toBe(1);
		expect(result.unchanged).toBe(0);
		expect(updateTimeRecordStoreMock).toHaveBeenCalledWith(777, {
			close_time: '2026-10-23T02:00:00.000Z',
			close_user: 'emp-late',
			operative_time: 720,
		});
	});

	it('leaves existing TimeRecordStore unchanged if close_time already matches the latest', async () => {
		const stores: Store[] = [{ id: 'store-1', name: 'Downtown Store' }];
		const timeRecords: TimeRecords[] = [
			{
				id: 301,
				store_id: 'store-1',
				employee_id: 'emp-closing',
				log_type: 'Terminar Jornada',
				record_time: '20:00',
				record_date: '2026-10-22',
			},
		];

		const existingStoreRecord: TimeRecordStore = {
			id: 888,
			store: 'store-1',
			work_date: '2026-10-22',
			open_time: '2026-10-22T13:00:00.000Z',
			open_user: 'emp-opener',
			close_time: '2026-10-23T01:00:00.000Z',
			close_user: 'emp-closing',
			operative_time: 720,
		};

		const updateMock = vi.fn();
		const context = createMockContext({
			getStores: vi.fn().mockResolvedValue(stores),
			getTimeRecords: vi.fn().mockResolvedValue(timeRecords),
			getTimeRecordStores: vi.fn().mockResolvedValue([existingStoreRecord]),
			createTimeRecordStore: vi.fn(),
			updateTimeRecordStore: updateMock,
		});

		const result = await syncStoreCloseTimeRecordsHandler.run(
			{ date: '2026-10-22' },
			context,
		);

		expect(result.created).toBe(0);
		expect(result.updated).toBe(0);
		expect(result.unchanged).toBe(1);
		expect(updateMock).not.toHaveBeenCalled();
	});

	it('leaves existing record unchanged when store has no closing records', async () => {
		const stores: Store[] = [{ id: 'store-1', name: 'Downtown Store' }];
		const timeRecords: TimeRecords[] = [
			{
				id: 401,
				store_id: 'store-1',
				employee_id: 'emp-start',
				log_type: 'Comenzar Jornada',
				record_time: '08:00',
				record_date: '2026-10-22',
			},
		];

		const existingStoreRecord: TimeRecordStore = {
			id: 999,
			store: 'store-1',
			work_date: '2026-10-22',
			open_time: '2026-10-22T13:00:00.000Z', // 08:00
			open_user: 'emp-start',
			close_time: null,
			close_user: null,
			operative_time: null,
		};

		const updateMock = vi.fn();
		const context = createMockContext({
			getStores: vi.fn().mockResolvedValue(stores),
			getTimeRecords: vi.fn().mockResolvedValue(timeRecords),
			getTimeRecordStores: vi.fn().mockResolvedValue([existingStoreRecord]),
			createTimeRecordStore: vi.fn(),
			updateTimeRecordStore: updateMock,
		});

		const result = await syncStoreCloseTimeRecordsHandler.run(
			{ date: '2026-10-22' },
			context,
		);

		expect(result.unchanged).toBe(1);
		expect(result.details[0]?.hasClosingRecords).toBe(false);
		expect(updateMock).not.toHaveBeenCalled();
	});

	it('filters by single store when payload.store_id is provided', async () => {
		const stores: Store[] = [{ id: 'store-99', name: 'Filtered Store' }];
		const getStoresMock = vi.fn().mockResolvedValue(stores);
		const getTimeRecordsMock = vi.fn().mockResolvedValue([]);
		const getTimeRecordStoresMock = vi.fn().mockResolvedValue([]);

		const context = createMockContext({
			getStores: getStoresMock,
			getTimeRecords: getTimeRecordsMock,
			getTimeRecordStores: getTimeRecordStoresMock,
			createTimeRecordStore: vi.fn().mockResolvedValue({ id: 100 }),
		});

		await syncStoreCloseTimeRecordsHandler.run(
			{ store_id: 'store-99', date: '2026-10-22' },
			context,
		);

		expect(getStoresMock).toHaveBeenCalledWith({
			filter: { id: { _eq: 'store-99' } },
		});
		expect(getTimeRecordsMock).toHaveBeenCalledWith(
			expect.objectContaining({
				filter: expect.objectContaining({
					record_date: { _eq: '2026-10-22' },
					_or: [
						{ store_id: { _eq: 'store-99' } },
						{ store_id: { id: { _eq: 'store-99' } } },
					],
				}),
			}),
		);
	});
});
