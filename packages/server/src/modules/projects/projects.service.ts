import { CORE_PLANS, type Project } from '@cmt/domain';
import { newId, nowIso, type Db } from '../../infra/db.js';
import { notFound } from '../../infra/http.js';
import * as repo from './projects.repo.js';

export function listProjects(db: Db): Project[] {
  return repo.listProjects(db);
}

export function getProject(db: Db, id: string): Project {
  return repo.getProject(db, id) ?? notFound('Project');
}

export function createProject(
  db: Db,
  input: { name: string; projectType?: string | null; pmApproach?: string | null },
): Project {
  const id = newId();
  const createdAt = nowIso();
  db.transaction(() => {
    repo.insertProject(db, {
      id,
      name: input.name,
      projectType: input.projectType ?? null,
      pmApproach: input.pmApproach ?? null,
      createdAt,
    });
    seedProjectDefaults(db, id);
  })();
  return getProject(db, id);
}

/** Every project starts with the four core CM plans, a roadmap row and an overall blueprint. */
function seedProjectDefaults(db: Db, projectId: string): void {
  CORE_PLANS.forEach((plan, i) => {
    repo.insertCorePlan(db, { id: newId(), projectId, name: plan.name, planType: plan.planType, position: i });
  });
  repo.insertRoadmapRow(db, projectId);
  repo.insertOverallBlueprint(db, { id: newId(), projectId, createdAt: nowIso() });
}

export function updateProject(
  db: Db,
  id: string,
  fields: {
    name?: string;
    projectType?: string | null;
    pmApproach?: string | null;
    status?: string;
    watchGroupIds?: string[];
  },
): Project {
  if (!repo.updateProject(db, id, fields, nowIso())) notFound('Project');
  return getProject(db, id);
}

export function deleteProject(db: Db, id: string): void {
  if (!repo.deleteProject(db, id)) notFound('Project');
}
