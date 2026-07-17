import type { AdaptAction, CmPerfEntry, TrackingEntry } from '@cmt/domain';
import { newId, type Db } from '../../infra/db.js';
import { notFound } from '../../infra/http.js';
import { getProject } from '../projects/projects.service.js';

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
  const pos = db
    .prepare('SELECT COALESCE(MAX(position) + 1, 0) AS pos FROM tracking_entries WHERE project_id = ? AND schedule = ?')
    .get(projectId, input.schedule) as { pos: number };
  db.prepare(
    `INSERT INTO tracking_entries (id, project_id, schedule, position, scheduled_date, completed_date, description, status, results, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    projectId,
    input.schedule,
    pos.pos,
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
  const current = db.prepare('SELECT * FROM tracking_entries WHERE id = ?').get(id) as TrackingRow | undefined;
  if (!current) notFound('Tracking entry');
  db.prepare(
    `UPDATE tracking_entries SET scheduled_date = ?, completed_date = ?, description = ?, status = ?, results = ?, notes = ?, position = ? WHERE id = ?`,
  ).run(
    fields.scheduledDate !== undefined ? fields.scheduledDate : current.scheduled_date,
    fields.completedDate !== undefined ? fields.completedDate : current.completed_date,
    fields.description !== undefined ? fields.description : current.description,
    fields.status !== undefined ? fields.status : current.status,
    fields.results !== undefined ? fields.results : current.results,
    fields.notes !== undefined ? fields.notes : current.notes,
    fields.position ?? current.position,
    id,
  );
  return toTracking(db.prepare('SELECT * FROM tracking_entries WHERE id = ?').get(id) as TrackingRow);
}

export function deleteTracking(db: Db, id: string): void {
  if (db.prepare('DELETE FROM tracking_entries WHERE id = ?').run(id).changes === 0) notFound('Tracking entry');
}

// ---------- CM performance entries ----------

interface CmPerfRow {
  id: string;
  project_id: string;
  position: number;
  type: string | null;
  description: string | null;
  scheduled_date: string | null;
  completed_date: string | null;
  status: string | null;
  notes: string | null;
}

function toCmPerf(r: CmPerfRow): CmPerfEntry {
  return {
    id: r.id,
    projectId: r.project_id,
    position: r.position,
    type: r.type,
    description: r.description,
    scheduledDate: r.scheduled_date,
    completedDate: r.completed_date,
    status: r.status,
    notes: r.notes,
  };
}

export function listCmPerf(db: Db, projectId: string): CmPerfEntry[] {
  getProject(db, projectId);
  const rows = db
    .prepare('SELECT * FROM cm_perf_entries WHERE project_id = ? ORDER BY position, rowid')
    .all(projectId) as CmPerfRow[];
  return rows.map(toCmPerf);
}

export function createCmPerf(
  db: Db,
  projectId: string,
  input: Partial<Omit<CmPerfEntry, 'id' | 'projectId' | 'position'>>,
): CmPerfEntry {
  getProject(db, projectId);
  const id = newId();
  const pos = db
    .prepare('SELECT COALESCE(MAX(position) + 1, 0) AS pos FROM cm_perf_entries WHERE project_id = ?')
    .get(projectId) as { pos: number };
  db.prepare(
    `INSERT INTO cm_perf_entries (id, project_id, position, type, description, scheduled_date, completed_date, status, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    projectId,
    pos.pos,
    input.type ?? null,
    input.description ?? null,
    input.scheduledDate ?? null,
    input.completedDate ?? null,
    input.status ?? null,
    input.notes ?? null,
  );
  return toCmPerf(db.prepare('SELECT * FROM cm_perf_entries WHERE id = ?').get(id) as CmPerfRow);
}

export function updateCmPerf(
  db: Db,
  id: string,
  fields: Partial<Omit<CmPerfEntry, 'id' | 'projectId'>>,
): CmPerfEntry {
  const current = db.prepare('SELECT * FROM cm_perf_entries WHERE id = ?').get(id) as CmPerfRow | undefined;
  if (!current) notFound('CM performance entry');
  db.prepare(
    `UPDATE cm_perf_entries SET type = ?, description = ?, scheduled_date = ?, completed_date = ?, status = ?, notes = ?, position = ? WHERE id = ?`,
  ).run(
    fields.type !== undefined ? fields.type : current.type,
    fields.description !== undefined ? fields.description : current.description,
    fields.scheduledDate !== undefined ? fields.scheduledDate : current.scheduled_date,
    fields.completedDate !== undefined ? fields.completedDate : current.completed_date,
    fields.status !== undefined ? fields.status : current.status,
    fields.notes !== undefined ? fields.notes : current.notes,
    fields.position ?? current.position,
    id,
  );
  return toCmPerf(db.prepare('SELECT * FROM cm_perf_entries WHERE id = ?').get(id) as CmPerfRow);
}

export function deleteCmPerf(db: Db, id: string): void {
  if (db.prepare('DELETE FROM cm_perf_entries WHERE id = ?').run(id).changes === 0) notFound('CM performance entry');
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
  const pos = db
    .prepare('SELECT COALESCE(MAX(position) + 1, 0) AS pos FROM adapt_actions WHERE project_id = ?')
    .get(projectId) as { pos: number };
  db.prepare(
    `INSERT INTO adapt_actions (id, project_id, position, assessment_results, strengths, opportunities, observations, implications, action_steps, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    projectId,
    pos.pos,
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
  const current = db.prepare('SELECT * FROM adapt_actions WHERE id = ?').get(id) as AdaptRow | undefined;
  if (!current) notFound('Adapt action');
  db.prepare(
    `UPDATE adapt_actions SET assessment_results = ?, strengths = ?, opportunities = ?, observations = ?, implications = ?, action_steps = ?, notes = ?, position = ? WHERE id = ?`,
  ).run(
    fields.assessmentResults !== undefined ? fields.assessmentResults : current.assessment_results,
    fields.strengths !== undefined ? fields.strengths : current.strengths,
    fields.opportunities !== undefined ? fields.opportunities : current.opportunities,
    fields.observations !== undefined ? fields.observations : current.observations,
    fields.implications !== undefined ? fields.implications : current.implications,
    fields.actionSteps !== undefined ? fields.actionSteps : current.action_steps,
    fields.notes !== undefined ? fields.notes : current.notes,
    fields.position ?? current.position,
    id,
  );
  return toAdapt(db.prepare('SELECT * FROM adapt_actions WHERE id = ?').get(id) as AdaptRow);
}

export function deleteAdapt(db: Db, id: string): void {
  if (db.prepare('DELETE FROM adapt_actions WHERE id = ?').run(id).changes === 0) notFound('Adapt action');
}
