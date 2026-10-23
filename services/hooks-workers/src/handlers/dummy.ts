import type { HookHandler, WorkerContext } from '../types/index.ts';

export interface DummyPayload {
	id?: string | number;
	collection?: string;
	action?: string;
	event?: {
		key?: string | number;
		collection?: string;
	};
	[key: string]: unknown;
}

export interface DummyResult {
	status: string;
	processedRecord: string | number;
	collection: string;
	processedAt: string;
}

const dummyHandler: HookHandler<DummyPayload, DummyResult> = {
	name: 'dummy-task',
	description:
		'Guided reference template demonstrating the background hook architecture',
	options: {
		timeoutMs: 30000,
	},

	async run(
		payload: DummyPayload,
		context: WorkerContext,
	): Promise<DummyResult> {
		const { logger } = context;

		logger.info({ payload }, 'Received hook payload');
		logger.debug('Simulating async processing...');

		await new Promise((resolve) => setTimeout(resolve, 300));

		const recordId = payload?.event?.key ?? payload?.id ?? 'N/A';
		const collection =
			payload?.event?.collection ?? payload?.collection ?? 'custom';

		// Example Directus SDK usage:
		// await directus.request(updateItem(collection, recordId, { is_synced: true }));

		logger.info({ collection, recordId }, 'Processed hook task successfully');

		return {
			status: 'success',
			processedRecord: recordId,
			collection,
			processedAt: new Date().toISOString(),
		};
	},
};

export default dummyHandler;
