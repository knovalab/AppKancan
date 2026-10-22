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

export interface SyncStoreCloseTimeRecordsPayload {
	date?: string; // YYYY-MM-DD (defaults to current date in service timezone)
	store_id?: string; // Optional: sync a specific store only
}

export interface SyncStoreCloseDetail {
	storeId: string;
	storeName: string;
	action: 'created' | 'updated' | 'unchanged';
	openTime?: string | null;
	openUser?: string | null;
	closeTime?: string | null;
	closeUser?: string | null;
	operativeTime?: number | null;
	hasTimeRecords: boolean;
	hasClosingRecords: boolean;
	timeRecordStoreId?: number;
}

export interface SyncStoreCloseTimeRecordsResult {
	date: string;
	workDay: string;
	totalStores: number;
	created: number;
	updated: number;
	unchanged: number;
	details: SyncStoreCloseDetail[];
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

const syncStoreCloseTimeRecordsHandler: HookHandler<
	SyncStoreCloseTimeRecordsPayload,
	SyncStoreCloseTimeRecordsResult
> = {
	name: 'sync-store-close-time-records',
	description:
		'Reviews every store to synchronize the latest closing time (Terminar Jornada) and recalculate operative time',
	options: {
		timeoutMs: 60000,
		maxRetries: 1,
	},

	async run(
		payload: SyncStoreCloseTimeRecordsPayload = {},
		context: WorkerContext,
	): Promise<SyncStoreCloseTimeRecordsResult> {
		const { directus, logger } = context;
		const { dateStr, workDay } = resolveDateParts(payload.date);

		logger.info(
			{ date: dateStr, workDay, storeId: payload.store_id },
			'Starting store closing time synchronization',
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
			log_type: {
				_in: ['Comenzar Jornada', 'Terminar Jornada'],
			},
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

		const details: SyncStoreCloseDetail[] = [];
		let createdCount = 0;
		let updatedCount = 0;
		let unchangedCount = 0;

		for (const store of stores) {
			const storeId = String(store.id);
			const storeName = store.name || storeId;

			// In-memory lookup of employee time records for this store
			const storeTimeRecords = timeRecordsByStore.get(storeId) || [];

			// A. Filter for opening logs ('Comenzar Jornada' or 'Iniciar Jornada')
			const openingRecords = storeTimeRecords.filter((rec) => {
				const logType = rec.log_type?.toLowerCase()?.trim();
				return logType === 'comenzar jornada' || logType === 'iniciar jornada';
			});
			// Sort ascending to get earliest start
			openingRecords.sort((a, b) =>
				(a.record_time || '').localeCompare(b.record_time || ''),
			);
			const earliestOpen = openingRecords[0] ?? null;

			// B. Filter for closing logs ('Terminar Jornada' or 'Finalizar Jornada')
			const closingRecords = storeTimeRecords.filter((rec) => {
				const logType = rec.log_type?.toLowerCase()?.trim();
				return (
					logType === 'terminar jornada' || logType === 'finalizar jornada'
				);
			});
			// Sort descending to get the most late / latest end
			closingRecords.sort((a, b) =>
				(b.record_time || '').localeCompare(a.record_time || ''),
			);
			const latestClose = closingRecords[0] ?? null;

			const existing = existingRecordByStore.get(storeId) ?? null;

			// Resolve open_time and open_user
			const openTime =
				(earliestOpen
					? buildTimestamp(dateStr, earliestOpen.record_time)
					: null) ??
				existing?.open_time ??
				null;
			const openUser =
				(earliestOpen?.employee_id ? String(earliestOpen.employee_id) : null) ??
				existing?.open_user ??
				null;

			// Resolve close_time and close_user
			const closeTime =
				(latestClose
					? buildTimestamp(dateStr, latestClose.record_time)
					: null) ??
				existing?.close_time ??
				null;
			const closeUser =
				(latestClose?.employee_id ? String(latestClose.employee_id) : null) ??
				existing?.close_user ??
				null;

			// Calculate operative_time if both open and close times exist
			let operativeTime: number | null = null;
			if (openTime && closeTime) {
				const diffMs =
					new Date(closeTime).getTime() - new Date(openTime).getTime();
				if (!Number.isNaN(diffMs) && diffMs > 0) {
					operativeTime = Math.round(diffMs / 60000);
				}
			}

			if (existing) {
				const needsUpdate =
					existing.close_time !== closeTime ||
					existing.close_user !== closeUser ||
					(openTime && existing.open_time !== openTime) ||
					(operativeTime !== null && existing.operative_time !== operativeTime);

				if (needsUpdate) {
					await directus.updateTimeRecordStore(existing.id, {
						close_time: closeTime,
						close_user: closeUser,
						...(openTime && existing.open_time !== openTime
							? { open_time: openTime, open_user: openUser }
							: {}),
						...(operativeTime !== null
							? { operative_time: operativeTime }
							: {}),
					});

					logger.info(
						{
							storeId,
							storeName,
							closeTime,
							closeUser,
							openTime,
							operativeTime,
							id: existing.id,
						},
						'Updated TimeRecordStore with latest closing time and operative time',
					);
					updatedCount++;
					details.push({
						storeId,
						storeName,
						action: 'updated',
						openTime,
						openUser,
						closeTime,
						closeUser,
						operativeTime,
						hasTimeRecords: storeTimeRecords.length > 0,
						hasClosingRecords: closingRecords.length > 0,
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
						closeTime: existing.close_time,
						closeUser: existing.close_user,
						operativeTime: existing.operative_time,
						hasTimeRecords: storeTimeRecords.length > 0,
						hasClosingRecords: closingRecords.length > 0,
						timeRecordStoreId: existing.id,
					});
				}
			} else {
				// No TimeRecordStore exists yet -> create new record with all available data
				const createdRecord = await directus.createTimeRecordStore({
					store: storeId,
					work_day: workDay,
					open_time: openTime,
					open_user: openUser,
					close_time: closeTime,
					close_user: closeUser,
					operative_time: operativeTime,
				});

				logger.info(
					{
						storeId,
						storeName,
						openTime,
						closeTime,
						operativeTime,
						id: createdRecord?.id,
					},
					'Created new TimeRecordStore during closing sync',
				);
				createdCount++;
				details.push({
					storeId,
					storeName,
					action: 'created',
					openTime,
					openUser,
					closeTime,
					closeUser,
					operativeTime,
					hasTimeRecords: storeTimeRecords.length > 0,
					hasClosingRecords: closingRecords.length > 0,
					timeRecordStoreId: createdRecord?.id,
				});
			}
		}

		logger.info(
			{
				totalStores: stores.length,
				created: createdCount,
				updated: updatedCount,
				unchanged: unchangedCount,
			},
			'Completed store closing time synchronization',
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

export default syncStoreCloseTimeRecordsHandler;
