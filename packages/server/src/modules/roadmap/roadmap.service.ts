import { ADKAR_ELEMENTS, MAX_RELEASES, type Roadmap, type RoadmapMode } from '@cmt/domain';
import type { Db } from '../../infra/db.js';
import { HttpError } from '../../infra/http.js';
import { getProject } from '../projects/projects.service.js';

interface RoadmapRow {
  project_id: string;
  mode: string;
  kickoff_date: string | null;
  golive_date: string | null;
  outcomes_date: string | null;
}

export function getRoadmap(db: Db, projectId: string): Roadmap {
  getProject(db, projectId);
  let row = db.prepare('SELECT * FROM roadmaps WHERE project_id = ?').get(projectId) as RoadmapRow | undefined;
  if (!row) {
    db.prepare(`INSERT INTO roadmaps (project_id, mode) VALUES (?, 'sequential')`).run(projectId);
    row = db.prepare('SELECT * FROM roadmaps WHERE project_id = ?').get(projectId) as RoadmapRow;
  }
  const releases = db
    .prepare('SELECT release_no, date, name FROM roadmap_releases WHERE project_id = ? ORDER BY release_no')
    .all(projectId) as Array<{ release_no: number; date: string | null; name: string | null }>;
  const milestones = db
    .prepare(
      'SELECT release_no, element, date, group_id FROM roadmap_adkar_milestones WHERE project_id = ? ORDER BY release_no',
    )
    .all(projectId) as Array<{ release_no: number; element: string; date: string | null; group_id: string }>;
  return {
    projectId,
    mode: row.mode as RoadmapMode,
    kickoffDate: row.kickoff_date,
    goliveDate: row.golive_date,
    outcomesDate: row.outcomes_date,
    releases: releases.map((r) => ({ releaseNo: r.release_no, date: r.date, name: r.name })),
    adkarMilestones: milestones.map((m) => ({
      releaseNo: m.release_no,
      element: m.element,
      date: m.date,
      groupId: m.group_id === '' ? null : m.group_id,
    })),
  };
}

export function updateRoadmap(
  db: Db,
  projectId: string,
  input: {
    mode?: RoadmapMode;
    kickoffDate?: string | null;
    goliveDate?: string | null;
    outcomesDate?: string | null;
    releases?: Array<{ releaseNo: number; date?: string | null; name?: string | null }>;
    adkarMilestones?: Array<{ releaseNo: number; element: string; date: string | null; groupId?: string | null }>;
  },
): Roadmap {
  const current = getRoadmap(db, projectId);
  for (const m of input.adkarMilestones ?? []) {
    if (m.groupId) {
      const group = db.prepare('SELECT project_id FROM impacted_groups WHERE id = ?').get(m.groupId) as
        | { project_id: string }
        | undefined;
      if (!group || group.project_id !== projectId) {
        throw new HttpError(400, 'groupId does not belong to this project');
      }
    }
  }
  db.transaction(() => {
    db.prepare(
      `UPDATE roadmaps SET mode = ?, kickoff_date = ?, golive_date = ?, outcomes_date = ? WHERE project_id = ?`,
    ).run(
      input.mode ?? current.mode,
      input.kickoffDate !== undefined ? input.kickoffDate : current.kickoffDate,
      input.goliveDate !== undefined ? input.goliveDate : current.goliveDate,
      input.outcomesDate !== undefined ? input.outcomesDate : current.outcomesDate,
      projectId,
    );
    if (input.releases) {
      const stmt = db.prepare(
        `INSERT INTO roadmap_releases (project_id, release_no, date, name) VALUES (?, ?, ?, ?)
         ON CONFLICT(project_id, release_no) DO UPDATE SET
           date = CASE WHEN ? THEN excluded.date ELSE roadmap_releases.date END,
           name = CASE WHEN ? THEN excluded.name ELSE roadmap_releases.name END`,
      );
      for (const r of input.releases) {
        if (r.releaseNo >= 1 && r.releaseNo <= MAX_RELEASES) {
          stmt.run(
            projectId,
            r.releaseNo,
            r.date ?? null,
            r.name ?? null,
            r.date !== undefined ? 1 : 0,
            r.name !== undefined ? 1 : 0,
          );
        }
      }
    }
    if (input.adkarMilestones) {
      const stmt = db.prepare(
        `INSERT INTO roadmap_adkar_milestones (project_id, release_no, element, group_id, date) VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(project_id, release_no, element, group_id) DO UPDATE SET date = excluded.date`,
      );
      for (const m of input.adkarMilestones) {
        if ((ADKAR_ELEMENTS as readonly string[]).includes(m.element)) {
          stmt.run(projectId, m.releaseNo, m.element, m.groupId ?? '', m.date);
        }
      }
    }
  })();
  return getRoadmap(db, projectId);
}

/** Overall (release 0, no group) ADKAR milestone dates — the blueprint defaults. */
export function sequentialAdkarMilestones(db: Db, projectId: string): Record<string, string | null> {
  const roadmap = getRoadmap(db, projectId);
  const map: Record<string, string | null> = {};
  for (const element of ADKAR_ELEMENTS) {
    map[element] =
      roadmap.adkarMilestones.find((m) => m.releaseNo === 0 && m.element === element && m.groupId === null)?.date ??
      null;
  }
  return map;
}

/** Group-specific ADKAR milestone dates (release 0), used by group-scoped blueprints. */
export function groupAdkarMilestones(db: Db, projectId: string, groupId: string): Record<string, string | null> {
  const roadmap = getRoadmap(db, projectId);
  const map: Record<string, string | null> = {};
  for (const element of ADKAR_ELEMENTS) {
    map[element] =
      roadmap.adkarMilestones.find((m) => m.releaseNo === 0 && m.element === element && m.groupId === groupId)?.date ??
      null;
  }
  return map;
}
