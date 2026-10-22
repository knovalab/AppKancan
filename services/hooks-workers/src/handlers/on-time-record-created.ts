import type {
	HookHandler,
	TimeRecords,
	WorkerContext,
} from '../types/index.ts';
import { handleComenzarJornada } from './time-records/comenzar-jornada.ts';
import { handleTerminarJornada } from './time-records/terminar-jornada.ts';
import { extractCreateKey } from './time-records/utils.ts';

/**
 * Payload interface strictly for time record creation.
 * Expects { key: number | string }
 */
export interface OnTimeRecordCreatedPayload {
	key: number | string;
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
		'Triggered when a time record is created in Directus: expects { key: number }, fetches record, and synchronizes store opening or closing',
	options: {
		timeoutMs: 30000,
	},

	async run(
		rawPayload: OnTimeRecordCreatedPayload,
		context: WorkerContext,
	): Promise<OnTimeRecordCreatedResult> {
		const { directus, logger } = context;

		logger.info(
			{ payload: rawPayload },
			'Received on-time-record-created webhook',
		);

		const recordKey = extractCreateKey(rawPayload);

		if (!recordKey) {
			logger.warn({ payload: rawPayload }, 'Missing key in payload');
			return {
				status: 'ignored',
				reason: 'Missing key in payload',
			};
		}

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

		let record: TimeRecords | null = null;
		try {
			if (typeof directus.getTimeRecordById === 'function') {
				record = await directus.getTimeRecordById(recordKey, fields);
			} else {
				const items = await directus.getTimeRecords({
					filter: { id: { _eq: recordKey } },
					limit: 1,
					fields,
				});
				record = items?.[0] ?? null;
			}
		} catch (fetchErr: unknown) {
			const errMsg =
				fetchErr instanceof Error ? fetchErr.message : String(fetchErr);
			logger.warn(
				{ recordKey, error: errMsg },
				'Error fetching time record from Directus',
			);
			record = null;
		}

		if (!record) {
			logger.warn({ recordKey }, 'Time record not found in Directus for key');
			return {
				status: 'ignored',
				reason: `Record with id "${recordKey}" not found in com_time_records`,
			};
		}

		// Normalize and evaluate log_type
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
