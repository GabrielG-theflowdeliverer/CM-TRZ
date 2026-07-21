import {
  ASPECT_KEYS,
  adkarScoresFromResponses,
  aspectsImpacted,
  barrierPoint,
  degreeOfImpact,
  type ImpactedGroup,
} from '@cmt/domain';
import { newId, type Db } from '../../infra/db.js';
import { HttpError, notFound } from '../../infra/http.js';
import * as repo from './impact.repo.js';
import { orgGroupExists } from '../org-groups/org-groups.repo.js';
import * as assessments from '../assessments/assessments.service.js';
import { getProject } from '../projects/projects.service.js';

export interface GroupWithComputed extends ImpactedGroup {
  computed: {
    aspectsImpacted: number;
    degreeOfImpact: number | null;
    barrierPoint: string | null;
    /** Latest group-scoped risk run results, if any. */
    risk: { assessmentId: string; cc: number | null; oa: number | null; quadrant: string | null } | null;
  };
}

function assembleGroup(db: Db, row: repo.GroupRow): GroupWithComputed {
  const aspects = repo.getAspects(db, row.id);
  const byKey = new Map(aspects.map((a) => [a.aspectKey, a]));
  // Present all ten aspects in canonical order, whether or not saved yet.
  const fullAspects = ASPECT_KEYS.map(
    (key) => byKey.get(key) ?? { aspectKey: key, yesterday: null, tomorrow: null, impact: null },
  );
  const latestAdkar = assessments.latestAssessment(db, row.project_id, 'adkar', { kind: 'group', id: row.id });
  const adkarScores = latestAdkar ? adkarScoresFromResponses(latestAdkar.responses) : {};
  const latestRisk = assessments.latestAssessment(db, row.project_id, 'risk', { kind: 'group', id: row.id });
  const impacts = fullAspects.map((a) => a.impact);
  return {
    id: row.id,
    projectId: row.project_id,
    position: row.position,
    name: row.name,
    numPeople: row.num_people,
    adoptionUsageDefinition: row.adoption_usage_definition,
    uniqueConsiderations: row.unique_considerations,
    tags: repo.parseTags(row.tags),
    orgGroupId: row.org_group_id,
    aspects: fullAspects,
    adkar: Object.fromEntries(Object.entries(adkarScores)),
    adkarAssessmentId: latestAdkar?.id ?? null,
    computed: {
      aspectsImpacted: aspectsImpacted(impacts),
      degreeOfImpact: degreeOfImpact(impacts),
      barrierPoint: barrierPoint(adkarScores),
      risk: latestRisk?.computed.risk
        ? { assessmentId: latestRisk.id, ...latestRisk.computed.risk }
        : null,
    },
  };
}

export function listGroups(db: Db, projectId: string): GroupWithComputed[] {
  getProject(db, projectId);
  return repo.listGroupRows(db, projectId).map((row) => assembleGroup(db, row));
}

export function getGroup(db: Db, id: string): GroupWithComputed {
  const row = repo.getGroupRow(db, id) ?? notFound('Impacted group');
  return assembleGroup(db, row);
}

export function createGroup(
  db: Db,
  projectId: string,
  input: {
    name: string;
    numPeople?: number | null;
    adoptionUsageDefinition?: string | null;
    uniqueConsiderations?: string | null;
    tags?: string[];
  },
): GroupWithComputed {
  getProject(db, projectId);
  const id = newId();
  repo.insertGroup(db, {
    id,
    projectId,
    position: repo.nextGroupPosition(db, projectId),
    name: input.name,
    numPeople: input.numPeople ?? null,
    adoptionUsageDefinition: input.adoptionUsageDefinition ?? null,
    uniqueConsiderations: input.uniqueConsiderations ?? null,
    tags: input.tags ?? [],
  });
  return getGroup(db, id);
}

export function updateGroup(
  db: Db,
  id: string,
  fields: Parameters<typeof repo.updateGroup>[2],
): GroupWithComputed {
  // Friendly 400 instead of an FK constraint blowing up as a 500.
  if (typeof fields.orgGroupId === 'string' && !orgGroupExists(db, fields.orgGroupId)) {
    throw new HttpError(400, 'Unknown org group');
  }
  if (!repo.updateGroup(db, id, fields)) notFound('Impacted group');
  return getGroup(db, id);
}

export function deleteGroup(db: Db, id: string): void {
  const row = repo.getGroupRow(db, id) ?? notFound('Impacted group');
  db.transaction(() => {
    // ADKAR/risk runs are keyed polymorphically; group milestone rows have no FK
    // (group_id '' means overall) — clean both up alongside the group.
    db.prepare(`DELETE FROM assessments WHERE subject_kind = 'group' AND subject_id = ?`).run(row.id);
    db.prepare(`DELETE FROM roadmap_adkar_milestones WHERE group_id = ?`).run(row.id);
    repo.deleteGroup(db, id);
  })();
}

export function saveAspects(
  db: Db,
  groupId: string,
  aspects: Array<{ aspectKey: string; yesterday?: string | null; tomorrow?: string | null; impact?: number | null }>,
): GroupWithComputed {
  const row = repo.getGroupRow(db, groupId) ?? notFound('Impacted group');
  repo.upsertAspects(db, row.id, aspects);
  return getGroup(db, groupId);
}

export function saveGroupAdkar(
  db: Db,
  groupId: string,
  responses: Record<string, number | null>,
): GroupWithComputed {
  const row = repo.getGroupRow(db, groupId) ?? notFound('Impacted group');
  assessments.upsertSubjectAdkar(db, row.project_id, 'group', row.id, responses);
  return getGroup(db, groupId);
}
