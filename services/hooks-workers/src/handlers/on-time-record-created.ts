import type {
	HookHandler,
	TimeRecords,
	WorkerContext,
} from '../types/index.ts';
import { handleComenzarJornada } from './time-records/comenzar-jornada.ts';
import { handleTerminarJornada } from './time-records/terminar-jornada.ts';

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
	status:
		| 'created'
		| 'updated'
		| 'unchanged'
		| 'confirmed'
		| 'ignored'
		| 'in_progress';
	logType?: string;
	storeId?: string;
	workDay?: string;
	openTime?: string | null;
	timeRecordStoreId?: number;
	reason?: string;
}

const onTimeRecordCreatedHandler: HookHandler<
	OnTimeRecordCreatedPayload,
	OnTimeRecordCreatedResult
> = {
	name: 'on-time-record-created',
	description:
		'Dispatcher for time record webhook events: fetches record by key and routes to Comenzar Jornada or Terminar Jornada sub-handlers',
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

		// 2. Fetch complete record by key if fields are missing
		if (
			recordKey &&
			(!record.store_id || !record.record_time || !record.log_type)
		) {
			logger.debug(
				{ recordKey },
				'Fetching complete record details from com_time_records',
			);

			const fields = [
				'id',
				'store_id',
				'employee_id',
				'log_type',
				'record_time',
				'record_date',
			];

			let fetched: TimeRecords | null = null;
			if (typeof directus.getTimeRecordById === 'function') {
				fetched = await directus.getTimeRecordById(recordKey, fields);
			} else {
				const items = await directus.getTimeRecords({
					filter: { id: { _eq: recordKey } },
					limit: 1,
					fields,
				});
				fetched = items?.[0] ?? null;
			}

			if (fetched) {
				record = { ...fetched, ...record };
				logger.debug(
					{ recordKey, logType: record.log_type, storeId: record.store_id },
					'Successfully fetched time record from Directus',
				);
			} else {
				logger.warn({ recordKey }, 'Time record not found in Directus for key');
				return {
					status: 'ignored',
					reason: `Record with id "${recordKey}" not found in com_time_records`,
				};
			}
		}

		// 3. Normalize and evaluate log_type
		const rawLogType = String(record.log_type || '').trim();
		const logType = rawLogType.toLowerCase();

		// Case A: Comenzar Jornada (Opening)
		if (logType === 'comenzar jornada' || logType === 'iniciar jornada') {
			logger.info(
				{ logType: rawLogType, storeId: record.store_id },
				'Routing to handleComenzarJornada sub-handler',
			);
			const result = await handleComenzarJornada(record, context);
			return {
				status: result.action,
				logType: rawLogType,
				storeId: result.storeId,
				workDay: result.workDay,
				openTime: result.time,
				timeRecordStoreId: result.timeRecordStoreId,
				reason: result.reason,
			};
		}

		// Case B: Terminar Jornada (Closing)
		if (logType === 'terminar jornada' || logType === 'finalizar jornada') {
			logger.info(
				{ logType: rawLogType, storeId: record.store_id },
				'Routing to handleTerminarJornada sub-handler',
			);
			const result = await handleTerminarJornada(record, context);
			return {
				status: result.action,
				logType: rawLogType,
				storeId: result.storeId,
				workDay: result.workDay,
				openTime: result.time,
				timeRecordStoreId: result.timeRecordStoreId,
				reason: result.reason,
			};
		}

		// Case C: Other time logs (e.g. Almuerzo)
		logger.info(
			{ logType: rawLogType },
			'Log type is neither Comenzar nor Terminar Jornada; ignoring event',
		);
		return {
			status: 'ignored',
			logType: rawLogType,
			reason: `Log type "${rawLogType}" is not processed by daily store hours tracker`,
		};
	},
};

export default onTimeRecordCreatedHandler;
