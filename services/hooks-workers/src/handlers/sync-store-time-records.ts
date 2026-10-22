import type { HookHandler, WorkerContext } from '../types/index.ts';

export interface SyncStoreTimeRecordsPayload {
	date?: string; // YYYY-MM-DD (defaults to current date)
	store_id?: string; // Optional: sync a specific store only
}

export interface SyncStoreDetail {
	storeId: string;
	storeName: string;
	action: 'created' | 'updated' | 'unchanged';
	openTime?: string | null;
	openUser?: string | null;
	hasTimeRecords: boolean;
	timeRecordStoreId?: number;
}

export interface SyncStoreTimeRecordsResult {
	date: string;
	workDay: string;
	totalStores: number;
	created: number;
	updated: number;
	unchanged: number;
	details: SyncStoreDetail[];
}

function formatDateParts(dateInput?: string): {
	dateStr: string;
	workDay: string;
} {
	if (dateInput && /^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
		return {
			dateStr: dateInput,
			workDay: dateInput,
		};
	}

	const now = new Date();
	const yyyy = now.getFullYear();
	const mm = String(now.getMonth() + 1).padStart(2, '0');
	const dd = String(now.getDate()).padStart(2, '0');
	const dateStr = `${yyyy}-${mm}-${dd}`;

	return { dateStr, workDay: dateStr };
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

const syncStoreTimeRecordsHandler: HookHandler<
	SyncStoreTimeRecordsPayload,
	SyncStoreTimeRecordsResult
> = {
	name: 'sync-store-time-records',
	description:
		'Reviews every store to ensure a daily TimeRecordStore exists and synchronizes opening time with earliest employee time record',
	options: {
		timeoutMs: 60000,
	},

	async run(
		payload: SyncStoreTimeRecordsPayload = {},
		context: WorkerContext,
	): Promise<SyncStoreTimeRecordsResult> {
		const { directus, logger } = context;
		const { dateStr, workDay } = formatDateParts(payload.date);

		logger.info(
			{ date: dateStr, workDay, storeId: payload.store_id },
			'Starting store TimeRecordStore synchronization',
		);

		// 1. Fetch target stores
		const storeFilter = payload.store_id
			? { id: { _eq: payload.store_id } }
			: undefined;

		const stores = await directus.getStores(
			storeFilter ? { filter: storeFilter } : undefined,
		);

		logger.info({ storeCount: stores.length }, 'Fetched stores for evaluation');

		const details: SyncStoreDetail[] = [];
		let createdCount = 0;
		let updatedCount = 0;
		let unchangedCount = 0;

		for (const store of stores) {
			const storeId = String(store.id);
			const storeName = store.name || storeId;

			// 2. Fetch employee time records for this store on this date
			const timeRecords = await directus.getTimeRecords({
				filter: {
					_and: [
						{
							_or: [
								{ store_id: { _eq: storeId } },
								{ store_id: { id: { _eq: storeId } } },
							],
						},
						{ record_date: { _eq: dateStr } },
					],
				},
			});

			// Filter for opening logs ('Comenzar Jornada' or 'Iniciar Jornada')
			const openingRecords = (timeRecords || []).filter((rec) => {
				const logType = rec.log_type?.toLowerCase()?.trim();
				return logType === 'comenzar jornada' || logType === 'iniciar jornada';
			});

			// Sort by record_time ascending to get earliest start
			openingRecords.sort((a, b) =>
				(a.record_time || '').localeCompare(b.record_time || ''),
			);

			const earliest = openingRecords[0] ?? null;

			// 3. Check for existing TimeRecordStore for this store and workDay
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

			if (earliest) {
				const openTime = buildTimestamp(dateStr, earliest.record_time);
				const openUser = earliest.employee_id ?? null;

				if (existing) {
					// Secure match found -> update if open_time or open_user differ
					const needsUpdate =
						existing.open_time !== openTime || existing.open_user !== openUser;

					if (needsUpdate) {
						await directus.updateTimeRecordStore(existing.id, {
							open_time: openTime,
							open_user: openUser,
						});
						logger.info(
							{ storeId, storeName, openTime, openUser, id: existing.id },
							'Updated existing TimeRecordStore with earliest opening time record',
						);
						updatedCount++;
						details.push({
							storeId,
							storeName,
							action: 'updated',
							openTime,
							openUser,
							hasTimeRecords: true,
							timeRecordStoreId: existing.id,
						});
					} else {
						unchangedCount++;
						details.push({
							storeId,
							storeName,
							action: 'unchanged',
							openTime: existing.open_time,
							openUser: existing.open_user,
							hasTimeRecords: true,
							timeRecordStoreId: existing.id,
						});
					}
				} else {
					// Create new TimeRecordStore with earliest record
					const createdRecord = await directus.createTimeRecordStore({
						store: storeId,
						work_day: workDay,
						open_time: openTime,
						open_user: openUser,
						close_time: null,
						closed_user: null,
						operative_time: null,
					});

					logger.info(
						{ storeId, storeName, openTime, openUser, id: createdRecord?.id },
						'Created new TimeRecordStore with earliest opening time record',
					);
					createdCount++;
					details.push({
						storeId,
						storeName,
						action: 'created',
						openTime,
						openUser,
						hasTimeRecords: true,
						timeRecordStoreId: createdRecord?.id,
					});
				}
			} else {
				// No time records for opening found
				if (existing) {
					// Already exists, keep unchanged
					unchangedCount++;
					details.push({
						storeId,
						storeName,
						action: 'unchanged',
						openTime: existing.open_time,
						openUser: existing.open_user,
						hasTimeRecords: false,
						timeRecordStoreId: existing.id,
					});
				} else {
					// Create with empty/null open and close time
					const createdRecord = await directus.createTimeRecordStore({
						store: storeId,
						work_day: workDay,
						open_time: null,
						open_user: null,
						close_time: null,
						closed_user: null,
						operative_time: null,
					});

					logger.info(
						{ storeId, storeName, id: createdRecord?.id },
						'Created empty TimeRecordStore (no opening records yet)',
					);
					createdCount++;
					details.push({
						storeId,
						storeName,
						action: 'created',
						openTime: null,
						openUser: null,
						hasTimeRecords: false,
						timeRecordStoreId: createdRecord?.id,
					});
				}
			}
		}

		logger.info(
			{
				totalStores: stores.length,
				created: createdCount,
				updated: updatedCount,
				unchanged: unchangedCount,
			},
			'Completed store TimeRecordStore synchronization',
		);

		return {
			date: dateStr,
			workDay,
			totalStores: stores.length,
			created: createdCount,
			updated: updatedCount,
			unchanged: unchangedCount,
			details,
		};
	},
};

export default syncStoreTimeRecordsHandler;
