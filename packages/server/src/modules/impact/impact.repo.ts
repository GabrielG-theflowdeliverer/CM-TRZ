import type { GroupAspect } from '@cmt/domain';
import type { Db } from '../../infra/db.js';

export interface GroupRow {
  id: string;
  project_id: string;
  position: number;
  name: string;
  num_people: number | null;
  adoption_usage_definition: string | null;
  unique_considerations: string | null;
}

export function listGroupRows(db: Db, projectId: string): GroupRow[] {
  return db
    .prepare('SELECT * FROM impacted_groups WHERE project_id = ? ORDER BY position, rowid')
    .all(projectId) as GroupRow[];
}

export function getGroupRow(db: Db, id: string): GroupRow | null {
  return (db.prepare('SELECT * FROM impacted_groups WHERE id = ?').get(id) as GroupRow | undefined) ?? null;
}

export function nextGroupPosition(db: Db, projectId: string): number {
  const row = db
    .prepare('SELECT COALESCE(MAX(position) + 1, 0) AS pos FROM impacted_groups WHERE project_id = ?')
    .get(projectId) as { pos: number };
  return row.pos;
}

export function insertGroup(
  db: Db,
  g: {
    id: string;
    projectId: string;
    position: number;
    name: string;
    numPeople: number | null;
    adoptionUsageDefinition: string | null;
    uniqueConsiderations: string | null;
  },
): void {
  db.prepare(
    `INSERT INTO impacted_groups (id, project_id, position, name, num_people, adoption_usage_definition, unique_considerations)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(g.id, g.projectId, g.position, g.name, g.numPeople, g.adoptionUsageDefinition, g.uniqueConsiderations);
}

export function updateGroup(
  db: Db,
  id: string,
  fields: {
    name?: string;
    numPeople?: number | null;
    adoptionUsageDefinition?: string | null;
    uniqueConsiderations?: string | null;
    position?: number;
  },
): boolean {
  const current = getGroupRow(db, id);
  if (!current) return false;
  db.prepare(
    `UPDATE impacted_groups SET name = ?, num_people = ?, adoption_usage_definition = ?, unique_considerations = ?, position = ? WHERE id = ?`,
  ).run(
    fields.name ?? current.name,
    fields.numPeople !== undefined ? fields.numPeople : current.num_people,
    fields.adoptionUsageDefinition !== undefined ? fields.adoptionUsageDefinition : current.adoption_usage_definition,
    fields.uniqueConsiderations !== undefined ? fields.uniqueConsiderations : current.unique_considerations,
    fields.position ?? current.position,
    id,
  );
  return true;
}

export function deleteGroup(db: Db, id: string): boolean {
  return db.prepare('DELETE FROM impacted_groups WHERE id = ?').run(id).changes > 0;
}

export function getAspects(db: Db, groupId: string): GroupAspect[] {
  const rows = db.prepare('SELECT * FROM group_aspects WHERE group_id = ?').all(groupId) as Array<{
    aspect_key: string;
    yesterday: string | null;
    tomorrow: string | null;
    impact: number | null;
  }>;
  return rows.map((r) => ({ aspectKey: r.aspect_key, yesterday: r.yesterday, tomorrow: r.tomorrow, impact: r.impact }));
}

export function upsertAspects(
  db: Db,
  groupId: string,
  aspects: Array<{ aspectKey: string; yesterday?: string | null; tomorrow?: string | null; impact?: number | null }>,
): void {
  const stmt = db.prepare(
    `INSERT INTO group_aspects (group_id, aspect_key, yesterday, tomorrow, impact) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(group_id, aspect_key) DO UPDATE SET
       yesterday = CASE WHEN ? THEN excluded.yesterday ELSE group_aspects.yesterday END,
       tomorrow = CASE WHEN ? THEN excluded.tomorrow ELSE group_aspects.tomorrow END,
       impact = CASE WHEN ? THEN excluded.impact ELSE group_aspects.impact END`,
  );
  const run = db.transaction(() => {
    for (const a of aspects) {
      stmt.run(
        groupId,
        a.aspectKey,
        a.yesterday ?? null,
        a.tomorrow ?? null,
        a.impact ?? null,
        a.yesterday !== undefined ? 1 : 0,
        a.tomorrow !== undefined ? 1 : 0,
        a.impact !== undefined ? 1 : 0,
      );
    }
  });
  run();
}
