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
	it('extracts key and fetches record when payload is { key: 110513 }', async () => {
		const fetchedRecord: TimeRecords = {
			id: 110513,
			store_id: '1003',
			log_type: 'Comenzar Jornada',
			record_date: '2026-10-22',
			record_time: '08:00',
			employee_id: '1190',
		};

		const getTimeRecordByIdMock = vi.fn().mockResolvedValue(fetchedRecord);
		const createMock = vi.fn().mockResolvedValue({ id: 501 });
		const context = createMockContext({
			getTimeRecordById: getTimeRecordByIdMock,
			getTimeRecordStores: vi.fn().mockResolvedValue([]),
			createTimeRecordStore: createMock,
		});

		const result = await onTimeRecordCreatedHandler.run(
			{
				key: 110513,
			},
			context,
		);

		expect(getTimeRecordByIdMock).toHaveBeenCalledWith(
			110513,
			expect.any(Array),
		);
		expect(result.status).toBe('created');
		expect(result.storeId).toBe('1003');
		expect(result.openTime).toBe('2026-10-22T08:00:00.000Z');
	});

	it('creates new TimeRecordStore for Comenzar Jornada when none exists', async () => {
		const fetchedRecord: TimeRecords = {
			id: 88,
			store_id: '1003',
			log_type: 'Comenzar Jornada',
			record_date: '2026-10-22',
			record_time: '08:15',
			employee_id: '1190',
		};

		const createMock = vi.fn().mockResolvedValue({ id: 101 });
		const context = createMockContext({
			getTimeRecordById: vi.fn().mockResolvedValue(fetchedRecord),
			getTimeRecordStores: vi.fn().mockResolvedValue([]),
			createTimeRecordStore: createMock,
			updateTimeRecordStore: vi.fn(),
		});

		const result = await onTimeRecordCreatedHandler.run(
			{
				key: 88,
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

	it('updates existing TimeRecordStore when Comenzar Jornada is earlier', async () => {
		const fetchedRecord: TimeRecords = {
			id: 89,
			store_id: '1003',
			log_type: 'Comenzar Jornada',
			record_date: '2026-10-22',
			record_time: '08:00',
			employee_id: '1190',
		};

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
			getTimeRecordById: vi.fn().mockResolvedValue(fetchedRecord),
			getTimeRecordStores: vi.fn().mockResolvedValue([existingRecord]),
			createTimeRecordStore: vi.fn(),
			updateTimeRecordStore: updateMock,
		});

		const result = await onTimeRecordCreatedHandler.run(
			{
				key: 89,
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

	it('leaves existing TimeRecordStore unchanged when Comenzar Jornada is later', async () => {
		const fetchedRecord: TimeRecords = {
			id: 90,
			store_id: '1003',
			log_type: 'Comenzar Jornada',
			record_date: '2026-10-22',
			record_time: '08:30',
			employee_id: '1190',
		};

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
		const context = createMockContext({
			getTimeRecordById: vi.fn().mockResolvedValue(fetchedRecord),
			getTimeRecordStores: vi.fn().mockResolvedValue([existingRecord]),
			updateTimeRecordStore: updateMock,
		});

		const result = await onTimeRecordCreatedHandler.run(
			{
				key: 90,
			},
			context,
		);

		expect(result.status).toBe('unchanged');
		expect(updateMock).not.toHaveBeenCalled();
	});

	it('returns in_progress when Terminar Jornada arrives but other clocked-in employees have not finished yet', async () => {
		const currentRecord: TimeRecords = {
			id: 3,
			store_id: '1003',
			employee_id: '101',
			log_type: 'Terminar Jornada',
			record_date: '2026-10-22',
			record_time: '17:00',
		};

		const dailyRecords: TimeRecords[] = [
			{
				id: 1,
				store_id: '1003',
				employee_id: '101',
				log_type: 'Comenzar Jornada',
				record_date: '2026-10-22',
				record_time: '08:00',
			},
			{
				id: 2,
				store_id: '1003',
				employee_id: '102',
				log_type: 'Comenzar Jornada',
				record_date: '2026-10-22',
				record_time: '09:00',
			},
			currentRecord,
		];

		const updateMock = vi.fn();
		const context = createMockContext({
			getTimeRecordById: vi.fn().mockResolvedValue(currentRecord),
			getTimeRecords: vi.fn().mockResolvedValue(dailyRecords),
			updateTimeRecordStore: updateMock,
		});

		const result = await onTimeRecordCreatedHandler.run(
			{
				key: 3,
			},
			context,
		);

		expect(result.status).toBe('in_progress');
		expect(result.reason).toContain('102');
		expect(updateMock).not.toHaveBeenCalled();
	});

	it('updates close_time and operative_time when ALL employees who started have finished their shift', async () => {
		const currentRecord: TimeRecords = {
			id: 4,
			store_id: '1003',
			employee_id: '102',
			log_type: 'Terminar Jornada',
			record_date: '2026-10-22',
			record_time: '20:30',
		};

		const dailyRecords: TimeRecords[] = [
			{
				id: 1,
				store_id: '1003',
				employee_id: '101',
				log_type: 'Comenzar Jornada',
				record_date: '2026-10-22',
				record_time: '08:00',
			},
			{
				id: 2,
				store_id: '1003',
				employee_id: '102',
				log_type: 'Comenzar Jornada',
				record_date: '2026-10-22',
				record_time: '09:00',
			},
			{
				id: 3,
				store_id: '1003',
				employee_id: '101',
				log_type: 'Terminar Jornada',
				record_date: '2026-10-22',
				record_time: '17:00',
			},
			currentRecord,
		];

		const existingStoreRecord: TimeRecordStore = {
			id: 77,
			store: '1003',
			work_day: '2026-10-22',
			open_time: '2026-10-22T08:00:00.000Z',
			open_user: '101',
			close_time: null,
			closed_user: null,
			operative_time: null,
		};

		const updateMock = vi.fn().mockResolvedValue({ ...existingStoreRecord });
		const context = createMockContext({
			getTimeRecordById: vi.fn().mockResolvedValue(currentRecord),
			getTimeRecords: vi.fn().mockResolvedValue(dailyRecords),
			getTimeRecordStores: vi.fn().mockResolvedValue([existingStoreRecord]),
			updateTimeRecordStore: updateMock,
		});

		const result = await onTimeRecordCreatedHandler.run(
			{
				key: 4,
			},
			context,
		);

		expect(result.status).toBe('updated');
		expect(updateMock).toHaveBeenCalledWith(77, {
			close_time: '2026-10-22T20:30:00.000Z',
			close_user: '102',
			closed_user: '102',
			operative_time: 750,
		});
	});

	it('ignores time records that are neither Comenzar nor Terminar (e.g. Almuerzo)', async () => {
		const lunchRecord: TimeRecords = {
			id: 5,
			store_id: '1003',
			log_type: 'Iniciar Almuerzo',
			record_date: '2026-10-22',
			record_time: '13:00',
			employee_id: '101',
		};

		const context = createMockContext({
			getTimeRecordById: vi.fn().mockResolvedValue(lunchRecord),
		});

		const result = await onTimeRecordCreatedHandler.run(
			{
				key: 5,
			},
			context,
		);

		expect(result.status).toBe('ignored');
	});
});
