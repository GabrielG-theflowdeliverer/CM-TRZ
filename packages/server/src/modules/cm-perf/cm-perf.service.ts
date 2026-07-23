import { worstCmPerfStatus, type CmPerfItem, type CmPerfReport } from '@cmt/domain';
import { newId, nowIso, type Db } from '../../infra/db.js';
import { notFound } from '../../infra/http.js';
import { nextPosition, updateById } from '../../infra/sql.js';
import { getProject } from '../projects/projects.service.js';

/**
 * Keep a report's items in step with the project's current blueprints and
 * plans: add rows for newly-created ones, drop rows whose blueprint/plan was
 * deleted, and refresh labels. Existing statuses/descriptions are preserved.
 */
function reconcileItems(db: Db, reportId: string, projectId: string): void {
  const items = db
    .prepare('SELECT id, kind, ref_id FROM cm_perf_items WHERE report_id = ?')
    .all(reportId) as Array<{ id: string; kind: string; ref_id: string | null }>;
  const byRef = new Map(items.filter((i) => i.ref_id).map((i) => [`${i.kind}:${i.ref_id}`, i]));

  const blueprints = db
    .prepare('SELECT id, name FROM blueprints WHERE project_id = ? ORDER BY created_at, rowid')
    .all(projectId) as Array<{ id: string; name: string }>;
  const plans = db
    .prepare('SELECT id, name FROM plans WHERE project_id = ? ORDER BY kind, position, rowid')
    .all(projectId) as Array<{ id: string; name: string }>;

  const current = [
    ...blueprints.map((b) => ({ kind: 'blueprint', id: b.id, name: b.name })),
    ...plans.map((p) => ({ kind: 'plan', id: p.id, name: p.name })),
  ];
  const currentRefs = new Set(current.map((c) => `${c.kind}:${c.id}`));

  let position = nextPosition(db, 'cm_perf_items', { report_id: reportId });

  const insert = db.prepare(
    `INSERT INTO cm_perf_items (id, report_id, position, kind, ref_id, label) VALUES (?, ?, ?, ?, ?, ?)`,
  );
  const relabel = db.prepare('UPDATE cm_perf_items SET label = ? WHERE id = ?');
  const drop = db.prepare('DELETE FROM cm_perf_items WHERE id = ?');

  db.transaction(() => {
    for (const c of current) {
      const existing = byRef.get(`${c.kind}:${c.id}`);
      if (existing) relabel.run(c.name, existing.id);
      else insert.run(newId(), reportId, position++, c.kind, c.id, c.name);
    }
    // Drop items whose blueprint/plan no longer exists (leave legacy null-ref rows).
    for (const item of items) {
      if (item.ref_id && !currentRefs.has(`${item.kind}:${item.ref_id}`)) drop.run(item.id);
    }
  })();
}

interface ReportRow {
  id: string;
  project_id: string;
  name: string;
  date: string | null;
  status: string | null;
  created_at: string;
}

interface ItemRow {
  id: string;
  report_id: string;
  position: number;
  kind: string;
  ref_id: string | null;
  label: string | null;
  status: string | null;
  description: string | null;
}

function toItem(r: ItemRow): CmPerfItem {
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

function assemble(db: Db, row: ReportRow): CmPerfReport {
  const items = (
    db.prepare('SELECT * FROM cm_perf_items WHERE report_id = ? ORDER BY position, rowid').all(row.id) as ItemRow[]
  ).map(toItem);
  return {
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    date: row.date,
    status: row.status,
    createdAt: row.created_at,
    items,
  };
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
  const rows = db
    .prepare('SELECT * FROM cm_perf_reports WHERE project_id = ? ORDER BY COALESCE(date, created_at), rowid')
    .all(projectId) as ReportRow[];
  if (opts.reconcile !== false) for (const row of rows) reconcileItems(db, row.id, projectId);
  return rows.map((row) => assemble(db, row));
}

export function getReport(db: Db, id: string, opts: ReadOpts = {}): CmPerfReport {
  const row = db.prepare('SELECT * FROM cm_perf_reports WHERE id = ?').get(id) as ReportRow | undefined;
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
  db.transaction(() => {
    db.prepare(
      `INSERT INTO cm_perf_reports (id, project_id, name, date, status, created_at) VALUES (?, ?, ?, ?, 'Not Started', ?)`,
    ).run(id, projectId, input.name, input.date ?? null, nowIso());
    const stmt = db.prepare(
      `INSERT INTO cm_perf_items (id, report_id, position, kind, ref_id, label) VALUES (?, ?, ?, ?, ?, ?)`,
    );
    let position = 0;
    const blueprints = db
      .prepare('SELECT id, name FROM blueprints WHERE project_id = ? ORDER BY created_at, rowid')
      .all(projectId) as Array<{ id: string; name: string }>;
    for (const b of blueprints) stmt.run(newId(), id, position++, 'blueprint', b.id, b.name);
    const plans = db
      .prepare('SELECT id, name FROM plans WHERE project_id = ? ORDER BY kind, position, rowid')
      .all(projectId) as Array<{ id: string; name: string }>;
    for (const p of plans) stmt.run(newId(), id, position++, 'plan', p.id, p.name);
  })();
  return getReport(db, id);
}

export function updateReport(
  db: Db,
  id: string,
  fields: { name?: string; date?: string | null; status?: string | null },
): CmPerfReport {
  if (!updateById(db, 'cm_perf_reports', id, { name: 'name', date: 'date', status: 'status' }, fields)) {
    notFound('CM performance report');
  }
  return getReport(db, id);
}

export function deleteReport(db: Db, id: string): void {
  if (db.prepare('DELETE FROM cm_perf_reports WHERE id = ?').run(id).changes === 0) {
    notFound('CM performance report');
  }
}

export function updateItem(
  db: Db,
  itemId: string,
  fields: { status?: string | null; description?: string | null },
): CmPerfReport {
  const current = db.prepare('SELECT report_id FROM cm_perf_items WHERE id = ?').get(itemId) as
    | { report_id: string }
    | undefined;
  if (!current) notFound('CM performance item');
  updateById(db, 'cm_perf_items', itemId, { status: 'status', description: 'description' }, fields);
  return getReport(db, current.report_id);
}

/** Latest report's most pessimistic item status — the dashboard signal. */
export function latestReportStatus(db: Db, projectId: string): string | null {
  const row = db
    .prepare(
      `SELECT id FROM cm_perf_reports WHERE project_id = ? ORDER BY COALESCE(date, created_at) DESC, rowid DESC LIMIT 1`,
    )
    .get(projectId) as { id: string } | undefined;
  if (!row) return null;
  const statuses = (
    db.prepare('SELECT status FROM cm_perf_items WHERE report_id = ?').all(row.id) as Array<{ status: string | null }>
  ).map((r) => r.status);
  return worstCmPerfStatus(statuses);
}
