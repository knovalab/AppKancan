import dummyTask from './handlers/dummy.ts';
import type { HookHandler } from './types.ts';

/**
 * Explicit Static Registry of Worker Hooks.
 * To register any of your 5 hooks, import it above and add it to this object.
 */
export const handlers: Record<string, HookHandler> = {
	[dummyTask.name]: dummyTask,
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
