import type { Db } from '../../infra/db.js';

/**
 * Portfolio reads: narrow, per-project projections the health rollup needs.
 * These rows are owned by the activities and tracking modules; the dashboard
 * only reads the few columns it folds into `ProjectHealthInput`.
 */

export interface ActivityStatusRow {
  status: string | null;
  finish_date: string | null;
}

/** Every activity in the project once, no matter how many plans/blueprints link it. */
export function listActivityStatusRows(db: Db, projectId: string): ActivityStatusRow[] {
  return db
    .prepare('SELECT status, finish_date FROM activities WHERE project_id = ?')
    .all(projectId) as ActivityStatusRow[];
}

export interface ScheduledCheckRow {
  scheduled_date: string;
  description: string | null;
  completed_date: string | null;
}

/** Status checks that carry a date — candidates for "next milestone" and the due-soon count. */
export function listScheduledCheckRows(db: Db, projectId: string): ScheduledCheckRow[] {
  return db
    .prepare(
      `SELECT scheduled_date, description, completed_date FROM tracking_entries WHERE project_id = ? AND scheduled_date IS NOT NULL`,
    )
    .all(projectId) as ScheduledCheckRow[];
}
