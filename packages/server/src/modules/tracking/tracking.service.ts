import type { AdaptAction, TrackingEntry } from '@cmt/domain';
import { newId, type Db } from '../../infra/db.js';
import { notFound } from '../../infra/http.js';
import { getProject } from '../projects/projects.service.js';
import * as repo from './tracking.repo.js';

// ---------- tracking entries (three schedules) ----------

function toTracking(r: repo.TrackingRow): TrackingEntry {
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

/** Re-read after a write; the row is guaranteed to exist by the preceding insert/update. */
function readTracking(db: Db, id: string): TrackingEntry {
  return toTracking(repo.getTrackingRow(db, id)!);
}

export function listTracking(db: Db, projectId: string): TrackingEntry[] {
  getProject(db, projectId);
  return repo.listTrackingRows(db, projectId).map(toTracking);
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
  repo.insertTracking(db, {
    id,
    projectId,
    schedule: input.schedule,
    position: repo.nextTrackingPosition(db, projectId, input.schedule),
    scheduledDate: input.scheduledDate ?? null,
    completedDate: input.completedDate ?? null,
    description: input.description ?? null,
    status: input.status ?? null,
    results: input.results ?? null,
    notes: input.notes ?? null,
  });
  return readTracking(db, id);
}

export function updateTracking(
  db: Db,
  id: string,
  fields: Partial<Omit<TrackingEntry, 'id' | 'projectId' | 'schedule'>>,
): TrackingEntry {
  if (!repo.updateTracking(db, id, fields)) notFound('Tracking entry');
  return readTracking(db, id);
}

export function deleteTracking(db: Db, id: string): void {
  if (!repo.deleteTracking(db, id)) notFound('Tracking entry');
}

// ---------- adapt actions ----------

function toAdapt(r: repo.AdaptRow): AdaptAction {
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

/** Re-read after a write; the row is guaranteed to exist by the preceding insert/update. */
function readAdapt(db: Db, id: string): AdaptAction {
  return toAdapt(repo.getAdaptRow(db, id)!);
}

export function listAdapt(db: Db, projectId: string): AdaptAction[] {
  getProject(db, projectId);
  return repo.listAdaptRows(db, projectId).map(toAdapt);
}

export function createAdapt(
  db: Db,
  projectId: string,
  input: Partial<Omit<AdaptAction, 'id' | 'projectId' | 'position'>>,
): AdaptAction {
  getProject(db, projectId);
  const id = newId();
  repo.insertAdapt(db, {
    id,
    projectId,
    position: repo.nextAdaptPosition(db, projectId),
    assessmentResults: input.assessmentResults ?? null,
    strengths: input.strengths ?? null,
    opportunities: input.opportunities ?? null,
    observations: input.observations ?? null,
    implications: input.implications ?? null,
    actionSteps: input.actionSteps ?? null,
    notes: input.notes ?? null,
  });
  return readAdapt(db, id);
}

export function updateAdapt(db: Db, id: string, fields: Partial<Omit<AdaptAction, 'id' | 'projectId'>>): AdaptAction {
  if (!repo.updateAdapt(db, id, fields)) notFound('Adapt action');
  return readAdapt(db, id);
}

export function deleteAdapt(db: Db, id: string): void {
  if (!repo.deleteAdapt(db, id)) notFound('Adapt action');
}
