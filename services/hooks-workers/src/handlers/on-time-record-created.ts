import type {
	HookHandler,
	TimeRecords,
	WorkerContext,
} from '../types/index.ts';

export interface OnTimeRecordCreatedPayload {
	id?: number | string;
	key?: number | string;
	store_id?: string | { id: string } | null;
	employee_id?: string | number | null;
	log_type?: string;
	record_time?: string | null;
	record_date?: string | null;
	event?: {
		collection?: string;
		key?: number | string;
	};
	payload?: Partial<TimeRecords> & { [key: string]: unknown };
	[key: string]: unknown;
}

export interface OnTimeRecordCreatedResult {
	status: 'created' | 'updated' | 'unchanged' | 'ignored';
	storeId?: string;
	workDay?: string;
	openTime?: string | null;
	timeRecordStoreId?: number;
	reason?: string;
}

function buildTimestamp(
	dateStr: string,
	timeStr: string | null | undefined,
): string | null {
	if (!timeStr) return null;
	if (timeStr.includes('T')) {
		const d = new Date(timeStr);
		return Number.isNaN(d.getTime()) ? null : d.toISOString();
	}
	const time = timeStr.trim();
	const fullTime =
		time.length === 5
			? `${time}:00.000Z`
			: time.includes('.')
				? `${time}Z`
				: `${time}.000Z`;
	const d = new Date(`${dateStr}T${fullTime}`);
	return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function getTodayDateStr(): string {
	const now = new Date();
	const yyyy = now.getFullYear();
	const mm = String(now.getMonth() + 1).padStart(2, '0');
	const dd = String(now.getDate()).padStart(2, '0');
	return `${yyyy}-${mm}-${dd}`;
}

const onTimeRecordCreatedHandler: HookHandler<
	OnTimeRecordCreatedPayload,
	OnTimeRecordCreatedResult
> = {
	name: 'on-time-record-created',
	description:
		'Triggered when a "Comenzar Jornada" time record is created: creates or updates the daily store TimeRecordStore if opening time is earlier',
	options: {
		timeoutMs: 30000,
	},

	async run(
		rawPayload: OnTimeRecordCreatedPayload = {},
		context: WorkerContext,
	): Promise<OnTimeRecordCreatedResult> {
		const { directus, logger } = context;

		logger.info(
			{ payload: rawPayload },
			'Received on-time-record-created webhook',
		);

		// 1. Resolve item data from direct payload, nested payload, or database query
		let record: Record<string, any> = {
			...rawPayload,
			...(rawPayload.payload || {}),
		};

		const recordKey =
			record.id ?? rawPayload.key ?? rawPayload.event?.key ?? null;

		// If vital fields are missing but a primary key is given, fetch from Directus
		if ((!record.store_id || !record.record_time) && recordKey) {
			logger.debug(
				{ recordKey },
				'Fetching complete record details from com_time_records',
			);
			const items = await directus.getTimeRecords({
				filter: { id: { _eq: recordKey } },
				limit: 1,
			});
			if (items && items.length > 0) {
				record = { ...items[0], ...record };
			}
		}

		// 2. Validate log_type (must be 'Comenzar Jornada' or 'Iniciar Jornada')
		const logType = String(record.log_type || '')
			.toLowerCase()
			.trim();
		if (logType !== 'comenzar jornada' && logType !== 'iniciar jornada') {
			logger.info(
				{ logType: record.log_type },
				'Log type is not "Comenzar Jornada"; ignoring event',
			);
			return {
				status: 'ignored',
				reason: `Log type "${record.log_type}" is not an opening record`,
			};
		}

		// 3. Extract store ID
		const storeRaw = record.store_id;
		const storeId =
			typeof storeRaw === 'object' && storeRaw !== null
				? String((storeRaw as { id: string }).id)
				: storeRaw
					? String(storeRaw)
					: null;

		if (!storeId) {
			logger.warn(
				{ record },
				'No store_id provided in time record; cannot link to store',
			);
			return {
				status: 'ignored',
				reason: 'Missing store_id in time record',
			};
		}

		// 4. Resolve date and timestamps
		const workDay = record.record_date || getTodayDateStr();
		const openTime = buildTimestamp(workDay, record.record_time);
		const openUser = record.employee_id ? String(record.employee_id) : null;

		logger.info(
			{ storeId, workDay, openTime, openUser },
			'Checking daily TimeRecordStore for store',
		);

		// 5. Check if TimeRecordStore exists for this store and workDay
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

		// 6. If TimeRecordStore does not exist -> Create new record
		if (!existing) {
			const created = await directus.createTimeRecordStore({
				store: storeId,
				work_day: workDay,
				open_time: openTime,
				open_user: openUser,
				close_time: null,
				closed_user: null,
				operative_time: null,
			});

			logger.info(
				{ storeId, workDay, openTime, id: created?.id },
				'Created new TimeRecordStore with opening time',
			);

			return {
				status: 'created',
				storeId,
				workDay,
				openTime,
				timeRecordStoreId: created?.id,
			};
		}

		// 7. If TimeRecordStore already exists -> Check if incoming openTime is earlier
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
				'Updated TimeRecordStore with earlier opening time',
			);

			return {
				status: 'updated',
				storeId,
				workDay,
				openTime,
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
			'Existing TimeRecordStore opening time is already earlier; left unchanged',
		);

		return {
			status: 'unchanged',
			storeId,
			workDay,
			openTime: existing.open_time,
			timeRecordStoreId: existing.id,
			reason: 'Existing open_time is already earlier than incoming record',
		};
	},
};

export default onTimeRecordCreatedHandler;
