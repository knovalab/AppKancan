import type {
	HookHandler,
	TimeRecordStore,
	TimeRecords,
	WorkerContext,
} from '../types/index.ts';
import {
	buildTimestamp,
	extractStoreId,
	getTodayDateStr,
} from './time-records/utils.ts';

export interface SyncStoreTimeRecordsPayload {
	date?: string; // YYYY-MM-DD (defaults to current date in service timezone)
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

function resolveDateParts(dateInput?: string): {
	dateStr: string;
	workDay: string;
} {
	if (dateInput && /^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
		return { dateStr: dateInput, workDay: dateInput };
	}
	const dateStr = getTodayDateStr();
	return { dateStr, workDay: dateStr };
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
		maxRetries: 1,
	},

	async run(
		payload: SyncStoreTimeRecordsPayload = {},
		context: WorkerContext,
	): Promise<SyncStoreTimeRecordsResult> {
		const { directus, logger } = context;
		const { dateStr, workDay } = resolveDateParts(payload.date);

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

		// 2. Batch fetch: All time records for this date across stores (1 query instead of N)
		const timeRecordsFilter: Record<string, unknown> = {
			record_date: { _eq: dateStr },
		};
		if (payload.store_id) {
			timeRecordsFilter._or = [
				{ store_id: { _eq: payload.store_id } },
				{ store_id: { id: { _eq: payload.store_id } } },
			];
		}

		const allDailyTimeRecords = await directus.getTimeRecords({
			filter: timeRecordsFilter,
			limit: -1,
		});

		// 3. Batch fetch: All existing store daily records for this workDay (1 query instead of N)
		const storeRecordsFilter: Record<string, unknown> = {
			work_day: { _eq: workDay },
		};
		if (payload.store_id) {
			storeRecordsFilter._or = [
				{ store: { _eq: payload.store_id } },
				{ store: { id: { _eq: payload.store_id } } },
			];
		}

		const allExistingStoreRecords = await directus.getTimeRecordStores({
			filter: storeRecordsFilter,
			limit: -1,
		});

		// Index employee time records by store ID
		const timeRecordsByStore = new Map<string, TimeRecords[]>();
		for (const rec of allDailyTimeRecords || []) {
			const sId = extractStoreId(rec.store_id);
			if (sId) {
				const list = timeRecordsByStore.get(sId) || [];
				list.push(rec);
				timeRecordsByStore.set(sId, list);
			}
		}

		// Index existing TimeRecordStore by store ID
		const existingRecordByStore = new Map<string, TimeRecordStore>();
		for (const rec of allExistingStoreRecords || []) {
			const sId = extractStoreId(rec.store);
			if (sId && !existingRecordByStore.has(sId)) {
				existingRecordByStore.set(sId, rec);
			}
		}

		const details: SyncStoreDetail[] = [];
		let createdCount = 0;
		let updatedCount = 0;
		let unchangedCount = 0;

		for (const store of stores) {
			const storeId = String(store.id);
			const storeName = store.name || storeId;

			// In-memory lookup of employee time records for this store
			const storeTimeRecords = timeRecordsByStore.get(storeId) || [];

			// Filter for opening logs ('Comenzar Jornada' or 'Iniciar Jornada')
			const openingRecords = storeTimeRecords.filter((rec) => {
				const logType = rec.log_type?.toLowerCase()?.trim();
				return logType === 'comenzar jornada' || logType === 'iniciar jornada';
			});

			// Sort by record_time ascending to get earliest start
			openingRecords.sort((a, b) =>
				(a.record_time || '').localeCompare(b.record_time || ''),
			);

			const earliest = openingRecords[0] ?? null;
			const existing = existingRecordByStore.get(storeId) ?? null;

			if (earliest) {
				const openTime = buildTimestamp(dateStr, earliest.record_time);
				const openUser = earliest.employee_id
					? String(earliest.employee_id)
					: null;

				if (existing) {
					// Check if open_time or open_user differ
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
						close_user: null,
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
						close_user: null,
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
