import type { OrgGroup } from '@cmt/domain';
import type { Db } from '../../infra/db.js';

interface OrgGroupRow {
  id: string;
  name: string;
  created_at: string;
}

function toOrgGroup(row: OrgGroupRow): OrgGroup {
  return { id: row.id, name: row.name, createdAt: row.created_at };
}

export function listOrgGroups(db: Db): OrgGroup[] {
  return (db.prepare('SELECT * FROM org_groups ORDER BY name, rowid').all() as OrgGroupRow[]).map(toOrgGroup);
}

export function orgGroupExists(db: Db, id: string): boolean {
  return db.prepare('SELECT 1 FROM org_groups WHERE id = ?').get(id) !== undefined;
}

export function insertOrgGroup(db: Db, g: { id: string; name: string; createdAt: string }): void {
  db.prepare('INSERT INTO org_groups (id, name, created_at) VALUES (?, ?, ?)').run(g.id, g.name, g.createdAt);
}
