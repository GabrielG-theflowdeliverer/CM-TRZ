import type { DocKey, ResistanceItem } from '@cmt/domain';
import type { Db } from '../../infra/db.js';
import { nextPosition, updateById } from '../../infra/sql.js';

const RESISTANCE_COLUMNS = {
  groupId: 'group_id',
  groupLabel: 'group_label',
  anticipatedResistance: 'anticipated_resistance',
  specialTactics: 'special_tactics',
  position: 'position',
} as const;

// ---------- project docs (field_key/value pairs per doc) ----------

export function listDocFields(db: Db, projectId: string, docKey: DocKey): Array<{ key: string; value: string | null }> {
  const rows = db
    .prepare('SELECT field_key, value FROM project_docs WHERE project_id = ? AND doc_key = ?')
    .all(projectId, docKey) as Array<{ field_key: string; value: string | null }>;
  return rows.map((r) => ({ key: r.field_key, value: r.value }));
}

export function upsertDocFields(
  db: Db,
  projectId: string,
  docKey: DocKey,
  fields: Record<string, string | null>,
): void {
  const stmt = db.prepare(
    `INSERT INTO project_docs (project_id, doc_key, field_key, value) VALUES (?, ?, ?, ?)
     ON CONFLICT(project_id, doc_key, field_key) DO UPDATE SET value = excluded.value`,
  );
  const run = db.transaction(() => {
    for (const [key, value] of Object.entries(fields)) stmt.run(projectId, docKey, key, value);
  });
  run();
}

// ---------- resistance items ----------

export interface ResistanceRow {
  id: string;
  project_id: string;
  position: number;
  group_id: string | null;
  group_label: string | null;
  anticipated_resistance: string | null;
  special_tactics: string | null;
}

export function listResistanceRows(db: Db, projectId: string): ResistanceRow[] {
  return db
    .prepare('SELECT * FROM resistance_items WHERE project_id = ? ORDER BY position, rowid')
    .all(projectId) as ResistanceRow[];
}

export function getResistanceRow(db: Db, id: string): ResistanceRow | null {
  return (db.prepare('SELECT * FROM resistance_items WHERE id = ?').get(id) as ResistanceRow | undefined) ?? null;
}

export function nextResistancePosition(db: Db, projectId: string): number {
  return nextPosition(db, 'resistance_items', { project_id: projectId });
}

export function insertResistance(
  db: Db,
  r: {
    id: string;
    projectId: string;
    position: number;
    groupId: string | null;
    groupLabel: string | null;
    anticipatedResistance: string | null;
    specialTactics: string | null;
  },
): void {
  db.prepare(
    `INSERT INTO resistance_items (id, project_id, position, group_id, group_label, anticipated_resistance, special_tactics)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(r.id, r.projectId, r.position, r.groupId, r.groupLabel, r.anticipatedResistance, r.specialTactics);
}

export function updateResistance(
  db: Db,
  id: string,
  fields: Partial<Omit<ResistanceItem, 'id' | 'projectId'>>,
): boolean {
  return updateById(db, 'resistance_items', id, RESISTANCE_COLUMNS, fields as Record<string, unknown>);
}

export function deleteResistance(db: Db, id: string): boolean {
  return db.prepare('DELETE FROM resistance_items WHERE id = ?').run(id).changes > 0;
}

/**
 * Owning project of an impacted group, for the "this group is in this project"
 * check on a resistance item. The row belongs to the impact module; only its
 * project ownership is read here.
 */
export function getGroupProjectId(db: Db, groupId: string): string | null {
  const row = db.prepare('SELECT project_id FROM impacted_groups WHERE id = ?').get(groupId) as
    | { project_id: string }
    | undefined;
  return row?.project_id ?? null;
}
