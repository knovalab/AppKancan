import type { HookHandler, WorkerContext } from '../types/index.ts';
import {
	type ProcessTimeRecordResult,
	processTimeRecord,
} from './time-records/process-time-record.ts';

/**
 * Payload interface strictly for time record updates.
 * Expects { keys: Array<number | string> } or { key: Array<number | string> }
 */
export interface OnTimeRecordUpdatedPayload {
	keys?: Array<number | string>;
	key?: Array<number | string> | number | string;
}

export type OnTimeRecordUpdatedResult = ProcessTimeRecordResult;

const onTimeRecordUpdatedHandler: HookHandler<
	OnTimeRecordUpdatedPayload,
	OnTimeRecordUpdatedResult
> = {
	name: 'on-time-record-updated',
	description:
		'Triggered when a time record is updated in Directus: expects { keys: number[] }, extracts the first key, and synchronizes store opening or closing',
	options: {
		timeoutMs: 30000,
	},

	async run(
		rawPayload: OnTimeRecordUpdatedPayload,
		context: WorkerContext,
	): Promise<OnTimeRecordUpdatedResult> {
		const { logger } = context;

		const resolvedKey = rawPayload?.keys?.[0] ?? 0;

		if (!resolvedKey) {
			logger.warn({ payload: rawPayload }, 'Missing keys in update payload');
			return {
				status: 'ignored',
				reason: 'Missing keys in update payload',
			};
		}

		logger.info(
			{ payload: rawPayload, resolvedKey },
			'Received on-time-record-updated webhook; processing time record',
		);

		return await processTimeRecord(resolvedKey, context);
	},
};

export default onTimeRecordUpdatedHandler;
