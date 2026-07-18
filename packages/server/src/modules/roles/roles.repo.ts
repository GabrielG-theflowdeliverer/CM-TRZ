import type { Db } from '../../infra/db.js';
import { nextPosition, updateById } from '../../infra/sql.js';

const ROLE_COLUMNS = {
  roleName: 'role_name',
  personName: 'person_name',
  roleDefinition: 'role_definition',
  support: 'support',
  influence: 'influence',
  activationTactics: 'activation_tactics',
  position: 'position',
} as const;

export interface RoleRow {
  id: string;
  project_id: string;
  roster: string;
  position: number;
  role_name: string | null;
  person_name: string | null;
  role_definition: string | null;
  support: string | null;
  influence: string | null;
  activation_tactics: string | null;
}

export function listRoleRows(db: Db, projectId: string): RoleRow[] {
  return db
    .prepare('SELECT * FROM roles WHERE project_id = ? ORDER BY roster, position, rowid')
    .all(projectId) as RoleRow[];
}

export function getRoleRow(db: Db, id: string): RoleRow | null {
  return (db.prepare('SELECT * FROM roles WHERE id = ?').get(id) as RoleRow | undefined) ?? null;
}

export function nextRolePosition(db: Db, projectId: string, roster: string): number {
  return nextPosition(db, 'roles', { project_id: projectId, roster });
}

export function insertRole(
  db: Db,
  r: {
    id: string;
    projectId: string;
    roster: string;
    position: number;
    roleName: string | null;
    personName: string | null;
    roleDefinition: string | null;
    support: string | null;
    influence: string | null;
    activationTactics: string | null;
  },
): void {
  db.prepare(
    `INSERT INTO roles (id, project_id, roster, position, role_name, person_name, role_definition, support, influence, activation_tactics)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    r.id,
    r.projectId,
    r.roster,
    r.position,
    r.roleName,
    r.personName,
    r.roleDefinition,
    r.support,
    r.influence,
    r.activationTactics,
  );
}

export function updateRole(
  db: Db,
  id: string,
  fields: {
    roleName?: string | null;
    personName?: string | null;
    roleDefinition?: string | null;
    support?: string | null;
    influence?: string | null;
    activationTactics?: string | null;
    position?: number;
  },
): boolean {
  return updateById(db, 'roles', id, ROLE_COLUMNS, fields);
}

export function deleteRole(db: Db, id: string): boolean {
  return db.prepare('DELETE FROM roles WHERE id = ?').run(id).changes > 0;
}

export function getRoleGroupIds(db: Db, roleId: string): string[] {
  const rows = db.prepare('SELECT group_id FROM role_groups WHERE role_id = ?').all(roleId) as Array<{
    group_id: string;
  }>;
  return rows.map((r) => r.group_id);
}

export function setRoleGroups(db: Db, roleId: string, groupIds: string[]): void {
  const run = db.transaction(() => {
    db.prepare('DELETE FROM role_groups WHERE role_id = ?').run(roleId);
    const stmt = db.prepare('INSERT OR IGNORE INTO role_groups (role_id, group_id) VALUES (?, ?)');
    for (const groupId of groupIds) stmt.run(roleId, groupId);
  });
  run();
}
