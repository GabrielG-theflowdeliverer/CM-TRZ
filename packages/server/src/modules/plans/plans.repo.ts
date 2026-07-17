import type { PlanActivity } from '@cmt/domain';
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

interface PlanActivityRow {
  id: string;
  plan_id: string;
  position: number;
  name: string | null;
  adkar_outcome: string | null;
  group_id: string | null;
  method_mechanism: string | null;
  roles_required: string | null;
  responsible: string | null;
  start_date: string | null;
  finish_date: string | null;
  status: string | null;
  result_feedback: string | null;
}

function toActivity(r: PlanActivityRow): PlanActivity {
  return {
    id: r.id,
    planId: r.plan_id,
    position: r.position,
    name: r.name,
    adkarOutcome: r.adkar_outcome,
    groupId: r.group_id,
    methodMechanism: r.method_mechanism,
    rolesRequired: r.roles_required,
    responsible: r.responsible,
    startDate: r.start_date,
    finishDate: r.finish_date,
    status: r.status,
    resultFeedback: r.result_feedback,
  };
}

export function getActivities(db: Db, planId: string): PlanActivity[] {
  const rows = db
    .prepare('SELECT * FROM plan_activities WHERE plan_id = ? ORDER BY position, rowid')
    .all(planId) as PlanActivityRow[];
  return rows.map(toActivity);
}

export function insertActivity(
  db: Db,
  a: {
    id: string;
    planId: string;
    position: number;
    name: string | null;
    adkarOutcome: string | null;
    groupId: string | null;
    methodMechanism: string | null;
    rolesRequired: string | null;
    responsible: string | null;
    startDate: string | null;
    finishDate: string | null;
    status: string | null;
    resultFeedback: string | null;
  },
): void {
  db.prepare(
    `INSERT INTO plan_activities (id, plan_id, position, name, adkar_outcome, group_id, method_mechanism, roles_required, responsible, start_date, finish_date, status, result_feedback)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    a.id,
    a.planId,
    a.position,
    a.name,
    a.adkarOutcome,
    a.groupId,
    a.methodMechanism,
    a.rolesRequired,
    a.responsible,
    a.startDate,
    a.finishDate,
    a.status,
    a.resultFeedback,
  );
}

export function nextActivityPosition(db: Db, planId: string): number {
  const row = db
    .prepare('SELECT COALESCE(MAX(position) + 1, 0) AS pos FROM plan_activities WHERE plan_id = ?')
    .get(planId) as { pos: number };
  return row.pos;
}

export function updateActivity(
  db: Db,
  id: string,
  fields: {
    name?: string | null;
    adkarOutcome?: string | null;
    groupId?: string | null;
    methodMechanism?: string | null;
    rolesRequired?: string | null;
    responsible?: string | null;
    startDate?: string | null;
    finishDate?: string | null;
    status?: string | null;
    resultFeedback?: string | null;
    position?: number;
  },
): { planId: string } | null {
  const current = db.prepare('SELECT * FROM plan_activities WHERE id = ?').get(id) as PlanActivityRow | undefined;
  if (!current) return null;
  db.prepare(
    `UPDATE plan_activities SET name = ?, adkar_outcome = ?, group_id = ?, method_mechanism = ?, roles_required = ?, responsible = ?, start_date = ?, finish_date = ?, status = ?, result_feedback = ?, position = ? WHERE id = ?`,
  ).run(
    fields.name !== undefined ? fields.name : current.name,
    fields.adkarOutcome !== undefined ? fields.adkarOutcome : current.adkar_outcome,
    fields.groupId !== undefined ? fields.groupId : current.group_id,
    fields.methodMechanism !== undefined ? fields.methodMechanism : current.method_mechanism,
    fields.rolesRequired !== undefined ? fields.rolesRequired : current.roles_required,
    fields.responsible !== undefined ? fields.responsible : current.responsible,
    fields.startDate !== undefined ? fields.startDate : current.start_date,
    fields.finishDate !== undefined ? fields.finishDate : current.finish_date,
    fields.status !== undefined ? fields.status : current.status,
    fields.resultFeedback !== undefined ? fields.resultFeedback : current.result_feedback,
    fields.position ?? current.position,
    id,
  );
  return { planId: current.plan_id };
}

export function deleteActivity(db: Db, id: string): { planId: string } | null {
  const current = db.prepare('SELECT plan_id FROM plan_activities WHERE id = ?').get(id) as
    | { plan_id: string }
    | undefined;
  if (!current) return null;
  db.prepare('DELETE FROM plan_activities WHERE id = ?').run(id);
  return { planId: current.plan_id };
}
