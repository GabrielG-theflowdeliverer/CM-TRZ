import type { AdaptAction, TrackingEntry } from '@cmt/domain';
import type { Db } from '../../infra/db.js';
import { nextPosition, updateById } from '../../infra/sql.js';

const TRACKING_COLUMNS = {
  scheduledDate: 'scheduled_date',
  completedDate: 'completed_date',
  description: 'description',
  status: 'status',
  results: 'results',
  notes: 'notes',
  position: 'position',
} as const;

const ADAPT_COLUMNS = {
  assessmentResults: 'assessment_results',
  strengths: 'strengths',
  opportunities: 'opportunities',
  observations: 'observations',
  implications: 'implications',
  actionSteps: 'action_steps',
  notes: 'notes',
  position: 'position',
} as const;

// ---------- tracking entries (three schedules) ----------

export interface TrackingRow {
  id: string;
  project_id: string;
  schedule: string;
  position: number;
  scheduled_date: string | null;
  completed_date: string | null;
  description: string | null;
  status: string | null;
  results: string | null;
  notes: string | null;
}

export function listTrackingRows(db: Db, projectId: string): TrackingRow[] {
  return db
    .prepare('SELECT * FROM tracking_entries WHERE project_id = ? ORDER BY schedule, position, rowid')
    .all(projectId) as TrackingRow[];
}

export function getTrackingRow(db: Db, id: string): TrackingRow | null {
  return (db.prepare('SELECT * FROM tracking_entries WHERE id = ?').get(id) as TrackingRow | undefined) ?? null;
}

export function nextTrackingPosition(db: Db, projectId: string, schedule: string): number {
  return nextPosition(db, 'tracking_entries', { project_id: projectId, schedule });
}

export function insertTracking(
  db: Db,
  t: {
    id: string;
    projectId: string;
    schedule: string;
    position: number;
    scheduledDate: string | null;
    completedDate: string | null;
    description: string | null;
    status: string | null;
    results: string | null;
    notes: string | null;
  },
): void {
  db.prepare(
    `INSERT INTO tracking_entries (id, project_id, schedule, position, scheduled_date, completed_date, description, status, results, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    t.id,
    t.projectId,
    t.schedule,
    t.position,
    t.scheduledDate,
    t.completedDate,
    t.description,
    t.status,
    t.results,
    t.notes,
  );
}

export function updateTracking(
  db: Db,
  id: string,
  fields: Partial<Omit<TrackingEntry, 'id' | 'projectId' | 'schedule'>>,
): boolean {
  return updateById(db, 'tracking_entries', id, TRACKING_COLUMNS, fields);
}

export function deleteTracking(db: Db, id: string): boolean {
  return db.prepare('DELETE FROM tracking_entries WHERE id = ?').run(id).changes > 0;
}

// ---------- adapt actions ----------

export interface AdaptRow {
  id: string;
  project_id: string;
  position: number;
  assessment_results: string | null;
  strengths: string | null;
  opportunities: string | null;
  observations: string | null;
  implications: string | null;
  action_steps: string | null;
  notes: string | null;
}

export function listAdaptRows(db: Db, projectId: string): AdaptRow[] {
  return db
    .prepare('SELECT * FROM adapt_actions WHERE project_id = ? ORDER BY position, rowid')
    .all(projectId) as AdaptRow[];
}

export function getAdaptRow(db: Db, id: string): AdaptRow | null {
  return (db.prepare('SELECT * FROM adapt_actions WHERE id = ?').get(id) as AdaptRow | undefined) ?? null;
}

export function nextAdaptPosition(db: Db, projectId: string): number {
  return nextPosition(db, 'adapt_actions', { project_id: projectId });
}

export function insertAdapt(
  db: Db,
  a: {
    id: string;
    projectId: string;
    position: number;
    assessmentResults: string | null;
    strengths: string | null;
    opportunities: string | null;
    observations: string | null;
    implications: string | null;
    actionSteps: string | null;
    notes: string | null;
  },
): void {
  db.prepare(
    `INSERT INTO adapt_actions (id, project_id, position, assessment_results, strengths, opportunities, observations, implications, action_steps, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    a.id,
    a.projectId,
    a.position,
    a.assessmentResults,
    a.strengths,
    a.opportunities,
    a.observations,
    a.implications,
    a.actionSteps,
    a.notes,
  );
}

export function updateAdapt(db: Db, id: string, fields: Partial<Omit<AdaptAction, 'id' | 'projectId'>>): boolean {
  return updateById(db, 'adapt_actions', id, ADAPT_COLUMNS, fields);
}

export function deleteAdapt(db: Db, id: string): boolean {
  return db.prepare('DELETE FROM adapt_actions WHERE id = ?').run(id).changes > 0;
}
