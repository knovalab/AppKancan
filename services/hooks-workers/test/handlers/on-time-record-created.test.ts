import { describe, expect, it, vi } from 'vitest';
import onTimeRecordCreatedHandler from '../../src/handlers/on-time-record-created.ts';
import type {
	DirectusService,
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
		jobId: 'job_test_event_123',
		hookName: onTimeRecordCreatedHandler.name,
		directus: mockDirectus as DirectusService,
		logger: mockLogger,
		log: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
	};
}

describe('on-time-record-created handler', () => {
	it('creates new TimeRecordStore when none exists for the store and day', async () => {
		const createMock = vi.fn().mockResolvedValue({ id: 101 });
		const context = createMockContext({
			getTimeRecordStores: vi.fn().mockResolvedValue([]),
			createTimeRecordStore: createMock,
			updateTimeRecordStore: vi.fn(),
		});

		const result = await onTimeRecordCreatedHandler.run(
			{
				store_id: '1003',
				log_type: 'Comenzar Jornada',
				record_date: '2026-10-22',
				record_time: '08:15',
				employee_id: 1190,
			},
			context,
		);

		expect(result.status).toBe('created');
		expect(result.storeId).toBe('1003');
		expect(result.openTime).toBe('2026-10-22T08:15:00.000Z');
		expect(createMock).toHaveBeenCalledWith(
			expect.objectContaining({
				store: '1003',
				work_day: '2026-10-22',
				open_time: '2026-10-22T08:15:00.000Z',
				open_user: '1190',
			}),
		);
	});

	it('updates existing TimeRecordStore when incoming record has an earlier opening time', async () => {
		const existingRecord: TimeRecordStore = {
			id: 55,
			store: '1003',
			work_day: '2026-10-22',
			open_time: '2026-10-22T09:00:00.000Z',
			open_user: '1100',
			close_time: null,
			closed_user: null,
			operative_time: null,
		};

		const updateMock = vi.fn().mockResolvedValue({ ...existingRecord });
		const context = createMockContext({
			getTimeRecordStores: vi.fn().mockResolvedValue([existingRecord]),
			createTimeRecordStore: vi.fn(),
			updateTimeRecordStore: updateMock,
		});

		const result = await onTimeRecordCreatedHandler.run(
			{
				store_id: '1003',
				log_type: 'Comenzar Jornada',
				record_date: '2026-10-22',
				record_time: '08:00',
				employee_id: 1190,
			},
			context,
		);

		expect(result.status).toBe('updated');
		expect(result.openTime).toBe('2026-10-22T08:00:00.000Z');
		expect(updateMock).toHaveBeenCalledWith(55, {
			open_time: '2026-10-22T08:00:00.000Z',
			open_user: '1190',
		});
	});

	it('leaves existing TimeRecordStore unchanged when incoming record is later than existing open_time', async () => {
		const existingRecord: TimeRecordStore = {
			id: 55,
			store: '1003',
			work_day: '2026-10-22',
			open_time: '2026-10-22T07:45:00.000Z',
			open_user: '1100',
			close_time: null,
			closed_user: null,
			operative_time: null,
		};

		const updateMock = vi.fn();
		const createMock = vi.fn();
		const context = createMockContext({
			getTimeRecordStores: vi.fn().mockResolvedValue([existingRecord]),
			createTimeRecordStore: createMock,
			updateTimeRecordStore: updateMock,
		});

		const result = await onTimeRecordCreatedHandler.run(
			{
				store_id: '1003',
				log_type: 'Comenzar Jornada',
				record_date: '2026-10-22',
				record_time: '08:30',
				employee_id: 1190,
			},
			context,
		);

		expect(result.status).toBe('unchanged');
		expect(result.openTime).toBe('2026-10-22T07:45:00.000Z');
		expect(updateMock).not.toHaveBeenCalled();
		expect(createMock).not.toHaveBeenCalled();
	});

	it('ignores time records that are not "Comenzar Jornada"', async () => {
		const context = createMockContext({});

		const result = await onTimeRecordCreatedHandler.run(
			{
				store_id: '1003',
				log_type: 'Terminar Jornada',
				record_date: '2026-10-22',
				record_time: '18:00',
			},
			context,
		);

		expect(result.status).toBe('ignored');
	});

	it('fetches record by key if only key is provided in webhook event', async () => {
		const fetchedRecord: TimeRecords = {
			id: 88,
			store_id: '1013',
			log_type: 'Comenzar Jornada',
			record_date: '2026-10-22',
			record_time: '07:30',
			employee_id: 'emp-1',
		};

		const createMock = vi.fn().mockResolvedValue({ id: 99 });
		const context = createMockContext({
			getTimeRecords: vi.fn().mockResolvedValue([fetchedRecord]),
			getTimeRecordStores: vi.fn().mockResolvedValue([]),
			createTimeRecordStore: createMock,
		});

		const result = await onTimeRecordCreatedHandler.run(
			{
				event: {
					collection: 'com_time_records',
					key: 88,
				},
			},
			context,
		);

		expect(result.status).toBe('created');
		expect(result.storeId).toBe('1013');
		expect(result.openTime).toBe('2026-10-22T07:30:00.000Z');
	});
});
