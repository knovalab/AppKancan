import { describe, expect, it, vi } from 'vitest';
import onTimeRecordUpdatedHandler from '../../src/handlers/on-time-record-updated.ts';
import type {
	DirectusService,
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
		jobId: 'job_test_update_123',
		hookName: onTimeRecordUpdatedHandler.name,
		directus: mockDirectus as DirectusService,
		logger: mockLogger,
		log: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
	};
}

describe('on-time-record-updated handler', () => {
	it('extracts first key when payload is { keys: [110513] }', async () => {
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

		const result = await onTimeRecordUpdatedHandler.run(
			{
				keys: [110513],
			},
			context,
		);

		expect(getTimeRecordByIdMock).toHaveBeenCalledWith(110513, {
			fields: expect.any(Array),
		});
		expect(result.status).toBe('created');
		expect(result.storeId).toBe('1003');
		expect(result.openTime).toBe('2026-10-22T08:00:00.000Z');
	});

	it('extracts the first key when "keys" is an array with multiple elements', async () => {
		const fetchedRecord: TimeRecords = {
			id: 142,
			store_id: '1003',
			log_type: 'Comenzar Jornada',
			record_date: '2026-10-22',
			record_time: '07:45',
			employee_id: '1190',
		};

		const getTimeRecordByIdMock = vi.fn().mockResolvedValue(fetchedRecord);
		const createMock = vi.fn().mockResolvedValue({ id: 501 });
		const context = createMockContext({
			getTimeRecordById: getTimeRecordByIdMock,
			getTimeRecordStores: vi.fn().mockResolvedValue([]),
			createTimeRecordStore: createMock,
		});

		const result = await onTimeRecordUpdatedHandler.run(
			{
				keys: [142, 143, 144],
			},
			context,
		);

		expect(getTimeRecordByIdMock).toHaveBeenCalledWith(142, {
			fields: expect.any(Array),
		});
		expect(result.status).toBe('created');
		expect(result.storeId).toBe('1003');
	});
});
