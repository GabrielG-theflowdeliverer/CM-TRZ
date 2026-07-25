import type { Project } from '@cmt/domain';
import type { Db } from '../../infra/db.js';
import { updateById } from '../../infra/sql.js';

const PROJECT_COLUMNS = {
  name: 'name',
  projectType: 'project_type',
  pmApproach: 'pm_approach',
  status: 'status',
  watchGroupIds: 'watch_group_ids',
  updatedAt: 'updated_at',
} as const;

interface ProjectRow {
  id: string;
  name: string;
  project_type: string | null;
  pm_approach: string | null;
  status: string;
  watch_group_ids: string | null;
  created_at: string;
  updated_at: string;
}

function toProject(row: ProjectRow): Project {
  let watchGroupIds: string[] = [];
  try {
    watchGroupIds = row.watch_group_ids ? (JSON.parse(row.watch_group_ids) as string[]) : [];
  } catch {
    watchGroupIds = [];
  }
  return {
    id: row.id,
    name: row.name,
    projectType: row.project_type,
    pmApproach: row.pm_approach,
    status: row.status,
    watchGroupIds,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function listProjects(db: Db): Project[] {
  const rows = db.prepare('SELECT * FROM projects ORDER BY created_at').all() as ProjectRow[];
  return rows.map(toProject);
}

export function getProject(db: Db, id: string): Project | null {
  const row = db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as ProjectRow | undefined;
  return row ? toProject(row) : null;
}

export function insertProject(
  db: Db,
  p: { id: string; name: string; projectType: string | null; pmApproach: string | null; createdAt: string },
): void {
  db.prepare(
    `INSERT INTO projects (id, name, project_type, pm_approach, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'Active', ?, ?)`,
  ).run(p.id, p.name, p.projectType, p.pmApproach, p.createdAt, p.createdAt);
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
  updatedAt: string,
): boolean {
  return updateById(db, 'projects', id, PROJECT_COLUMNS, {
    ...fields,
    // JSON-encode the watch list only when it's being changed.
    watchGroupIds: fields.watchGroupIds !== undefined ? JSON.stringify(fields.watchGroupIds) : undefined,
    updatedAt,
  });
}

export function deleteProject(db: Db, id: string): boolean {
  return db.prepare('DELETE FROM projects WHERE id = ?').run(id).changes > 0;
}

export function touchProject(db: Db, id: string, updatedAt: string): void {
  db.prepare('UPDATE projects SET updated_at = ? WHERE id = ?').run(updatedAt, id);
}

/**
 * Rows a brand-new project starts life with: the four core CM plans, its
 * roadmap row and the overall blueprint. These tables belong to the plans,
 * roadmap and blueprints modules; the inserts live here rather than reaching
 * through those modules' services, which would make projects.service and its
 * three siblings mutually importing.
 */
export function insertCorePlan(
  db: Db,
  p: { id: string; projectId: string; name: string; planType: string | null; position: number },
): void {
  db.prepare(`INSERT INTO plans (id, project_id, kind, name, plan_type, position) VALUES (?, ?, 'core', ?, ?, ?)`).run(
    p.id,
    p.projectId,
    p.name,
    p.planType,
    p.position,
  );
}

export function insertRoadmapRow(db: Db, projectId: string): void {
  db.prepare(`INSERT INTO roadmaps (project_id, mode) VALUES (?, 'sequential')`).run(projectId);
}

export function insertOverallBlueprint(
  db: Db,
  b: { id: string; projectId: string; createdAt: string },
): void {
  db.prepare(
    `INSERT INTO blueprints (id, project_id, scope_kind, group_id, name, created_at, updated_at)
     VALUES (?, ?, 'overall', NULL, 'Overall', ?, ?)`,
  ).run(b.id, b.projectId, b.createdAt, b.createdAt);
}

/** Plans by name, for the demo seeder's "attach activities to the comms plan" step. */
export function listPlanNames(db: Db, projectId: string): Array<{ id: string; name: string }> {
  return db.prepare('SELECT id, name FROM plans WHERE project_id = ?').all(projectId) as Array<{
    id: string;
    name: string;
  }>;
}
