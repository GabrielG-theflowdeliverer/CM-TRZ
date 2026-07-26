import type { Db } from '../../infra/db.js';
import { newId } from '../../infra/db.js';
import { nextPosition, updateById } from '../../infra/sql.js';

export interface ReportRow {
  id: string;
  project_id: string;
  name: string;
  date: string | null;
  status: string | null;
  created_at: string;
}

export interface ItemRow {
  id: string;
  report_id: string;
  position: number;
  kind: string;
  ref_id: string | null;
  label: string | null;
  status: string | null;
  description: string | null;
}

/** The identity of an item's subject, without the answer columns — all reconciliation needs. */
export type ItemRefRow = Pick<ItemRow, 'id' | 'kind' | 'ref_id'>;

// ---------- reports ----------

export function listReportRows(db: Db, projectId: string): ReportRow[] {
  return db
    .prepare('SELECT * FROM cm_perf_reports WHERE project_id = ? ORDER BY COALESCE(date, created_at), rowid')
    .all(projectId) as ReportRow[];
}

export function getReportRow(db: Db, id: string): ReportRow | null {
  return (db.prepare('SELECT * FROM cm_perf_reports WHERE id = ?').get(id) as ReportRow | undefined) ?? null;
}

/** Most recent report by effective date — the one the dashboard reports on. */
export function latestReportId(db: Db, projectId: string): string | null {
  const row = db
    .prepare(
      `SELECT id FROM cm_perf_reports WHERE project_id = ? ORDER BY COALESCE(date, created_at) DESC, rowid DESC LIMIT 1`,
    )
    .get(projectId) as { id: string } | undefined;
  return row?.id ?? null;
}

export function insertReport(
  db: Db,
  r: { id: string; projectId: string; name: string; date: string | null; createdAt: string },
): void {
  db.prepare(
    `INSERT INTO cm_perf_reports (id, project_id, name, date, status, created_at) VALUES (?, ?, ?, ?, 'Not Started', ?)`,
  ).run(r.id, r.projectId, r.name, r.date, r.createdAt);
}

export function updateReport(
  db: Db,
  id: string,
  fields: { name?: string; date?: string | null; status?: string | null },
): boolean {
  return updateById(db, 'cm_perf_reports', id, { name: 'name', date: 'date', status: 'status' }, fields);
}

export function deleteReport(db: Db, id: string): boolean {
  return db.prepare('DELETE FROM cm_perf_reports WHERE id = ?').run(id).changes > 0;
}

// ---------- items ----------

export function listItemRows(db: Db, reportId: string): ItemRow[] {
  return db
    .prepare('SELECT * FROM cm_perf_items WHERE report_id = ? ORDER BY position, rowid')
    .all(reportId) as ItemRow[];
}

export function listItemRefRows(db: Db, reportId: string): ItemRefRow[] {
  return db.prepare('SELECT id, kind, ref_id FROM cm_perf_items WHERE report_id = ?').all(reportId) as ItemRefRow[];
}

export function listItemStatuses(db: Db, reportId: string): Array<string | null> {
  const rows = db.prepare('SELECT status FROM cm_perf_items WHERE report_id = ?').all(reportId) as Array<{
    status: string | null;
  }>;
  return rows.map((r) => r.status);
}

export function getItemReportId(db: Db, itemId: string): string | null {
  const row = db.prepare('SELECT report_id FROM cm_perf_items WHERE id = ?').get(itemId) as
    | { report_id: string }
    | undefined;
  return row?.report_id ?? null;
}

export function nextItemPosition(db: Db, reportId: string): number {
  return nextPosition(db, 'cm_perf_items', { report_id: reportId });
}

/** Bulk insert so a whole enumeration reuses one prepared statement. Ids are minted here. */
export function insertItems(
  db: Db,
  reportId: string,
  items: Array<{ position: number; kind: string; refId: string | null; label: string | null }>,
): void {
  if (items.length === 0) return;
  const stmt = db.prepare(
    `INSERT INTO cm_perf_items (id, report_id, position, kind, ref_id, label) VALUES (?, ?, ?, ?, ?, ?)`,
  );
  for (const item of items) stmt.run(newId(), reportId, item.position, item.kind, item.refId, item.label);
}

export function relabelItems(db: Db, updates: Array<{ id: string; label: string }>): void {
  if (updates.length === 0) return;
  const stmt = db.prepare('UPDATE cm_perf_items SET label = ? WHERE id = ?');
  for (const u of updates) stmt.run(u.label, u.id);
}

export function deleteItems(db: Db, ids: string[]): void {
  if (ids.length === 0) return;
  const stmt = db.prepare('DELETE FROM cm_perf_items WHERE id = ?');
  for (const id of ids) stmt.run(id);
}

export function updateItem(
  db: Db,
  id: string,
  fields: { status?: string | null; description?: string | null },
): boolean {
  return updateById(db, 'cm_perf_items', id, { status: 'status', description: 'description' }, fields);
}
