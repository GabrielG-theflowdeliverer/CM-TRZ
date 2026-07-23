import type { ReactElement } from 'react';
import { ApiError } from '../lib/api';

interface GateQuery {
  isPending: boolean;
  isError: boolean;
  error: unknown;
  refetch: () => unknown;
}

/**
 * Turn a query's loading/error state into a visible panel so a failed or still-
 * pending fetch never leaves a detail page permanently blank (a deleted or
 * mistyped id in the URL used to just render nothing). A 404 shows a not-found
 * message; any other error offers a Retry. Returns null once the data is ready,
 * so callers read:
 *
 *   const gate = queryGate(planQuery, 'plan');
 *   if (gate) return gate;
 *   // ...data is present from here
 */
export function queryGate(query: GateQuery, label: string): ReactElement | null {
  if (query.isPending) {
    return <div className="cmt-card text-sm text-slate-400">Loading {label}…</div>;
  }
  if (query.isError) {
    const notFound = query.error instanceof ApiError && query.error.status === 404;
    const message = query.error instanceof Error ? query.error.message : 'Unknown error';
    return (
      <div className="cmt-card space-y-2">
        <p className="text-sm font-semibold text-slate-700">
          {notFound ? `This ${label} could not be found.` : `Couldn't load the ${label}.`}
        </p>
        <p className="text-xs text-slate-500">{message}</p>
        {!notFound && (
          <button className="cmt-btn" onClick={() => void query.refetch()}>
            Retry
          </button>
        )}
      </div>
    );
  }
  return null;
}
