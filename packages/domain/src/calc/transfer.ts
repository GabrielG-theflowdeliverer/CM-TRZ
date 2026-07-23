import type { TransferItem } from '../entities/transfer.js';

export interface TransferProgress {
  total: number;
  transferred: number;
  /** 0-100, null when there are no items. */
  percentComplete: number | null;
  /** True only when there is at least one item and every one is transferred. */
  complete: boolean;
}

/**
 * Derived transfer-of-ownership progress — never stored, recomputed from the
 * checklist. The handoff is "complete" only when every responsibility has an
 * owner confirmed (done); an empty checklist is not complete.
 */
export function transferProgress(items: ReadonlyArray<Pick<TransferItem, 'done'>>): TransferProgress {
  const total = items.length;
  const transferred = items.reduce((n, i) => n + (i.done ? 1 : 0), 0);
  return {
    total,
    transferred,
    percentComplete: total === 0 ? null : Math.round((transferred / total) * 100),
    complete: total > 0 && transferred === total,
  };
}
