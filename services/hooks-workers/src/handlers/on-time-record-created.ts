import type { HookHandler, WorkerContext } from '../types/index.ts';
import {
	type ProcessTimeRecordResult,
	processTimeRecord,
} from './time-records/process-time-record.ts';

/**
 * Payload interface strictly for time record creation.
 * Expects { key: number | string }
 */
export interface OnTimeRecordCreatedPayload {
	key: number | string;
}

export type OnTimeRecordCreatedResult = ProcessTimeRecordResult;

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
		const { logger } = context;

		logger.info(
			{ payload: rawPayload },
			'Received on-time-record-created webhook',
		);

		const recordKey = rawPayload?.key;

		if (!recordKey) {
			logger.warn({ payload: rawPayload }, 'Missing key in payload');
			return {
				status: 'ignored',
				reason: 'Missing key in payload',
			};
		}

		return await processTimeRecord(recordKey, context);
	},
};

export default onTimeRecordCreatedHandler;
