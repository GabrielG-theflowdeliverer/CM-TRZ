import type { BlueprintElement } from '@cmt/domain';
import type { Db } from '../../infra/db.js';

export interface BlueprintRow {
  id: string;
  project_id: string;
  scope_kind: string;
  group_id: string | null;
  name: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export function listBlueprintRows(db: Db, projectId: string): BlueprintRow[] {
  return db
    .prepare('SELECT * FROM blueprints WHERE project_id = ? ORDER BY created_at, rowid')
    .all(projectId) as BlueprintRow[];
}

export function getBlueprintRow(db: Db, id: string): BlueprintRow | null {
  return (db.prepare('SELECT * FROM blueprints WHERE id = ?').get(id) as BlueprintRow | undefined) ?? null;
}

export function insertBlueprint(
  db: Db,
  b: {
    id: string;
    projectId: string;
    scopeKind: string;
    groupId: string | null;
    name: string;
    notes: string | null;
    createdAt: string;
  },
): void {
  db.prepare(
    `INSERT INTO blueprints (id, project_id, scope_kind, group_id, name, notes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(b.id, b.projectId, b.scopeKind, b.groupId, b.name, b.notes, b.createdAt, b.createdAt);
}

export function updateBlueprint(
  db: Db,
  id: string,
  fields: { name?: string; notes?: string | null },
  updatedAt: string,
): boolean {
  const current = getBlueprintRow(db, id);
  if (!current) return false;
  db.prepare('UPDATE blueprints SET name = ?, notes = ?, updated_at = ? WHERE id = ?').run(
    fields.name ?? current.name,
    fields.notes !== undefined ? fields.notes : current.notes,
    updatedAt,
    id,
  );
  return true;
}

export function deleteBlueprint(db: Db, id: string): boolean {
  return db.prepare('DELETE FROM blueprints WHERE id = ?').run(id).changes > 0;
}

export function getElements(db: Db, blueprintId: string): BlueprintElement[] {
  const rows = db
    .prepare('SELECT element, milestone_override_date, gauge_gap FROM blueprint_elements WHERE blueprint_id = ?')
    .all(blueprintId) as Array<{ element: string; milestone_override_date: string | null; gauge_gap: string | null }>;
  return rows.map((r) => ({
    element: r.element,
    milestoneOverrideDate: r.milestone_override_date,
    gaugeGap: r.gauge_gap,
  }));
}

export function upsertElement(
  db: Db,
  blueprintId: string,
  element: string,
  fields: { milestoneOverrideDate?: string | null; gaugeGap?: string | null },
): void {
  db.prepare(
    `INSERT INTO blueprint_elements (blueprint_id, element, milestone_override_date, gauge_gap) VALUES (?, ?, ?, ?)
     ON CONFLICT(blueprint_id, element) DO UPDATE SET
       milestone_override_date = CASE WHEN ? THEN excluded.milestone_override_date ELSE blueprint_elements.milestone_override_date END,
       gauge_gap = CASE WHEN ? THEN excluded.gauge_gap ELSE blueprint_elements.gauge_gap END`,
  ).run(
    blueprintId,
    element,
    fields.milestoneOverrideDate ?? null,
    fields.gaugeGap ?? null,
    fields.milestoneOverrideDate !== undefined ? 1 : 0,
    fields.gaugeGap !== undefined ? 1 : 0,
  );
}

