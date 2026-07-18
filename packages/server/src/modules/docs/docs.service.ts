import { DOC_FIELDS, type DocKey, type ResistanceItem } from '@cmt/domain';
import { newId, type Db } from '../../infra/db.js';
import { HttpError, notFound } from '../../infra/http.js';
import { nextPosition, updateById } from '../../infra/sql.js';
import { getProject } from '../projects/projects.service.js';

const RESISTANCE_COLUMNS = {
  groupId: 'group_id',
  groupLabel: 'group_label',
  anticipatedResistance: 'anticipated_resistance',
  specialTactics: 'special_tactics',
  position: 'position',
} as const;

export function getDoc(db: Db, projectId: string, docKey: DocKey): Record<string, string | null> {
  getProject(db, projectId);
  const rows = db
    .prepare('SELECT field_key, value FROM project_docs WHERE project_id = ? AND doc_key = ?')
    .all(projectId, docKey) as Array<{ field_key: string; value: string | null }>;
  const doc: Record<string, string | null> = {};
  for (const field of DOC_FIELDS[docKey]) doc[field] = null;
  for (const row of rows) doc[row.field_key] = row.value;
  return doc;
}

export function saveDoc(
  db: Db,
  projectId: string,
  docKey: DocKey,
  fields: Record<string, string | null>,
): Record<string, string | null> {
  getProject(db, projectId);
  const stmt = db.prepare(
    `INSERT INTO project_docs (project_id, doc_key, field_key, value) VALUES (?, ?, ?, ?)
     ON CONFLICT(project_id, doc_key, field_key) DO UPDATE SET value = excluded.value`,
  );
  const run = db.transaction(() => {
    for (const [key, value] of Object.entries(fields)) stmt.run(projectId, docKey, key, value);
  });
  run();
  return getDoc(db, projectId, docKey);
}

// ---------- resistance items ----------

interface ResistanceRow {
  id: string;
  project_id: string;
  position: number;
  group_id: string | null;
  group_label: string | null;
  anticipated_resistance: string | null;
  special_tactics: string | null;
}

function toItem(r: ResistanceRow): ResistanceItem {
  return {
    id: r.id,
    projectId: r.project_id,
    position: r.position,
    groupId: r.group_id,
    groupLabel: r.group_label,
    anticipatedResistance: r.anticipated_resistance,
    specialTactics: r.special_tactics,
  };
}

export function listResistance(db: Db, projectId: string): ResistanceItem[] {
  getProject(db, projectId);
  const rows = db
    .prepare('SELECT * FROM resistance_items WHERE project_id = ? ORDER BY position, rowid')
    .all(projectId) as ResistanceRow[];
  return rows.map(toItem);
}

export function createResistance(
  db: Db,
  projectId: string,
  input: {
    groupId?: string | null;
    groupLabel?: string | null;
    anticipatedResistance?: string | null;
    specialTactics?: string | null;
  },
): ResistanceItem {
  getProject(db, projectId);
  if (input.groupId) {
    const group = db.prepare('SELECT project_id FROM impacted_groups WHERE id = ?').get(input.groupId) as
      | { project_id: string }
      | undefined;
    if (!group || group.project_id !== projectId) throw new HttpError(400, 'groupId does not belong to this project');
  }
  const id = newId();
  const pos = nextPosition(db, 'resistance_items', { project_id: projectId });
  db.prepare(
    `INSERT INTO resistance_items (id, project_id, position, group_id, group_label, anticipated_resistance, special_tactics)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    projectId,
    pos,
    input.groupId ?? null,
    input.groupLabel ?? null,
    input.anticipatedResistance ?? null,
    input.specialTactics ?? null,
  );
  return toItem(db.prepare('SELECT * FROM resistance_items WHERE id = ?').get(id) as ResistanceRow);
}

export function updateResistance(
  db: Db,
  id: string,
  fields: Partial<Omit<ResistanceItem, 'id' | 'projectId'>>,
): ResistanceItem {
  if (
    !updateById(db, 'resistance_items', id, RESISTANCE_COLUMNS, fields as Record<string, unknown>)
  ) {
    notFound('Resistance item');
  }
  return toItem(db.prepare('SELECT * FROM resistance_items WHERE id = ?').get(id) as ResistanceRow);
}

export function deleteResistance(db: Db, id: string): void {
  if (db.prepare('DELETE FROM resistance_items WHERE id = ?').run(id).changes === 0) notFound('Resistance item');
}
