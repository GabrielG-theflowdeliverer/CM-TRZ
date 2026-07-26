import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';
import { ApiError } from './api';
import { pushToast } from './toast';
import { reportClientError } from './report';

/** Human-readable message for a query/mutation failure. */
export function toMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.status === 0 ? error.message : `${error.message} (${error.status})`;
  }
  return error instanceof Error ? error.message : 'Unexpected error';
}

/**
 * What the user actually sees. Names the call and the reference id so a report
 * is actionable: a timeout used to read only "Request timed out after 15s",
 * which said nothing about *which* request and matched no server log line,
 * because an abandoned request was never logged at all.
 */
export function toToast(prefix: string, error: unknown): string {
  const message = `${prefix}: ${toMessage(error)}`;
  if (!(error instanceof ApiError) || !error.context.url) return message;
  const { method, url, requestId } = error.context;
  return `${message} — ${method} ${url}${requestId ? ` · ref ${requestId}` : ''}`;
}

/**
 * A failure the server already recorded does not need reporting back to it: any
 * HTTP status means the request arrived and `requestLogger` logged it. Status 0
 * is the interesting case — a timeout or network failure, which may never have
 * reached the server at all.
 */
function shouldReport(error: unknown): boolean {
  return !(error instanceof ApiError) || error.status === 0;
}

function report(error: unknown): void {
  if (!shouldReport(error)) return;
  const context = error instanceof ApiError ? error.context : undefined;
  reportClientError({
    kind: 'request',
    message: `${context?.method ?? ''} ${context?.url ?? ''} — ${toMessage(error)}`.trim(),
    requestId: context?.requestId,
  });
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
      onError: (error) => {
        pushToast(toToast("Couldn't load data", error));
        report(error);
      },
    }),
    mutationCache: new MutationCache({
      onError: (error) => {
        pushToast(toToast('Save failed', error));
        report(error);
      },
    }),
    defaultOptions: {
      queries: { retry: 1, staleTime: 5_000, refetchOnWindowFocus: false },
      mutations: { retry: 0 },
    },
  });
}
