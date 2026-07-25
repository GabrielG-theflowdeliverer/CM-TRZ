import type { Db } from '../../infra/db.js';

export interface RoadmapRow {
  project_id: string;
  mode: string;
  kickoff_date: string | null;
  golive_date: string | null;
  outcomes_date: string | null;
}

export interface ReleaseRow {
  release_no: number;
  date: string | null;
  name: string | null;
}

export interface MilestoneRow {
  release_no: number;
  element: string;
  date: string | null;
  group_id: string;
}

export function getRoadmapRow(db: Db, projectId: string): RoadmapRow | null {
  return (db.prepare('SELECT * FROM roadmaps WHERE project_id = ?').get(projectId) as RoadmapRow | undefined) ?? null;
}

export function listReleaseRows(db: Db, projectId: string): ReleaseRow[] {
  return db
    .prepare('SELECT release_no, date, name FROM roadmap_releases WHERE project_id = ? ORDER BY release_no')
    .all(projectId) as ReleaseRow[];
}

export function listMilestoneRows(db: Db, projectId: string): MilestoneRow[] {
  return db
    .prepare(
      'SELECT release_no, element, date, group_id FROM roadmap_adkar_milestones WHERE project_id = ? ORDER BY release_no',
    )
    .all(projectId) as MilestoneRow[];
}

/** Materialise the roadmap row on first edit; a no-op once it exists. */
export function ensureRoadmapRow(db: Db, projectId: string): void {
  db.prepare(`INSERT INTO roadmaps (project_id, mode) VALUES (?, 'sequential') ON CONFLICT(project_id) DO NOTHING`).run(
    projectId,
  );
}

export function updateRoadmapRow(
  db: Db,
  projectId: string,
  r: { mode: string; kickoffDate: string | null; goliveDate: string | null; outcomesDate: string | null },
): void {
  db.prepare(
    `UPDATE roadmaps SET mode = ?, kickoff_date = ?, golive_date = ?, outcomes_date = ? WHERE project_id = ?`,
  ).run(r.mode, r.kickoffDate, r.goliveDate, r.outcomesDate, projectId);
}

/** Upsert releases, writing only the columns each entry actually carries. */
export function upsertReleases(
  db: Db,
  projectId: string,
  releases: Array<{ releaseNo: number; date?: string | null; name?: string | null }>,
): void {
  if (releases.length === 0) return;
  const stmt = db.prepare(
    `INSERT INTO roadmap_releases (project_id, release_no, date, name) VALUES (?, ?, ?, ?)
     ON CONFLICT(project_id, release_no) DO UPDATE SET
       date = CASE WHEN ? THEN excluded.date ELSE roadmap_releases.date END,
       name = CASE WHEN ? THEN excluded.name ELSE roadmap_releases.name END`,
  );
  for (const r of releases) {
    stmt.run(projectId, r.releaseNo, r.date ?? null, r.name ?? null, r.date !== undefined ? 1 : 0, r.name !== undefined ? 1 : 0);
  }
}

/** Upsert ADKAR milestones. An empty `groupId` is the overall (ungrouped) milestone. */
export function upsertMilestones(
  db: Db,
  projectId: string,
  milestones: Array<{ releaseNo: number; element: string; date: string | null; groupId?: string | null }>,
): void {
  if (milestones.length === 0) return;
  const stmt = db.prepare(
    `INSERT INTO roadmap_adkar_milestones (project_id, release_no, element, group_id, date) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(project_id, release_no, element, group_id) DO UPDATE SET date = excluded.date`,
  );
  for (const m of milestones) stmt.run(projectId, m.releaseNo, m.element, m.groupId ?? '', m.date);
}

