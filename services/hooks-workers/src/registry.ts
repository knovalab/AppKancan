import {
	dummyTask,
	onTimeRecordCreatedHandler,
	syncStoreTimeRecordsHandler,
} from './handlers/index.ts';

import type { HookHandler } from './types/index.ts';

/**
 * Explicit Static Registry of Worker Hooks.
 * To register any of your 5 hooks, import it above and add it to this object.
 */
export const handlers: Record<string, HookHandler> = {
	[dummyTask.name]: dummyTask,
	[syncStoreTimeRecordsHandler.name]: syncStoreTimeRecordsHandler,
	[onTimeRecordCreatedHandler.name]: onTimeRecordCreatedHandler,
};

/**
 * Retrieve a registered hook handler by its name.
 */
export function getHandler(name: string): HookHandler | null {
	return handlers[name] ?? null;
}

/**
 * List all registered handlers with their metadata.
 */
export function listHandlers() {
	return Object.values(handlers).map((h) => ({
		name: h.name,
		description: h.description,
		timeoutMs: h.options?.timeoutMs ?? 60000,
	}));
}
