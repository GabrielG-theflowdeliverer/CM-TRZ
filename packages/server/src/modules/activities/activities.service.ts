import type { Activity } from '@cmt/domain';
import { newId, type Db } from '../../infra/db.js';
import { HttpError, notFound } from '../../infra/http.js';
import * as repo from './activities.repo.js';
import { getProject } from '../projects/projects.service.js';

export type ActivityInput = {
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
  adkarOutcomes?: string[];
  groupIds?: string[];
  planIds?: string[];
  blueprintIds?: string[];
  roleIds?: string[];
};

/** Every linked id must belong to the activity's project. */
function assertLinksBelong(db: Db, projectId: string, input: ActivityInput): void {
  const check = (table: string, ids: string[] | undefined, label: string) => {
    for (const id of ids ?? []) {
      const row = db.prepare(`SELECT project_id FROM ${table} WHERE id = ?`).get(id) as
        | { project_id: string }
        | undefined;
      if (!row || row.project_id !== projectId) {
        throw new HttpError(400, `${label} ${id} does not belong to this project`);
      }
    }
  };
  check('impacted_groups', input.groupIds, 'Group');
  check('plans', input.planIds, 'Plan');
  check('blueprints', input.blueprintIds, 'Blueprint');
  check('roles', input.roleIds, 'Role');
}

function applyLinks(db: Db, activityId: string, input: ActivityInput): void {
  if (input.adkarOutcomes !== undefined) repo.setLinks(db, activityId, 'adkarOutcomes', input.adkarOutcomes);
  if (input.groupIds !== undefined) repo.setLinks(db, activityId, 'groupIds', input.groupIds);
  if (input.planIds !== undefined) repo.setLinks(db, activityId, 'planIds', input.planIds);
  if (input.blueprintIds !== undefined) repo.setLinks(db, activityId, 'blueprintIds', input.blueprintIds);
  if (input.roleIds !== undefined) repo.setLinks(db, activityId, 'roleIds', input.roleIds);
}

export function listActivities(db: Db, projectId: string, filter: repo.ActivityFilter = {}): Activity[] {
  getProject(db, projectId);
  return repo.listActivities(db, projectId, filter);
}

export function getActivity(db: Db, id: string): Activity {
  return repo.getActivity(db, id) ?? notFound('Activity');
}

export function createActivity(db: Db, projectId: string, input: ActivityInput): Activity {
  getProject(db, projectId);
  assertLinksBelong(db, projectId, input);
  const id = newId();
  db.transaction(() => {
    repo.insertActivity(db, {
      id,
      projectId,
      position: input.position ?? repo.nextPosition(db, projectId),
      name: input.name ?? null,
      methodMechanism: input.methodMechanism ?? null,
      rolesRequiredText: input.rolesRequiredText ?? null,
      responsible: input.responsible ?? null,
      startDate: input.startDate ?? null,
      finishDate: input.finishDate ?? null,
      status: input.status ?? 'Not Started',
      resultFeedback: input.resultFeedback ?? null,
      overall: input.overall ?? ((input.groupIds?.length ?? 0) === 0),
    });
    applyLinks(db, id, input);
  })();
  return getActivity(db, id);
}

export function updateActivity(db: Db, id: string, input: ActivityInput): Activity {
  const existing = repo.getActivity(db, id) ?? notFound('Activity');
  assertLinksBelong(db, existing.projectId, input);
  db.transaction(() => {
    repo.updateActivity(db, id, input);
    applyLinks(db, id, input);
  })();
  return getActivity(db, id);
}

export function deleteActivity(db: Db, id: string): void {
  if (!repo.deleteActivity(db, id)) notFound('Activity');
}
