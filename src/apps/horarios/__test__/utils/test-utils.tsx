import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { type RenderHookOptions, renderHook } from '@testing-library/react';
import type React from 'react';
import type { ReactNode } from 'react';

/**
 * Creates a fresh QueryClient configured for tests (no retries, no cache issues).
 */
export function createTestQueryClient(): QueryClient {
	return new QueryClient({
		defaultOptions: {
			queries: {
				retry: false,
				gcTime: Infinity,
			},
			mutations: {
				retry: false,
			},
		},
	});
}

/**
 * Returns a React component wrapper with QueryClientProvider.
 */
export function createQueryWrapper(
	queryClient: QueryClient = createTestQueryClient(),
): React.FC<{ children: ReactNode }> {
	return function QueryWrapper({ children }: { children: ReactNode }) {
		return (
			<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
		);
	};
}

/**
 * Custom renderHook with QueryClientProvider already wired up.
 */
export function renderHookWithQuery<TResult, TProps>(
	renderCallback: (props: TProps) => TResult,
	options?: Omit<RenderHookOptions<TProps>, 'wrapper'> & {
		queryClient?: QueryClient;
	},
) {
	const client = options?.queryClient ?? createTestQueryClient();
	const wrapper = createQueryWrapper(client);

	return {
		...renderHook(renderCallback, { ...options, wrapper }),
		queryClient: client,
	};
}

export * from '@testing-library/react';
