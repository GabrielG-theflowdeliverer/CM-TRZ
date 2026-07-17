import type { ActivityStatus } from '../vocab/index.js';

export interface ProgressSummary {
  total: number;
  completed: number;
  inProgress: number;
  notStarted: number;
  /** 0-100, null when there are no activities. */
  percentComplete: number | null;
}

export function activityProgress(statuses: ReadonlyArray<ActivityStatus | null | undefined>): ProgressSummary {
  const total = statuses.length;
  let completed = 0;
  let inProgress = 0;
  for (const s of statuses) {
    if (s === 'Completed') completed++;
    else if (s === 'In Progress') inProgress++;
  }
  return {
    total,
    completed,
    inProgress,
    notStarted: total - completed - inProgress,
    percentComplete: total === 0 ? null : Math.round((completed / total) * 100),
  };
}

/** An activity is overdue when its finish date has passed and it is not completed. */
export function isOverdue(
  finishDate: string | null | undefined,
  status: ActivityStatus | null | undefined,
  today: string,
): boolean {
  if (!finishDate) return false;
  if (status === 'Completed') return false;
  return finishDate < today;
}

/** A dated item falls in the upcoming window [today, today + windowDays]. */
export function isUpcoming(date: string | null | undefined, today: string, windowDays: number): boolean {
  if (!date) return false;
  if (date < today) return false;
  const limit = addDays(today, windowDays);
  return date <= limit;
}

export function addDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const dt = new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, (d ?? 1) + days));
  return dt.toISOString().slice(0, 10);
}
