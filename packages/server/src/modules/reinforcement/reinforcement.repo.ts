import type { ReinforcementAction } from '@cmt/domain';
import type { Db } from '../../infra/db.js';
import { updateById } from '../../infra/sql.js';

interface Row {
  id: string;
  project_id: string;
  group_id: string | null;
  mechanism: string;
  owner: string | null;
  status: string | null;
  notes: string | null;
  created_at: string;
}

const toAction = (r: Row): ReinforcementAction => ({
  id: r.id,
  projectId: r.project_id,
  groupId: r.group_id,
  mechanism: r.mechanism,
  owner: r.owner,
  status: r.status,
  notes: r.notes,
  createdAt: r.created_at,
});

export function listActions(db: Db, projectId: string): ReinforcementAction[] {
  return (
    db.prepare('SELECT * FROM reinforcement_actions WHERE project_id = ? ORDER BY created_at, rowid').all(projectId) as Row[]
  ).map(toAction);
}

export function getAction(db: Db, id: string): ReinforcementAction | null {
  const r = db.prepare('SELECT * FROM reinforcement_actions WHERE id = ?').get(id) as Row | undefined;
  return r ? toAction(r) : null;
}

export function insertAction(
  db: Db,
  a: { id: string; projectId: string; groupId: string | null; mechanism: string; owner: string | null; status: string | null; notes: string | null; createdAt: string },
): void {
  db.prepare(
    `INSERT INTO reinforcement_actions (id, project_id, group_id, mechanism, owner, status, notes, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(a.id, a.projectId, a.groupId, a.mechanism, a.owner, a.status, a.notes, a.createdAt);
}

const COLUMNS = { groupId: 'group_id', mechanism: 'mechanism', owner: 'owner', status: 'status', notes: 'notes' } as const;

export function updateAction(
  db: Db,
  id: string,
  fields: { groupId?: string | null; mechanism?: string; owner?: string | null; status?: string | null; notes?: string | null },
): boolean {
  return updateById(db, 'reinforcement_actions', id, COLUMNS, fields);
}

export function deleteAction(db: Db, id: string): boolean {
  return db.prepare('DELETE FROM reinforcement_actions WHERE id = ?').run(id).changes > 0;
}
