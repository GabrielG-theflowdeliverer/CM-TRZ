import { worstCmPerfStatus, type CmPerfItem, type CmPerfReport } from '@cmt/domain';
import { newId, nowIso, type Db } from '../../infra/db.js';
import { notFound } from '../../infra/http.js';
import { getProject } from '../projects/projects.service.js';
import { listBlueprintRefs } from '../blueprints/blueprints.service.js';
import { listPlanRefs } from '../plans/plans.service.js';
import * as repo from './cm-perf.repo.js';

/** A blueprint or plan a report measures: what an item's `kind`/`ref_id` points at. */
interface Subject {
  kind: string;
  id: string;
  name: string;
}

/**
 * Everything a report enumerates, in row order: blueprints then plans, each in
 * the order its own module defines. Asking those modules rather than querying
 * their tables here is what keeps a report's rows in step with the Blueprints
 * and Plans screens — the ordering rule has one home, not a copy per reader.
 */
function listSubjects(db: Db, projectId: string): Subject[] {
  return [
    ...listBlueprintRefs(db, projectId).map((b) => ({ kind: 'blueprint', id: b.id, name: b.name })),
    ...listPlanRefs(db, projectId).map((p) => ({ kind: 'plan', id: p.id, name: p.name })),
  ];
}

function toItem(r: repo.ItemRow): CmPerfItem {
  return {
    id: r.id,
    reportId: r.report_id,
    position: r.position,
    kind: r.kind,
    refId: r.ref_id,
    label: r.label,
    status: r.status,
    description: r.description,
  };
}

function assemble(db: Db, row: repo.ReportRow): CmPerfReport {
  return {
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    date: row.date,
    status: row.status,
    createdAt: row.created_at,
    items: repo.listItemRows(db, row.id).map(toItem),
  };
}

/** An item row laid out for a subject at a given position. */
function itemFor(subject: Subject, position: number) {
  return { position, kind: subject.kind, refId: subject.id, label: subject.name };
}

/**
 * Keep a report's items in step with the project's current blueprints and
 * plans: add rows for newly-created ones, drop rows whose blueprint/plan was
 * deleted, and refresh labels. Existing statuses/descriptions are preserved.
 */
function reconcileItems(db: Db, reportId: string, projectId: string): void {
  const items = repo.listItemRefRows(db, reportId);
  const byRef = new Map(items.filter((i) => i.ref_id).map((i) => [`${i.kind}:${i.ref_id}`, i]));
  const subjects = listSubjects(db, projectId);
  const subjectRefs = new Set(subjects.map((s) => `${s.kind}:${s.id}`));

  let position = repo.nextItemPosition(db, reportId);
  const inserts: ReturnType<typeof itemFor>[] = [];
  const relabels: Array<{ id: string; label: string }> = [];
  for (const subject of subjects) {
    const existing = byRef.get(`${subject.kind}:${subject.id}`);
    if (existing) relabels.push({ id: existing.id, label: subject.name });
    else inserts.push(itemFor(subject, position++));
  }
  // Drop items whose blueprint/plan no longer exists (leave legacy null-ref rows).
  const removals = items.filter((i) => i.ref_id && !subjectRefs.has(`${i.kind}:${i.ref_id}`)).map((i) => i.id);

  if (inserts.length === 0 && relabels.length === 0 && removals.length === 0) return;
  db.transaction(() => {
    repo.relabelItems(db, relabels);
    repo.insertItems(db, reportId, inserts);
    repo.deleteItems(db, removals);
  })();
}

/**
 * Reconciling items is a write, so it must be skippable: read-only callers (the
 * share surface) pass `{ reconcile: false }` to keep the GET side-effect-free.
 * They then see items as of the last practitioner view — correct graceful
 * degradation, and never a write to someone else's project.
 */
interface ReadOpts {
  reconcile?: boolean;
}

export function listReports(db: Db, projectId: string, opts: ReadOpts = {}): CmPerfReport[] {
  getProject(db, projectId);
  const rows = repo.listReportRows(db, projectId);
  if (opts.reconcile !== false) for (const row of rows) reconcileItems(db, row.id, projectId);
  return rows.map((row) => assemble(db, row));
}

export function getReport(db: Db, id: string, opts: ReadOpts = {}): CmPerfReport {
  const row = repo.getReportRow(db, id);
  if (!row) notFound('CM performance report');
  if (opts.reconcile !== false) reconcileItems(db, row.id, row.project_id);
  return assemble(db, row);
}

/**
 * Creating a report auto-enumerates the current ADKAR blueprints and CM plans
 * (official Proxima behavior) so every one gets a metric status row.
 */
export function createReport(db: Db, projectId: string, input: { name: string; date?: string | null }): CmPerfReport {
  getProject(db, projectId);
  const id = newId();
  const subjects = listSubjects(db, projectId);
  db.transaction(() => {
    repo.insertReport(db, { id, projectId, name: input.name, date: input.date ?? null, createdAt: nowIso() });
    repo.insertItems(db, id, subjects.map(itemFor));
  })();
  return getReport(db, id);
}

export function updateReport(
  db: Db,
  id: string,
  fields: { name?: string; date?: string | null; status?: string | null },
): CmPerfReport {
  if (!repo.updateReport(db, id, fields)) notFound('CM performance report');
  return getReport(db, id);
}

export function deleteReport(db: Db, id: string): void {
  if (!repo.deleteReport(db, id)) notFound('CM performance report');
}

export function updateItem(
  db: Db,
  itemId: string,
  fields: { status?: string | null; description?: string | null },
): CmPerfReport {
  const reportId = repo.getItemReportId(db, itemId);
  if (!reportId) notFound('CM performance item');
  repo.updateItem(db, itemId, fields);
  return getReport(db, reportId);
}

/** Latest report's most pessimistic item status — the dashboard signal. */
export function latestReportStatus(db: Db, projectId: string): string | null {
  const reportId = repo.latestReportId(db, projectId);
  if (!reportId) return null;
  return worstCmPerfStatus(repo.listItemStatuses(db, reportId));
}
