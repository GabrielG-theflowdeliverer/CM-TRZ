import type { Db } from '../../infra/db.js';

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
  const row = db
    .prepare('SELECT COALESCE(MAX(position) + 1, 0) AS pos FROM roles WHERE project_id = ? AND roster = ?')
    .get(projectId, roster) as { pos: number };
  return row.pos;
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
  const current = getRoleRow(db, id);
  if (!current) return false;
  db.prepare(
    `UPDATE roles SET role_name = ?, person_name = ?, role_definition = ?, support = ?, influence = ?, activation_tactics = ?, position = ? WHERE id = ?`,
  ).run(
    fields.roleName !== undefined ? fields.roleName : current.role_name,
    fields.personName !== undefined ? fields.personName : current.person_name,
    fields.roleDefinition !== undefined ? fields.roleDefinition : current.role_definition,
    fields.support !== undefined ? fields.support : current.support,
    fields.influence !== undefined ? fields.influence : current.influence,
    fields.activationTactics !== undefined ? fields.activationTactics : current.activation_tactics,
    fields.position ?? current.position,
    id,
  );
  return true;
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
