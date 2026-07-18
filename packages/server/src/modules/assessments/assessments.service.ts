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
import * as surveys from '../surveys/surveys.service.js';

/** Derived, never-stored score block attached to API responses. */
export interface AssessmentComputed {
  pct?: ReturnType<typeof pctScores>;
  risk?: ReturnType<typeof riskScores>;
  adkar?: { scores: ReturnType<typeof adkarScoresFromResponses>; barrierPoint: string | null };
  competency?: { total: number; interpretation: string | null };
}

/** Survey roll-up attached when an assessment is fed by a survey campaign. */
export interface AssessmentSurveyView {
  respondentCount: number;
  individuals: Array<{
    personName: string;
    responses: Record<string, number | null>;
    computed: AssessmentComputed;
  }>;
}

export type AssessmentWithComputed = Assessment & {
  computed: AssessmentComputed;
  survey?: AssessmentSurveyView;
};

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

/**
 * Present an assessment for reading. When a survey campaign has collected
 * submissions for it, the aggregated survey responses supersede the
 * practitioner's hand-entered ones for scoring (notes and other fields are
 * untouched), and each individual's own submission is attached. This is
 * the single point where survey roll-up is applied, so every consumer
 * (dashboard, exports, roadmap) sees the same value. Nothing is stored — the
 * hand-entered responses remain in the table and reappear if the campaign is
 * removed.
 */
function present(db: Db, a: Assessment): AssessmentWithComputed {
  const survey = surveys.getAssessmentSurvey(db, a.id);
  if (!survey) return withComputed(a);
  const rolledUp = withComputed({ ...a, responses: survey.responses });
  return {
    ...rolledUp,
    survey: {
      respondentCount: survey.respondentCount,
      individuals: survey.individuals.map((i) => ({
        personName: i.personName,
        responses: i.responses,
        computed: withComputed({ ...a, responses: i.responses }).computed,
      })),
    },
  };
}

export function listAssessments(
  db: Db,
  projectId: string,
  filter: { type?: string; subjectKind?: string; subjectId?: string },
): AssessmentWithComputed[] {
  getProject(db, projectId); // 404 when the project is unknown
  return repo.listAssessments(db, projectId, filter).map((a) => present(db, a));
}

export function getAssessment(db: Db, id: string): AssessmentWithComputed {
  const a = repo.getAssessment(db, id) ?? notFound('Assessment');
  return present(db, a);
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
  return a ? present(db, a) : null;
}

/**
 * Roadmap-driven scheduling (official Proxima behavior): keep three named PCT
 * runs in sync with the roadmap's key dates. Idempotent by label; completed
 * runs are left untouched.
 */
export function syncRoadmapPctSchedule(
  db: Db,
  projectId: string,
  dates: { kickoffDate: string | null; goliveDate: string | null; outcomesDate: string | null },
): void {
  const schedule: Array<{ label: string; date: string | null }> = [
    { label: 'Project Kickoff Assessment', date: dates.kickoffDate },
    { label: 'Go Live/Launch Assessment', date: dates.goliveDate },
    { label: 'Outcomes Assessment', date: dates.outcomesDate },
  ];
  const existing = repo.listAssessments(db, projectId, { type: 'pct' });
  for (const item of schedule) {
    const run = existing.find((a) => a.label === item.label);
    if (run) {
      if (run.status !== 'Completed' && run.scheduledDate !== item.date) {
        repo.updateAssessment(db, run.id, { scheduledDate: item.date });
      }
    } else if (item.date) {
      repo.insertAssessment(db, {
        id: newId(),
        projectId,
        type: 'pct',
        subjectKind: 'project',
        subjectId: null,
        label: item.label,
        scheduledDate: item.date,
        completedDate: null,
        status: 'Not Started',
        notes: null,
        createdAt: nowIso(),
      });
    }
  }
}
