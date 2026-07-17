import type { Activity } from '@cmt/domain';
import type { Db } from '../../infra/db.js';

interface ActivityRow {
  id: string;
  project_id: string;
  position: number;
  name: string | null;
  method_mechanism: string | null;
  roles_required_text: string | null;
  responsible: string | null;
  start_date: string | null;
  finish_date: string | null;
  status: string | null;
  result_feedback: string | null;
  overall: number;
}

const LINK_TABLES = {
  adkarOutcomes: { table: 'activity_adkar', column: 'element' },
  groupIds: { table: 'activity_groups', column: 'group_id' },
  planIds: { table: 'activity_plans', column: 'plan_id' },
  blueprintIds: { table: 'activity_blueprints', column: 'blueprint_id' },
  roleIds: { table: 'activity_roles', column: 'role_id' },
} as const;

export type LinkKind = keyof typeof LINK_TABLES;

function links(db: Db, activityId: string, kind: LinkKind): string[] {
  const { table, column } = LINK_TABLES[kind];
  const rows = db.prepare(`SELECT ${column} AS v FROM ${table} WHERE activity_id = ?`).all(activityId) as Array<{
    v: string;
  }>;
  return rows.map((r) => r.v);
}

export function setLinks(db: Db, activityId: string, kind: LinkKind, values: string[]): void {
  const { table, column } = LINK_TABLES[kind];
  const run = db.transaction(() => {
    db.prepare(`DELETE FROM ${table} WHERE activity_id = ?`).run(activityId);
    const stmt = db.prepare(`INSERT OR IGNORE INTO ${table} (activity_id, ${column}) VALUES (?, ?)`);
    for (const value of values) stmt.run(activityId, value);
  });
  run();
}

export function addLink(db: Db, activityId: string, kind: LinkKind, value: string): void {
  const { table, column } = LINK_TABLES[kind];
  db.prepare(`INSERT OR IGNORE INTO ${table} (activity_id, ${column}) VALUES (?, ?)`).run(activityId, value);
}

function toActivity(db: Db, row: ActivityRow): Activity {
  return {
    id: row.id,
    projectId: row.project_id,
    position: row.position,
    name: row.name,
    methodMechanism: row.method_mechanism,
    rolesRequiredText: row.roles_required_text,
    responsible: row.responsible,
    startDate: row.start_date,
    finishDate: row.finish_date,
    status: row.status,
    resultFeedback: row.result_feedback,
    overall: row.overall === 1,
    adkarOutcomes: links(db, row.id, 'adkarOutcomes'),
    groupIds: links(db, row.id, 'groupIds'),
    planIds: links(db, row.id, 'planIds'),
    blueprintIds: links(db, row.id, 'blueprintIds'),
    roleIds: links(db, row.id, 'roleIds'),
  };
}

export interface ActivityFilter {
  element?: string;
  groupId?: string;
  planId?: string;
  blueprintId?: string;
  roleId?: string;
  status?: string;
  overall?: boolean;
}

export function listActivities(db: Db, projectId: string, filter: ActivityFilter = {}): Activity[] {
  let sql = 'SELECT DISTINCT a.* FROM activities a';
  const where: string[] = ['a.project_id = ?'];
  const params: unknown[] = [projectId];
  if (filter.element) {
    sql += ' JOIN activity_adkar fe ON fe.activity_id = a.id';
    where.push('fe.element = ?');
    params.push(filter.element);
  }
  if (filter.groupId) {
    sql += ' JOIN activity_groups fg ON fg.activity_id = a.id';
    where.push('fg.group_id = ?');
    params.push(filter.groupId);
  }
  if (filter.planId) {
    sql += ' JOIN activity_plans fp ON fp.activity_id = a.id';
    where.push('fp.plan_id = ?');
    params.push(filter.planId);
  }
  if (filter.blueprintId) {
    sql += ' JOIN activity_blueprints fb ON fb.activity_id = a.id';
    where.push('fb.blueprint_id = ?');
    params.push(filter.blueprintId);
  }
  if (filter.roleId) {
    sql += ' JOIN activity_roles fr ON fr.activity_id = a.id';
    where.push('fr.role_id = ?');
    params.push(filter.roleId);
  }
  if (filter.status) {
    where.push('a.status = ?');
    params.push(filter.status);
  }
  if (filter.overall !== undefined) {
    where.push('a.overall = ?');
    params.push(filter.overall ? 1 : 0);
  }
  sql += ` WHERE ${where.join(' AND ')} ORDER BY a.position, a.rowid`;
  const rows = db.prepare(sql).all(...params) as ActivityRow[];
  return rows.map((r) => toActivity(db, r));
}

export function getActivity(db: Db, id: string): Activity | null {
  const row = db.prepare('SELECT * FROM activities WHERE id = ?').get(id) as ActivityRow | undefined;
  return row ? toActivity(db, row) : null;
}

export function nextPosition(db: Db, projectId: string): number {
  const row = db
    .prepare('SELECT COALESCE(MAX(position) + 1, 0) AS pos FROM activities WHERE project_id = ?')
    .get(projectId) as { pos: number };
  return row.pos;
}

export function insertActivity(
  db: Db,
  a: {
    id: string;
    projectId: string;
    position: number;
    name: string | null;
    methodMechanism: string | null;
    rolesRequiredText: string | null;
    responsible: string | null;
    startDate: string | null;
    finishDate: string | null;
    status: string | null;
    resultFeedback: string | null;
    overall: boolean;
  },
): void {
  db.prepare(
    `INSERT INTO activities (id, project_id, position, name, method_mechanism, roles_required_text, responsible, start_date, finish_date, status, result_feedback, overall)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    a.id,
    a.projectId,
    a.position,
    a.name,
    a.methodMechanism,
    a.rolesRequiredText,
    a.responsible,
    a.startDate,
    a.finishDate,
    a.status,
    a.resultFeedback,
    a.overall ? 1 : 0,
  );
}

export function updateActivity(
  db: Db,
  id: string,
  fields: {
    name?: string | null;
    methodMechanism?: string | null;
    rolesRequiredText?: string | null;
    responsible?: string | null;
    startDate?: string | null;
    finishDate?: string | null;
    status?: string | null;
    resultFeedback?: string | null;
    overall?: boolean;
    position?: number;
  },
): boolean {
  const current = db.prepare('SELECT * FROM activities WHERE id = ?').get(id) as ActivityRow | undefined;
  if (!current) return false;
  db.prepare(
    `UPDATE activities SET name = ?, method_mechanism = ?, roles_required_text = ?, responsible = ?, start_date = ?, finish_date = ?, status = ?, result_feedback = ?, overall = ?, position = ? WHERE id = ?`,
  ).run(
    fields.name !== undefined ? fields.name : current.name,
    fields.methodMechanism !== undefined ? fields.methodMechanism : current.method_mechanism,
    fields.rolesRequiredText !== undefined ? fields.rolesRequiredText : current.roles_required_text,
    fields.responsible !== undefined ? fields.responsible : current.responsible,
    fields.startDate !== undefined ? fields.startDate : current.start_date,
    fields.finishDate !== undefined ? fields.finishDate : current.finish_date,
    fields.status !== undefined ? fields.status : current.status,
    fields.resultFeedback !== undefined ? fields.resultFeedback : current.result_feedback,
    fields.overall !== undefined ? (fields.overall ? 1 : 0) : current.overall,
    fields.position ?? current.position,
    id,
  );
  return true;
}

export function deleteActivity(db: Db, id: string): boolean {
  return db.prepare('DELETE FROM activities WHERE id = ?').run(id).changes > 0;
}
