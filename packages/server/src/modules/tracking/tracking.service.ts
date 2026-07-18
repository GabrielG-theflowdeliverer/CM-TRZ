import type { AdaptAction, TrackingEntry } from '@cmt/domain';
import { newId, type Db } from '../../infra/db.js';
import { notFound } from '../../infra/http.js';
import { nextPosition, updateById } from '../../infra/sql.js';
import { getProject } from '../projects/projects.service.js';

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

interface TrackingRow {
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

function toTracking(r: TrackingRow): TrackingEntry {
  return {
    id: r.id,
    projectId: r.project_id,
    schedule: r.schedule,
    position: r.position,
    scheduledDate: r.scheduled_date,
    completedDate: r.completed_date,
    description: r.description,
    status: r.status,
    results: r.results,
    notes: r.notes,
  };
}

export function listTracking(db: Db, projectId: string): TrackingEntry[] {
  getProject(db, projectId);
  const rows = db
    .prepare('SELECT * FROM tracking_entries WHERE project_id = ? ORDER BY schedule, position, rowid')
    .all(projectId) as TrackingRow[];
  return rows.map(toTracking);
}

export function createTracking(
  db: Db,
  projectId: string,
  input: {
    schedule: string;
    scheduledDate?: string | null;
    completedDate?: string | null;
    description?: string | null;
    status?: string | null;
    results?: string | null;
    notes?: string | null;
  },
): TrackingEntry {
  getProject(db, projectId);
  const id = newId();
  const pos = nextPosition(db, 'tracking_entries', { project_id: projectId, schedule: input.schedule });
  db.prepare(
    `INSERT INTO tracking_entries (id, project_id, schedule, position, scheduled_date, completed_date, description, status, results, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    projectId,
    input.schedule,
    pos,
    input.scheduledDate ?? null,
    input.completedDate ?? null,
    input.description ?? null,
    input.status ?? null,
    input.results ?? null,
    input.notes ?? null,
  );
  return toTracking(db.prepare('SELECT * FROM tracking_entries WHERE id = ?').get(id) as TrackingRow);
}

export function updateTracking(
  db: Db,
  id: string,
  fields: Partial<Omit<TrackingEntry, 'id' | 'projectId' | 'schedule'>>,
): TrackingEntry {
  if (!updateById(db, 'tracking_entries', id, TRACKING_COLUMNS, fields)) notFound('Tracking entry');
  return toTracking(db.prepare('SELECT * FROM tracking_entries WHERE id = ?').get(id) as TrackingRow);
}

export function deleteTracking(db: Db, id: string): void {
  if (db.prepare('DELETE FROM tracking_entries WHERE id = ?').run(id).changes === 0) notFound('Tracking entry');
}

// ---------- adapt actions ----------

interface AdaptRow {
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

function toAdapt(r: AdaptRow): AdaptAction {
  return {
    id: r.id,
    projectId: r.project_id,
    position: r.position,
    assessmentResults: r.assessment_results,
    strengths: r.strengths,
    opportunities: r.opportunities,
    observations: r.observations,
    implications: r.implications,
    actionSteps: r.action_steps,
    notes: r.notes,
  };
}

export function listAdapt(db: Db, projectId: string): AdaptAction[] {
  getProject(db, projectId);
  const rows = db
    .prepare('SELECT * FROM adapt_actions WHERE project_id = ? ORDER BY position, rowid')
    .all(projectId) as AdaptRow[];
  return rows.map(toAdapt);
}

export function createAdapt(
  db: Db,
  projectId: string,
  input: Partial<Omit<AdaptAction, 'id' | 'projectId' | 'position'>>,
): AdaptAction {
  getProject(db, projectId);
  const id = newId();
  const pos = nextPosition(db, 'adapt_actions', { project_id: projectId });
  db.prepare(
    `INSERT INTO adapt_actions (id, project_id, position, assessment_results, strengths, opportunities, observations, implications, action_steps, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    projectId,
    pos,
    input.assessmentResults ?? null,
    input.strengths ?? null,
    input.opportunities ?? null,
    input.observations ?? null,
    input.implications ?? null,
    input.actionSteps ?? null,
    input.notes ?? null,
  );
  return toAdapt(db.prepare('SELECT * FROM adapt_actions WHERE id = ?').get(id) as AdaptRow);
}

export function updateAdapt(db: Db, id: string, fields: Partial<Omit<AdaptAction, 'id' | 'projectId'>>): AdaptAction {
  if (!updateById(db, 'adapt_actions', id, ADAPT_COLUMNS, fields)) notFound('Adapt action');
  return toAdapt(db.prepare('SELECT * FROM adapt_actions WHERE id = ?').get(id) as AdaptRow);
}

export function deleteAdapt(db: Db, id: string): void {
  if (db.prepare('DELETE FROM adapt_actions WHERE id = ?').run(id).changes === 0) notFound('Adapt action');
}
