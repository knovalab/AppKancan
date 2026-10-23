import { describe, expect, it, vi } from 'vitest';
import { handleComenzarJornada } from '../src/handlers/time-records/comenzar-jornada.ts';
import { handleTerminarJornada } from '../src/handlers/time-records/terminar-jornada.ts';
import type {
	DirectusService,
	TimeRecordStore,
	TimeRecords,
	WorkerContext,
	WorkerLogger,
} from '../src/types/index.ts';

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
		jobId: 'test-job',
		hookName: 'test-hook',
		directus: mockDirectus as DirectusService,
		logger: mockLogger,
		signal: new AbortController().signal,
		log: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
	};
}

describe('Time Records Business Logic', () => {
	describe('handleComenzarJornada', () => {
		it('creates new TimeRecordStore if none exists for the workday', async () => {
			const createMock = vi.fn().mockResolvedValue({ id: 99 });
			const context = createMockContext({
				getTimeRecordStores: vi.fn().mockResolvedValue([]),
				createTimeRecordStore: createMock,
			});

			const result = await handleComenzarJornada(
				{
					store_id: 'store-1',
					record_date: '2026-10-22',
					record_time: '08:00',
					employee_id: 'emp-1',
				},
				context,
			);

			expect(result.action).toBe('created');
			expect(result.timeRecordStoreId).toBe(99);
			expect(createMock).toHaveBeenCalledWith(
				expect.objectContaining({
					store: 'store-1',
					work_date: '2026-10-22',
					open_user: 'emp-1',
				}),
			);
		});

		it('updates TimeRecordStore when incoming record has earlier opening time', async () => {
			const existing: TimeRecordStore = {
				id: 50,
				store: 'store-1',
				work_date: '2026-10-22',
				open_time: '2026-10-22T09:00:00.000Z', // 09:00
				open_user: 'emp-2',
				close_time: null,
				close_user: null,
				operative_time: null,
			};

			const updateMock = vi.fn().mockResolvedValue({ id: 50 });
			const context = createMockContext({
				getTimeRecordStores: vi.fn().mockResolvedValue([existing]),
				updateTimeRecordStore: updateMock,
			});

			// Earlier punch: 08:00
			const result = await handleComenzarJornada(
				{
					store_id: 'store-1',
					record_date: '2026-10-22',
					record_time: '08:00',
					employee_id: 'emp-1',
				},
				context,
			);

			expect(result.action).toBe('updated');
			expect(updateMock).toHaveBeenCalledWith(
				50,
				expect.objectContaining({
					open_user: 'emp-1',
				}),
			);
		});

		it('leaves TimeRecordStore unchanged if existing open time is already earlier', async () => {
			const existing: TimeRecordStore = {
				id: 50,
				store: 'store-1',
				work_date: '2026-10-22',
				open_time: '2026-10-22T07:00:00.000Z', // 07:00
				open_user: 'emp-1',
				close_time: null,
				close_user: null,
				operative_time: null,
			};

			const updateMock = vi.fn();
			const context = createMockContext({
				getTimeRecordStores: vi.fn().mockResolvedValue([existing]),
				updateTimeRecordStore: updateMock,
			});

			const result = await handleComenzarJornada(
				{
					store_id: 'store-1',
					record_date: '2026-10-22',
					record_time: '08:30',
					employee_id: 'emp-2',
				},
				context,
			);

			expect(result.action).toBe('unchanged');
			expect(updateMock).not.toHaveBeenCalled();
		});
	});

	describe('handleTerminarJornada', () => {
		it('returns in_progress when some clocked-in employees have not finished yet', async () => {
			const dailyRecords: TimeRecords[] = [
				{
					id: 1,
					store_id: 'store-1',
					employee_id: 'emp-1',
					log_type: 'Comenzar Jornada',
					record_date: '2026-10-22',
					record_time: '08:00',
				},
				{
					id: 2,
					store_id: 'store-1',
					employee_id: 'emp-2',
					log_type: 'Comenzar Jornada',
					record_date: '2026-10-22',
					record_time: '08:15',
				},
				{
					id: 3,
					store_id: 'store-1',
					employee_id: 'emp-1',
					log_type: 'Terminar Jornada',
					record_date: '2026-10-22',
					record_time: '17:00',
				},
			];

			const context = createMockContext({
				getTimeRecords: vi.fn().mockResolvedValue(dailyRecords),
			});

			const result = await handleTerminarJornada(
				{
					id: 3,
					store_id: 'store-1',
					employee_id: 'emp-1',
					log_type: 'Terminar Jornada',
					record_date: '2026-10-22',
					record_time: '17:00',
				},
				context,
			);

			expect(result.action).toBe('in_progress');
			expect(result.reason).toContain('Waiting for 1 employee');
			expect(result.reason).toContain('emp-2');
		});

		it('finalizes closing and calculates operative time when all employees finished', async () => {
			const dailyRecords: TimeRecords[] = [
				{
					id: 1,
					store_id: 'store-1',
					employee_id: 'emp-1',
					log_type: 'Comenzar Jornada',
					record_date: '2026-10-22',
					record_time: '08:00',
				},
				{
					id: 2,
					store_id: 'store-1',
					employee_id: 'emp-1',
					log_type: 'Terminar Jornada',
					record_date: '2026-10-22',
					record_time: '17:00',
				},
			];

			const existingStoreRecord: TimeRecordStore = {
				id: 88,
				store: 'store-1',
				work_date: '2026-10-22',
				open_time: '2026-10-22T08:00:00.000Z', // 08:00
				open_user: 'emp-1',
				close_time: null,
				close_user: null,
				operative_time: null,
			};

			const updateMock = vi.fn().mockResolvedValue({ id: 88 });
			const context = createMockContext({
				getTimeRecords: vi.fn().mockResolvedValue(dailyRecords),
				getTimeRecordStores: vi.fn().mockResolvedValue([existingStoreRecord]),
				updateTimeRecordStore: updateMock,
			});

			const result = await handleTerminarJornada(
				{
					id: 2,
					store_id: 'store-1',
					employee_id: 'emp-1',
					log_type: 'Terminar Jornada',
					record_date: '2026-10-22',
					record_time: '17:00',
				},
				context,
			);

			expect(result.action).toBe('updated');
			expect(updateMock).toHaveBeenCalledWith(
				88,
				expect.objectContaining({
					close_user: 'emp-1',
					operative_time: 540, // 9 hours = 540 minutes
				}),
			);
		});
	});
});
