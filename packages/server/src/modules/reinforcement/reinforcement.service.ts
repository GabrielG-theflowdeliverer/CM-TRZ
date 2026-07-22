import type { ReinforcementAction } from '@cmt/domain';
import { newId, nowIso, type Db } from '../../infra/db.js';
import { HttpError, notFound } from '../../infra/http.js';
import * as repo from './reinforcement.repo.js';
import { getProject } from '../projects/projects.service.js';
import { getGroupRow } from '../impact/impact.repo.js';

export function listActions(db: Db, projectId: string): ReinforcementAction[] {
  getProject(db, projectId); // 404 unknown project
  return repo.listActions(db, projectId);
}

function assertGroupInProject(db: Db, projectId: string, groupId: string | null | undefined): void {
  if (groupId == null) return;
  const group = getGroupRow(db, groupId);
  if (!group || group.project_id !== projectId) throw new HttpError(400, 'groupId is not in this project');
}

export function createAction(
  db: Db,
  projectId: string,
  input: { groupId?: string | null; mechanism: string; owner?: string | null; status?: string | null; notes?: string | null },
): ReinforcementAction {
  getProject(db, projectId);
  assertGroupInProject(db, projectId, input.groupId);
  const id = newId();
  repo.insertAction(db, {
    id,
    projectId,
    groupId: input.groupId ?? null,
    mechanism: input.mechanism,
    owner: input.owner ?? null,
    status: input.status ?? null,
    notes: input.notes ?? null,
    createdAt: nowIso(),
  });
  return repo.getAction(db, id)!;
}

export function updateAction(db: Db, id: string, fields: Parameters<typeof repo.updateAction>[2]): ReinforcementAction {
  const existing = repo.getAction(db, id) ?? notFound('Reinforcement action');
  assertGroupInProject(db, existing.projectId, fields.groupId);
  if (!repo.updateAction(db, id, fields)) notFound('Reinforcement action');
  return repo.getAction(db, id)!;
}

export function deleteAction(db: Db, id: string): void {
  if (!repo.deleteAction(db, id)) notFound('Reinforcement action');
}
