import type { TimeRecords, WorkerContext } from '../../types/index.ts';
import { buildTimestamp, extractStoreId, getTodayDateStr } from './utils.ts';

export interface HandleTimeRecordResult {
	action:
		| 'created'
		| 'updated'
		| 'unchanged'
		| 'confirmed'
		| 'ignored'
		| 'in_progress';
	storeId?: string;
	workDay?: string;
	time?: string | null;
	timeRecordStoreId?: number;
	reason?: string;
}

export async function handleComenzarJornada(
	record: Partial<TimeRecords>,
	context: WorkerContext,
): Promise<HandleTimeRecordResult> {
	const { directus, logger } = context;

	const storeId = extractStoreId(record.store_id);

	if (!storeId) {
		logger.warn(
			{ record },
			'[Comenzar Jornada] Missing store_id in time record',
		);
		return {
			action: 'ignored',
			reason: 'Missing store_id in time record',
		};
	}

	const workDay = record.record_date || getTodayDateStr();
	const openTime = buildTimestamp(workDay, record.record_time);
	const openUser = record.employee_id ? String(record.employee_id) : null;

	logger.info(
		{ storeId, workDay, openTime, openUser },
		'[Comenzar Jornada] Processing opening record for store',
	);

	// Check if TimeRecordStore exists for this store and workDay
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

	// 1. If not exists -> Create new TimeRecordStore
	if (!existing) {
		const created = await directus.createTimeRecordStore({
			store: storeId,
			work_day: workDay,
			open_time: openTime,
			open_user: openUser,
		});

		logger.info(
			{ storeId, workDay, openTime, id: created?.id },
			'[Comenzar Jornada] Created new TimeRecordStore with opening time',
		);

		return {
			action: 'created',
			storeId,
			workDay,
			time: openTime,
			timeRecordStoreId: created?.id,
		};
	}

	// 2. If exists -> Check if incoming openTime is earlier
	let isEarlier = false;
	if (openTime) {
		if (!existing.open_time) {
			isEarlier = true;
		} else {
			const existingTime = new Date(existing.open_time).getTime();
			const incomingTime = new Date(openTime).getTime();
			if (!Number.isNaN(incomingTime) && !Number.isNaN(existingTime)) {
				isEarlier = incomingTime < existingTime;
			} else if (openTime < existing.open_time) {
				isEarlier = true;
			}
		}
	}

	if (isEarlier) {
		await directus.updateTimeRecordStore(existing.id, {
			open_time: openTime,
			open_user: openUser,
		});

		logger.info(
			{
				storeId,
				workDay,
				previousOpenTime: existing.open_time,
				newOpenTime: openTime,
				id: existing.id,
			},
			'[Comenzar Jornada] Updated TimeRecordStore with earlier opening time',
		);

		return {
			action: 'updated',
			storeId,
			workDay,
			time: openTime,
			timeRecordStoreId: existing.id,
		};
	}

	logger.info(
		{
			storeId,
			workDay,
			existingOpenTime: existing.open_time,
			incomingTime: openTime,
		},
		'[Comenzar Jornada] Existing opening time is already earlier; unchanged',
	);

	return {
		action: 'unchanged',
		storeId,
		workDay,
		time: existing.open_time,
		timeRecordStoreId: existing.id,
		reason: 'Existing open_time is already earlier than incoming record',
	};
}
