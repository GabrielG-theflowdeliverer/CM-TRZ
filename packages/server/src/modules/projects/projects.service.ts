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
    db.prepare(
      `INSERT INTO plans (id, project_id, kind, name, plan_type, position) VALUES (?, ?, 'core', ?, ?, ?)`,
    ).run(newId(), projectId, plan.name, plan.planType, i);
  });
  db.prepare(`INSERT INTO roadmaps (project_id, mode) VALUES (?, 'sequential')`).run(projectId);
  const blueprintId = newId();
  const now = nowIso();
  db.prepare(
    `INSERT INTO blueprints (id, project_id, scope_kind, group_id, name, created_at, updated_at)
     VALUES (?, ?, 'overall', NULL, 'Overall', ?, ?)`,
  ).run(blueprintId, projectId, now, now);
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
