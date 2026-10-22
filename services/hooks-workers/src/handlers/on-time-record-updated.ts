import type { HookHandler, WorkerContext } from '../types/index.ts';
import onTimeRecordCreatedHandler, {
	type OnTimeRecordCreatedResult,
} from './on-time-record-created.ts';
import { extractUpdateKey } from './time-records/utils.ts';

/**
 * Payload interface strictly for time record updates.
 * Expects { keys: number[] } or { key: number[] }
 */
export interface OnTimeRecordUpdatedPayload {
	keys?: Array<number | string>;
	key?: Array<number | string>;
}

export type OnTimeRecordUpdatedResult = OnTimeRecordCreatedResult;

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

		const resolvedKey = extractUpdateKey(rawPayload);

		if (!resolvedKey) {
			logger.warn({ payload: rawPayload }, 'Missing keys in update payload');
			return {
				status: 'ignored',
				reason: 'Missing keys in update payload',
			};
		}

		logger.info(
			{ payload: rawPayload, resolvedKey },
			'Received on-time-record-updated webhook; resolving key and delegating',
		);

		return await onTimeRecordCreatedHandler.run({ key: resolvedKey }, context);
	},
};

export default onTimeRecordUpdatedHandler;
