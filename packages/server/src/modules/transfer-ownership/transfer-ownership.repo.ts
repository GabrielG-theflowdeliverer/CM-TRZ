import type { TransferItem } from '@cmt/domain';
import type { Db } from '../../infra/db.js';
import { updateById } from '../../infra/sql.js';

interface Row {
  id: string;
  project_id: string;
  responsibility: string;
  new_owner: string | null;
  done: number;
  notes: string | null;
  created_at: string;
}

const toItem = (r: Row): TransferItem => ({
  id: r.id,
  projectId: r.project_id,
  responsibility: r.responsibility,
  newOwner: r.new_owner,
  done: r.done === 1,
  notes: r.notes,
  createdAt: r.created_at,
});

export function listItems(db: Db, projectId: string): TransferItem[] {
  return (
    db.prepare('SELECT * FROM transfer_items WHERE project_id = ? ORDER BY created_at, rowid').all(projectId) as Row[]
  ).map(toItem);
}

export function getItem(db: Db, id: string): TransferItem | null {
  const r = db.prepare('SELECT * FROM transfer_items WHERE id = ?').get(id) as Row | undefined;
  return r ? toItem(r) : null;
}

export function insertItem(
  db: Db,
  i: { id: string; projectId: string; responsibility: string; newOwner: string | null; done: boolean; notes: string | null; createdAt: string },
): void {
  db.prepare(
    `INSERT INTO transfer_items (id, project_id, responsibility, new_owner, done, notes, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(i.id, i.projectId, i.responsibility, i.newOwner, i.done ? 1 : 0, i.notes, i.createdAt);
}

const COLUMNS = { responsibility: 'responsibility', newOwner: 'new_owner', done: 'done', notes: 'notes' } as const;

export function updateItem(
  db: Db,
  id: string,
  fields: { responsibility?: string; newOwner?: string | null; done?: boolean; notes?: string | null },
): boolean {
  return updateById(db, 'transfer_items', id, COLUMNS, fields);
}

export function deleteItem(db: Db, id: string): boolean {
  return db.prepare('DELETE FROM transfer_items WHERE id = ?').run(id).changes > 0;
}
