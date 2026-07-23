import type { TransferItem } from '@cmt/domain';
import { newId, nowIso, type Db } from '../../infra/db.js';
import { notFound } from '../../infra/http.js';
import * as repo from './transfer-ownership.repo.js';
import { getProject } from '../projects/projects.service.js';

export function listItems(db: Db, projectId: string): TransferItem[] {
  getProject(db, projectId); // 404 unknown project
  return repo.listItems(db, projectId);
}

export function createItem(
  db: Db,
  projectId: string,
  input: { responsibility: string; newOwner?: string | null; done?: boolean; notes?: string | null },
): TransferItem {
  getProject(db, projectId);
  const id = newId();
  repo.insertItem(db, {
    id,
    projectId,
    responsibility: input.responsibility,
    newOwner: input.newOwner ?? null,
    done: input.done ?? false,
    notes: input.notes ?? null,
    createdAt: nowIso(),
  });
  return repo.getItem(db, id)!;
}

export function updateItem(db: Db, id: string, fields: Parameters<typeof repo.updateItem>[2]): TransferItem {
  if (!repo.updateItem(db, id, fields)) notFound('Transfer item');
  return repo.getItem(db, id)!;
}

export function deleteItem(db: Db, id: string): void {
  if (!repo.deleteItem(db, id)) notFound('Transfer item');
}
