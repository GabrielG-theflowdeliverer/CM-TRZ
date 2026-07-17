import { activityProgress, type ActivityStatus, type Plan, type PlanKind } from '@cmt/domain';
import { newId, today, type Db } from '../../infra/db.js';
import { HttpError, notFound } from '../../infra/http.js';
import * as repo from './plans.repo.js';
import { getProject } from '../projects/projects.service.js';

export interface PlanWithComputed extends Plan {
  computed: { progress: ReturnType<typeof activityProgress> };
}

function assemble(db: Db, row: repo.PlanRow): PlanWithComputed {
  const activities = repo.getActivities(db, row.id);
  return {
    id: row.id,
    projectId: row.project_id,
    kind: row.kind as PlanKind,
    name: row.name,
    planType: row.plan_type,
    sponsor: row.sponsor,
    practitioner: row.practitioner,
    lastUpdated: row.last_updated,
    position: row.position,
    activities,
    computed: { progress: activityProgress(activities.map((a) => a.status as ActivityStatus | null)) },
  };
}

export function listPlans(db: Db, projectId: string): PlanWithComputed[] {
  getProject(db, projectId);
  return repo.listPlanRows(db, projectId).map((row) => assemble(db, row));
}

export function getPlan(db: Db, id: string): PlanWithComputed {
  const row = repo.getPlanRow(db, id) ?? notFound('Plan');
  return assemble(db, row);
}

export function createPlan(
  db: Db,
  projectId: string,
  input: { kind: PlanKind; name: string; planType?: string | null; sponsor?: string | null; practitioner?: string | null },
): PlanWithComputed {
  getProject(db, projectId);
  const id = newId();
  repo.insertPlan(db, {
    id,
    projectId,
    kind: input.kind,
    name: input.name,
    planType: input.planType ?? null,
    sponsor: input.sponsor ?? null,
    practitioner: input.practitioner ?? null,
    position: repo.nextPlanPosition(db, projectId, input.kind),
  });
  return getPlan(db, id);
}

export function updatePlan(db: Db, id: string, fields: Parameters<typeof repo.updatePlan>[2]): PlanWithComputed {
  if (!repo.updatePlan(db, id, fields)) notFound('Plan');
  return getPlan(db, id);
}

export function deletePlan(db: Db, id: string): void {
  const row = repo.getPlanRow(db, id) ?? notFound('Plan');
  if (row.kind === 'core') throw new HttpError(400, 'Core plans cannot be deleted');
  repo.deletePlan(db, id);
}

function assertGroupBelongs(db: Db, projectId: string, groupId: string | null | undefined): void {
  if (!groupId) return;
  const group = db.prepare('SELECT project_id FROM impacted_groups WHERE id = ?').get(groupId) as
    | { project_id: string }
    | undefined;
  if (!group || group.project_id !== projectId) throw new HttpError(400, 'groupId does not belong to this project');
}

export function addActivity(
  db: Db,
  planId: string,
  input: {
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
  },
): PlanWithComputed {
  const row = repo.getPlanRow(db, planId) ?? notFound('Plan');
  assertGroupBelongs(db, row.project_id, input.groupId);
  repo.insertActivity(db, {
    id: newId(),
    planId: row.id,
    position: repo.nextActivityPosition(db, row.id),
    name: input.name ?? null,
    adkarOutcome: input.adkarOutcome ?? null,
    groupId: input.groupId ?? null,
    methodMechanism: input.methodMechanism ?? null,
    rolesRequired: input.rolesRequired ?? null,
    responsible: input.responsible ?? null,
    startDate: input.startDate ?? null,
    finishDate: input.finishDate ?? null,
    status: input.status ?? 'Not Started',
    resultFeedback: input.resultFeedback ?? null,
  });
  repo.updatePlan(db, row.id, { lastUpdated: today() });
  return getPlan(db, planId);
}

export function updateActivity(
  db: Db,
  activityId: string,
  fields: Parameters<typeof repo.updateActivity>[2],
): PlanWithComputed {
  if (fields.groupId) {
    const current = db.prepare('SELECT plan_id FROM plan_activities WHERE id = ?').get(activityId) as
      | { plan_id: string }
      | undefined;
    if (current) {
      const plan = repo.getPlanRow(db, current.plan_id);
      if (plan) assertGroupBelongs(db, plan.project_id, fields.groupId);
    }
  }
  const result = repo.updateActivity(db, activityId, fields) ?? notFound('Plan activity');
  repo.updatePlan(db, result.planId, { lastUpdated: today() });
  return getPlan(db, result.planId);
}

export function deleteActivity(db: Db, activityId: string): PlanWithComputed {
  const result = repo.deleteActivity(db, activityId) ?? notFound('Plan activity');
  repo.updatePlan(db, result.planId, { lastUpdated: today() });
  return getPlan(db, result.planId);
}
