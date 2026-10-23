import type { TimeRecords, WorkerContext } from '../../types/index.ts';
import { handleComenzarJornada } from './comenzar-jornada.ts';
import { handleTerminarJornada } from './terminar-jornada.ts';

export interface ProcessTimeRecordResult {
	status:
		| 'created'
		| 'updated'
		| 'unchanged'
		| 'confirmed'
		| 'ignored'
		| 'in_progress';
	logType?: string;
	storeId?: string;
	workDate?: string;
	openTime?: string | null;
	timeRecordStoreId?: number;
	reason?: string;
}

const FIELDS_TO_FETCH = [
	'id',
	'store_id',
	'employee_id',
	'log_type',
	'record_time',
	'record_date',
];

/**
 * Base processor for time records:
 * Fetches the time record from Directus, normalizes the log_type,
 * and routes to the appropriate store shift handler (opening or closing).
 */
export async function processTimeRecord(
	recordKey: number | string,
	context: WorkerContext,
): Promise<ProcessTimeRecordResult> {
	const { directus, logger } = context;

	logger.debug(
		{ recordKey },
		'Fetching complete record details from com_time_records',
	);

	let record: TimeRecords | null = null;
	try {
		if (typeof directus.getTimeRecordById === 'function') {
			record = await directus.getTimeRecordById(recordKey, {
				fields: FIELDS_TO_FETCH,
			});
		} else {
			const items = await directus.getTimeRecords({
				filter: { id: { _eq: recordKey } },
				limit: 1,
				fields: FIELDS_TO_FETCH,
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
			workDate: result.workDate,
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
			workDate: result.workDate,
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
}
