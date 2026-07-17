import { activityProgress, type ActivityStatus, type Plan, type PlanKind } from '@cmt/domain';
import { newId, today, type Db } from '../../infra/db.js';
import { HttpError, notFound } from '../../infra/http.js';
import * as repo from './plans.repo.js';
import * as activities from '../activities/activities.service.js';
import { getProject } from '../projects/projects.service.js';

export interface PlanWithComputed extends Plan {
  computed: { progress: ReturnType<typeof activityProgress> };
}

function assemble(db: Db, row: repo.PlanRow): PlanWithComputed {
  const planActivities = activities.listActivities(db, row.project_id, { planId: row.id });
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
    activities: planActivities,
    computed: { progress: activityProgress(planActivities.map((a) => a.status as ActivityStatus | null)) },
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

/** Convenience: create a unified activity pre-linked to this plan. */
export function addActivity(db: Db, planId: string, input: activities.ActivityInput): PlanWithComputed {
  const row = repo.getPlanRow(db, planId) ?? notFound('Plan');
  activities.createActivity(db, row.project_id, {
    ...input,
    planIds: [...new Set([...(input.planIds ?? []), row.id])],
  });
  repo.updatePlan(db, row.id, { lastUpdated: today() });
  return getPlan(db, planId);
}
