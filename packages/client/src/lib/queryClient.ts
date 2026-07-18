import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';
import { ApiError } from './api';
import { pushToast } from './toast';

/** Human-readable message for a query/mutation failure. */
export function toMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.status === 0 ? error.message : `${error.message} (${error.status})`;
  }
  return error instanceof Error ? error.message : 'Unexpected error';
}

/**
 * The app's QueryClient. Every query/mutation failure is surfaced to the user
 * via a toast instead of being swallowed — this is the client's design-for-failure
 * guarantee, so it's built here (and covered by queryClient.test.tsx) rather than
 * inlined at the render root where it can't be tested.
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    queryCache: new QueryCache({
      onError: (error) => pushToast(`Couldn't load data: ${toMessage(error)}`),
    }),
    mutationCache: new MutationCache({
      onError: (error) => pushToast(`Save failed: ${toMessage(error)}`),
    }),
    defaultOptions: {
      queries: { retry: 1, staleTime: 5_000, refetchOnWindowFocus: false },
      mutations: { retry: 0 },
    },
  });
}
