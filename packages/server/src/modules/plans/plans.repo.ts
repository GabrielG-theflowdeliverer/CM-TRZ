import type { Db } from '../../infra/db.js';


export interface PlanRow {
  id: string;
  project_id: string;
  kind: string;
  name: string;
  plan_type: string | null;
  sponsor: string | null;
  practitioner: string | null;
  last_updated: string | null;
  position: number;
}

export function listPlanRows(db: Db, projectId: string): PlanRow[] {
  return db
    .prepare('SELECT * FROM plans WHERE project_id = ? ORDER BY kind, position, rowid')
    .all(projectId) as PlanRow[];
}

export function getPlanRow(db: Db, id: string): PlanRow | null {
  return (db.prepare('SELECT * FROM plans WHERE id = ?').get(id) as PlanRow | undefined) ?? null;
}

export function nextPlanPosition(db: Db, projectId: string, kind: string): number {
  const row = db
    .prepare('SELECT COALESCE(MAX(position) + 1, 0) AS pos FROM plans WHERE project_id = ? AND kind = ?')
    .get(projectId, kind) as { pos: number };
  return row.pos;
}

export function insertPlan(
  db: Db,
  p: {
    id: string;
    projectId: string;
    kind: string;
    name: string;
    planType: string | null;
    sponsor: string | null;
    practitioner: string | null;
    position: number;
  },
): void {
  db.prepare(
    `INSERT INTO plans (id, project_id, kind, name, plan_type, sponsor, practitioner, position)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(p.id, p.projectId, p.kind, p.name, p.planType, p.sponsor, p.practitioner, p.position);
}

export function updatePlan(
  db: Db,
  id: string,
  fields: {
    name?: string;
    planType?: string | null;
    sponsor?: string | null;
    practitioner?: string | null;
    lastUpdated?: string | null;
    position?: number;
  },
): boolean {
  const current = getPlanRow(db, id);
  if (!current) return false;
  db.prepare(
    `UPDATE plans SET name = ?, plan_type = ?, sponsor = ?, practitioner = ?, last_updated = ?, position = ? WHERE id = ?`,
  ).run(
    fields.name ?? current.name,
    fields.planType !== undefined ? fields.planType : current.plan_type,
    fields.sponsor !== undefined ? fields.sponsor : current.sponsor,
    fields.practitioner !== undefined ? fields.practitioner : current.practitioner,
    fields.lastUpdated !== undefined ? fields.lastUpdated : current.last_updated,
    fields.position ?? current.position,
    id,
  );
  return true;
}

export function deletePlan(db: Db, id: string): boolean {
  return db.prepare('DELETE FROM plans WHERE id = ?').run(id).changes > 0;
}

