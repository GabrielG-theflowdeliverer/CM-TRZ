import {
  adkarScoresFromResponses,
  barrierPoint,
  competencyTotal,
  pctScores,
  riskScores,
  sponsorInterpretation,
  type Assessment,
  type AssessmentType,
} from '@cmt/domain';
import { newId, nowIso, type Db } from '../../infra/db.js';
import { HttpError, notFound } from '../../infra/http.js';
import * as repo from './assessments.repo.js';
import { getProject } from '../projects/projects.service.js';

/** Derived, never-stored score block attached to API responses. */
export interface AssessmentComputed {
  pct?: ReturnType<typeof pctScores>;
  risk?: ReturnType<typeof riskScores>;
  adkar?: { scores: ReturnType<typeof adkarScoresFromResponses>; barrierPoint: string | null };
  competency?: { total: number; interpretation: string | null };
}

export type AssessmentWithComputed = Assessment & { computed: AssessmentComputed };

export function withComputed(a: Assessment): AssessmentWithComputed {
  const computed: AssessmentComputed = {};
  switch (a.type) {
    case 'pct':
      computed.pct = pctScores(a.responses);
      break;
    case 'risk':
      computed.risk = riskScores(a.responses);
      break;
    case 'adkar': {
      const scores = adkarScoresFromResponses(a.responses);
      computed.adkar = { scores, barrierPoint: barrierPoint(scores) };
      break;
    }
    case 'sponsor_competency': {
      const total = competencyTotal(Object.values(a.responses));
      computed.competency = { total, interpretation: sponsorInterpretation(total) };
      break;
    }
    case 'manager_competency': {
      const total = competencyTotal(Object.values(a.responses));
      computed.competency = { total, interpretation: null };
      break;
    }
  }
  return { ...a, computed };
}

export function listAssessments(
  db: Db,
  projectId: string,
  filter: { type?: string; subjectKind?: string; subjectId?: string },
): AssessmentWithComputed[] {
  getProject(db, projectId); // 404 when the project is unknown
  return repo.listAssessments(db, projectId, filter).map(withComputed);
}

export function getAssessment(db: Db, id: string): AssessmentWithComputed {
  const a = repo.getAssessment(db, id) ?? notFound('Assessment');
  return withComputed(a);
}

export function createAssessment(
  db: Db,
  projectId: string,
  input: {
    type: AssessmentType;
    subjectKind: string;
    subjectId?: string | null;
    label?: string | null;
    scheduledDate?: string | null;
    completedDate?: string | null;
    status?: string | null;
    notes?: string | null;
    copyFromLatest?: boolean;
  },
): AssessmentWithComputed {
  getProject(db, projectId);
  if (input.subjectKind !== 'project' && input.subjectKind !== 'person' && !input.subjectId) {
    throw new HttpError(400, `subjectId is required for subject kind "${input.subjectKind}"`);
  }
  const id = newId();
  const subjectId = input.subjectId ?? null;
  repo.insertAssessment(db, {
    id,
    projectId,
    type: input.type,
    subjectKind: input.subjectKind,
    subjectId,
    label: input.label ?? null,
    scheduledDate: input.scheduledDate ?? null,
    completedDate: input.completedDate ?? null,
    status: input.status ?? null,
    notes: input.notes ?? null,
    createdAt: nowIso(),
  });
  if (input.copyFromLatest) {
    const previous = repo
      .listAssessments(db, projectId, { type: input.type, subjectKind: input.subjectKind })
      .filter((a) => a.id !== id && a.subjectId === subjectId)
      .at(-1);
    if (previous) repo.upsertResponses(db, id, previous.responses);
  }
  return getAssessment(db, id);
}

export function updateAssessment(
  db: Db,
  id: string,
  fields: Parameters<typeof repo.updateAssessment>[2],
): AssessmentWithComputed {
  if (!repo.updateAssessment(db, id, fields)) notFound('Assessment');
  return getAssessment(db, id);
}

export function deleteAssessment(db: Db, id: string): void {
  if (!repo.deleteAssessment(db, id)) notFound('Assessment');
}

export function saveResponses(db: Db, id: string, responses: Record<string, number | null>): AssessmentWithComputed {
  const existing = repo.getAssessment(db, id) ?? notFound('Assessment');
  repo.upsertResponses(db, existing.id, responses);
  return getAssessment(db, id);
}

/**
 * Upsert the "current" ADKAR run for a group or role: used by the inline
 * ADKAR editors on the impact and roles pages. Creates a run on first save.
 */
export function upsertSubjectAdkar(
  db: Db,
  projectId: string,
  subjectKind: 'group' | 'role',
  subjectId: string,
  responses: Record<string, number | null>,
): AssessmentWithComputed {
  const latest = repo.latestAssessment(db, projectId, 'adkar', { kind: subjectKind, id: subjectId });
  if (latest) return saveResponses(db, latest.id, responses);
  const created = createAssessment(db, projectId, { type: 'adkar', subjectKind, subjectId });
  return saveResponses(db, created.id, responses);
}

export function latestAssessment(
  db: Db,
  projectId: string,
  type: AssessmentType,
  subject?: { kind: string; id: string | null },
): AssessmentWithComputed | null {
  const a = repo.latestAssessment(db, projectId, type, subject);
  return a ? withComputed(a) : null;
}
