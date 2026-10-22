import type { TimeRecords, WorkerContext } from '../../types/index.ts';
import type { HandleTimeRecordResult } from './comenzar-jornada.ts';
import { buildTimestamp, extractStoreId, getTodayDateStr } from './utils.ts';

/**
 * Sub-handler for "Terminar Jornada" / "Finalizar Jornada" time logs.
 * Evaluates whether all employees who started ("Comenzar Jornada") have finished their shift.
 * If all have finished, records the latest closing time on the store's TimeRecordStore
 * and calculates the operative time.
 */
export async function handleTerminarJornada(
	record: Partial<TimeRecords> & { [key: string]: unknown },
	context: WorkerContext,
): Promise<HandleTimeRecordResult> {
	const { directus, logger } = context;

	const storeId = extractStoreId(record.store_id);

	if (!storeId) {
		logger.warn(
			{ record },
			'[Terminar Jornada] Missing store_id in time record',
		);
		return {
			action: 'ignored',
			reason: 'Missing store_id in time record',
		};
	}

	const workDay = record.record_date || getTodayDateStr();

	logger.info(
		{ storeId, workDay, recordId: record.id, employeeId: record.employee_id },
		'[Terminar Jornada] Checking if all clocked-in employees have finished their shift',
	);

	// 1. Fetch all time records for this store on this date
	const dailyRecords = await directus.getTimeRecords({
		filter: {
			_and: [
				{
					_or: [
						{ store_id: { _eq: storeId } },
						{ store_id: { id: { _eq: storeId } } },
					],
				},
				{ record_date: { _eq: workDay } },
			],
		},
	});

	// 2. Separate start and finish logs
	const startLogs = (dailyRecords || []).filter((r) => {
		const type = String(r.log_type || '')
			.toLowerCase()
			.trim();
		return type === 'comenzar jornada' || type === 'iniciar jornada';
	});

	const finishLogs = (dailyRecords || []).filter((r) => {
		const type = String(r.log_type || '')
			.toLowerCase()
			.trim();
		return type === 'terminar jornada' || type === 'finalizar jornada';
	});

	const startedEmployees = new Set(
		startLogs
			.map((r) => r.employee_id)
			.filter(
				(id): id is NonNullable<typeof id> => id !== null && id !== undefined,
			)
			.map(String),
	);

	const finishedEmployees = new Set(
		finishLogs
			.map((r) => r.employee_id)
			.filter(
				(id): id is NonNullable<typeof id> => id !== null && id !== undefined,
			)
			.map(String),
	);

	// Find employees who clocked in but haven't clocked out yet
	const pendingEmployees = Array.from(startedEmployees).filter(
		(empId) => !finishedEmployees.has(empId),
	);

	// 3. Determine if all employees who started have finished
	const allFinished =
		startedEmployees.size > 0 && pendingEmployees.length === 0;

	if (!allFinished) {
		logger.info(
			{
				storeId,
				workDay,
				totalStarted: startedEmployees.size,
				totalFinished: finishedEmployees.size,
				pendingEmployees,
			},
			'[Terminar Jornada] Store remains open. Waiting for all employees who started to finish their shift',
		);

		return {
			action: 'in_progress',
			storeId,
			workDay,
			reason: `Waiting for ${pendingEmployees.length} employee(s) to finish: [${pendingEmployees.join(', ')}]`,
		};
	}

	// 4. All employees finished -> Identify the latest clock-out time
	finishLogs.sort((a, b) =>
		String(b.record_time || '').localeCompare(String(a.record_time || '')),
	);

	const latestFinish = finishLogs[0] ?? record;
	const closeTime = buildTimestamp(workDay, latestFinish.record_time);
	const closeUser = latestFinish.employee_id
		? String(latestFinish.employee_id)
		: null;

	logger.info(
		{
			storeId,
			workDay,
			latestCloseTime: closeTime,
			latestCloseUser: closeUser,
		},
		'[Terminar Jornada] All employees finished. Finalizing store closing time',
	);

	// 5. Query existing TimeRecordStore for this store and workDay
	const existingStoreRecords = await directus.getTimeRecordStores({
		filter: {
			_and: [
				{
					_or: [
						{ store: { _eq: storeId } },
						{ store: { id: { _eq: storeId } } },
					],
				},
				{ work_day: { _eq: workDay } },
			],
		},
	});

	const existing = existingStoreRecords?.[0] ?? null;

	// Calculate operative_time in minutes (close_time - open_time)
	let operativeTime: number | null = null;
	if (existing?.open_time && closeTime) {
		const diffMs =
			new Date(closeTime).getTime() - new Date(existing.open_time).getTime();
		if (!Number.isNaN(diffMs) && diffMs > 0) {
			operativeTime = Math.round(diffMs / 60000);
		}
	}

	if (existing) {
		await directus.updateTimeRecordStore(existing.id, {
			close_time: closeTime,
			close_user: closeUser,
			closed_user: closeUser,
			...(operativeTime !== null ? { operative_time: operativeTime } : {}),
		});

		logger.info(
			{
				storeId,
				workDay,
				closeTime,
				closeUser,
				operativeTime,
				id: existing.id,
			},
			'[Terminar Jornada] Updated TimeRecordStore with final closing time and operative time',
		);

		return {
			action: 'updated',
			storeId,
			workDay,
			time: closeTime,
			timeRecordStoreId: existing.id,
			reason: 'All employees finished. Updated store closing time',
		};
	}

	// If no TimeRecordStore exists yet, create it with closing time
	const created = await directus.createTimeRecordStore({
		store: storeId,
		work_day: workDay,
		open_time: null,
		open_user: null,
		close_time: closeTime,
		close_user: closeUser,
		closed_user: closeUser,
		operative_time: null,
	});

	logger.info(
		{ storeId, workDay, closeTime, closeUser, id: created?.id },
		'[Terminar Jornada] Created new TimeRecordStore with closing time',
	);

	return {
		action: 'created',
		storeId,
		workDay,
		time: closeTime,
		timeRecordStoreId: created?.id,
		reason: 'All employees finished. Created store closing record',
	};
}
