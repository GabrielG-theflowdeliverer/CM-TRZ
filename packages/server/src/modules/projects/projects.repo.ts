import type { Project } from '@cmt/domain';
import type { Db } from '../../infra/db.js';

interface ProjectRow {
  id: string;
  name: string;
  project_type: string | null;
  pm_approach: string | null;
  archived: number;
  created_at: string;
  updated_at: string;
}

function toProject(row: ProjectRow): Project {
  return {
    id: row.id,
    name: row.name,
    projectType: row.project_type,
    pmApproach: row.pm_approach,
    archived: row.archived === 1,
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
    `INSERT INTO projects (id, name, project_type, pm_approach, archived, created_at, updated_at)
     VALUES (?, ?, ?, ?, 0, ?, ?)`,
  ).run(p.id, p.name, p.projectType, p.pmApproach, p.createdAt, p.createdAt);
}

export function updateProject(
  db: Db,
  id: string,
  fields: { name?: string; projectType?: string | null; pmApproach?: string | null; archived?: boolean },
  updatedAt: string,
): boolean {
  const current = getProject(db, id);
  if (!current) return false;
  db.prepare(
    `UPDATE projects SET name = ?, project_type = ?, pm_approach = ?, archived = ?, updated_at = ? WHERE id = ?`,
  ).run(
    fields.name ?? current.name,
    fields.projectType !== undefined ? fields.projectType : current.projectType,
    fields.pmApproach !== undefined ? fields.pmApproach : current.pmApproach,
    (fields.archived ?? current.archived) ? 1 : 0,
    updatedAt,
    id,
  );
  return true;
}

export function deleteProject(db: Db, id: string): boolean {
  return db.prepare('DELETE FROM projects WHERE id = ?').run(id).changes > 0;
}

export function touchProject(db: Db, id: string, updatedAt: string): void {
  db.prepare('UPDATE projects SET updated_at = ? WHERE id = ?').run(updatedAt, id);
}
