import { ADKAR_ELEMENTS, MAX_RELEASES, type Roadmap, type RoadmapMode } from '@cmt/domain';
import type { Db } from '../../infra/db.js';
import { getProject } from '../projects/projects.service.js';
import { syncRoadmapPctSchedule } from '../assessments/assessments.service.js';
import * as repo from './roadmap.repo.js';
import { assertGroupInProject } from '../impact/impact.guards.js';

/** A project with no roadmap row yet reads as this — see getRoadmap. */
const DEFAULT_ROADMAP: Omit<repo.RoadmapRow, 'project_id'> = {
  mode: 'sequential',
  kickoff_date: null,
  golive_date: null,
  outcomes_date: null,
};

export function getRoadmap(db: Db, projectId: string): Roadmap {
  getProject(db, projectId);
  // A read must never write: synthesize the default roadmap in memory when no
  // row exists yet (the row is materialised on first edit, see ensureRoadmapRow).
  // This keeps GET side-effect-free, which the read-only share surface relies on.
  const row = repo.getRoadmapRow(db, projectId) ?? DEFAULT_ROADMAP;
  const releases = repo.listReleaseRows(db, projectId);
  const milestones = repo.listMilestoneRows(db, projectId);
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
  for (const m of input.adkarMilestones ?? []) assertGroupInProject(db, projectId, m.groupId);
  // Only real releases and real ADKAR elements are persisted; anything else is ignored.
  const releases = (input.releases ?? []).filter((r) => r.releaseNo >= 1 && r.releaseNo <= MAX_RELEASES);
  const milestones = (input.adkarMilestones ?? []).filter((m) =>
    (ADKAR_ELEMENTS as readonly string[]).includes(m.element),
  );
  db.transaction(() => {
    // Materialise the row on first edit so the update below has something to hit
    // (getRoadmap no longer creates it on read).
    repo.ensureRoadmapRow(db, projectId);
    repo.updateRoadmapRow(db, projectId, {
      mode: input.mode ?? current.mode,
      kickoffDate: input.kickoffDate !== undefined ? input.kickoffDate : current.kickoffDate,
      goliveDate: input.goliveDate !== undefined ? input.goliveDate : current.goliveDate,
      outcomesDate: input.outcomesDate !== undefined ? input.outcomesDate : current.outcomesDate,
    });
    repo.upsertReleases(db, projectId, releases);
    repo.upsertMilestones(db, projectId, milestones);
  })();
  const updated = getRoadmap(db, projectId);
  syncRoadmapPctSchedule(db, projectId, {
    kickoffDate: updated.kickoffDate,
    goliveDate: updated.goliveDate,
    outcomesDate: updated.outcomesDate,
  });
  return updated;
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
