import type { SurveyCampaign, SurveyCampaignSummary, SurveyRecipient } from '@cmt/domain';
import { newId, newToken, nowIso, type Db } from '../../infra/db.js';
import { HttpError, notFound } from '../../infra/http.js';
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
  db.transaction(() => {
    repo.insertCampaign(db, { id, projectId, assessmentId: input.assessmentId, createdAt });
    for (const role of roles) {
      repo.insertRecipient(db, {
        id: newId(),
        campaignId: id,
        roleId: role.id,
        personName: role.personName,
        token: newToken(),
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
