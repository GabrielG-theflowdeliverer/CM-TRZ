import {
  aggregateResponses,
  type AssessmentType,
  type SurveyCampaign,
  type SurveyCampaignSummary,
  type SurveyRecipient,
} from '@cmt/domain';
import { isoInDays, newId, newToken, nowIso, type Db } from '../../infra/db.js';
import { HttpError, notFound } from '../../infra/http.js';

/**
 * How long a survey campaign's recipient links stay valid after it opens.
 * Short by design: a survey is sent a few days before the facilitation session,
 * collected, then closed — it isn't a standing link.
 */
export const SURVEY_LINK_TTL_DAYS = 5;
import * as repo from './surveys.repo.js';
import * as assessmentsRepo from '../assessments/assessments.repo.js';
import { getRoleRow } from '../roles/roles.repo.js';

function toRecipient(row: repo.RecipientRow): SurveyRecipient {
  return {
    id: row.id,
    roleId: row.role_id,
    personName: row.person_name,
    roleName: row.role_name,
    token: row.token,
    submittedAt: row.submitted_at,
    expiresAt: row.expires_at,
  };
}

/**
 * Open a campaign that distributes `assessmentId` to the given roles. Every
 * role must belong to the project and name a person — recipients are always
 * confirmed role-holders, never anonymous or impacted-group populations.
 */
export function createCampaign(
  db: Db,
  projectId: string,
  input: { assessmentId: string; roleIds: string[] },
): SurveyCampaign {
  const assessment = assessmentsRepo.getAssessment(db, input.assessmentId);
  if (!assessment || assessment.projectId !== projectId) notFound('Assessment');

  // One campaign per assessment: the roll-up aggregates every submission for
  // the assessment, and the UI surfaces a single campaign, so a second would
  // silently double-count and hide recipients.
  if (repo.hasCampaignForAssessment(db, input.assessmentId)) {
    throw new HttpError(409, 'A survey campaign already exists for this assessment');
  }

  const roles = [...new Set(input.roleIds)].map((roleId) => {
    const role = getRoleRow(db, roleId);
    if (!role || role.project_id !== projectId) {
      throw new HttpError(400, `Role ${roleId} is not in this project`);
    }
    if (!role.person_name) {
      throw new HttpError(400, `Role ${roleId} has no named person to survey`);
    }
    return { id: role.id, personName: role.person_name };
  });

  const id = newId();
  const createdAt = nowIso();
  const expiresAt = isoInDays(SURVEY_LINK_TTL_DAYS);
  db.transaction(() => {
    repo.insertCampaign(db, { id, projectId, assessmentId: input.assessmentId, createdAt });
    for (const role of roles) {
      repo.insertRecipient(db, {
        id: newId(),
        campaignId: id,
        roleId: role.id,
        personName: role.personName,
        token: newToken(),
        expiresAt,
      });
    }
  })();
  return getCampaign(db, id);
}

export function getCampaign(db: Db, id: string): SurveyCampaign {
  const c = repo.getCampaignRow(db, id) ?? notFound('Campaign');
  return {
    id: c.id,
    projectId: c.project_id,
    assessmentId: c.assessment_id,
    createdAt: c.created_at,
    recipients: repo.listRecipientRows(db, id).map(toRecipient),
  };
}

/**
 * What a respondent sees for their tokened link — just their name and the
 * survey to fill, never any other project data. `responses` is empty until
 * they submit (there is no cross-session draft); after submit it's read-only.
 */
export interface SurveyView {
  personName: string;
  assessmentType: AssessmentType;
  assessmentLabel: string | null;
  submitted: boolean;
  responses: Record<string, number | null>;
}

/**
 * Re-issue a single recipient's link — a fresh token and a fresh expiry —
 * leaving every other recipient untouched. For when one link lapses or is lost;
 * beats rotating the whole campaign (which would invalidate everyone's links).
 */
export function regenerateRecipient(db: Db, recipientId: string): SurveyRecipient {
  const existing = repo.getRecipientRow(db, recipientId) ?? notFound('Recipient');
  repo.regenerateRecipientToken(db, existing.id, newToken(), isoInDays(SURVEY_LINK_TTL_DAYS));
  return toRecipient(repo.getRecipientRow(db, recipientId)!);
}

/** Resolve a recipient token to its row, 404ing unknown tokens and 410ing expired ones. */
function resolveRecipient(db: Db, token: string): repo.RecipientByTokenRow {
  const row = repo.getRecipientByToken(db, token) ?? notFound('Survey');
  if (row.expires_at !== null && row.expires_at <= nowIso()) {
    throw new HttpError(410, 'This survey link has expired');
  }
  return row;
}

export function getSurveyByToken(db: Db, token: string): SurveyView {
  const row = resolveRecipient(db, token);
  return {
    personName: row.person_name,
    assessmentType: row.assessment_type as AssessmentType,
    assessmentLabel: row.assessment_label,
    submitted: row.submitted_at !== null,
    responses: row.submitted_at ? repo.getRecipientResponses(db, row.id) : {},
  };
}

/** Final, one-time submission. Rejects a second submit (submit-once). */
export function submitSurvey(db: Db, token: string, responses: Record<string, number | null>): SurveyView {
  const row = resolveRecipient(db, token);
  if (row.submitted_at !== null) throw new HttpError(409, 'This survey has already been submitted');
  db.transaction(() => {
    repo.upsertResponses(db, row.id, responses);
    repo.markSubmitted(db, row.id, nowIso());
  })();
  return getSurveyByToken(db, token);
}

/** One respondent's submitted answers. */
export interface SurveyIndividual {
  personName: string;
  responses: Record<string, number | null>;
}

/**
 * The survey roll-up for an assessment: the aggregated responses (which
 * supersede the practitioner's hand-entered ones for scoring) and each
 * individual's own submission. Null when nobody has submitted yet — the
 * assessment then falls back to its own responses.
 */
export interface AssessmentSurvey {
  respondentCount: number;
  responses: Record<string, number | null>;
  individuals: SurveyIndividual[];
}

export function getAssessmentSurvey(db: Db, assessmentId: string): AssessmentSurvey | null {
  const submitted = repo.listSubmittedForAssessment(db, assessmentId);
  if (submitted.length === 0) return null;
  const agg = aggregateResponses(submitted.map((s) => s.responses));
  return {
    respondentCount: submitted.length,
    responses: agg.mean,
    individuals: submitted.map((s) => ({ personName: s.personName, responses: s.responses })),
  };
}

/**
 * Remove a campaign and its recipients/responses. The assessment's roll-up
 * disappears with it, so its scoring falls back to the practitioner's
 * hand-entered responses (which were never overwritten), and a new campaign
 * may then be launched — e.g. a quarterly re-run.
 */
export function deleteCampaign(db: Db, id: string): void {
  if (!repo.deleteCampaign(db, id)) notFound('Campaign');
}

export function listCampaigns(db: Db, projectId: string): SurveyCampaignSummary[] {
  return repo.listCampaignRows(db, projectId).map((c) => {
    const counts = repo.recipientCounts(db, c.id);
    return {
      id: c.id,
      assessmentId: c.assessment_id,
      createdAt: c.created_at,
      recipientCount: counts.total,
      submittedCount: counts.submitted,
    };
  });
}
