import type { Db } from '../../infra/db.js';

export interface CampaignRow {
  id: string;
  project_id: string;
  assessment_id: string;
  created_at: string;
}

/** Recipient joined with its (possibly-removed) role's live label. */
export interface RecipientRow {
  id: string;
  campaign_id: string;
  role_id: string | null;
  person_name: string;
  token: string;
  submitted_at: string | null;
  role_name: string | null;
}

export function insertCampaign(
  db: Db,
  r: { id: string; projectId: string; assessmentId: string; createdAt: string },
): void {
  db.prepare(
    `INSERT INTO survey_campaigns (id, project_id, assessment_id, created_at) VALUES (?, ?, ?, ?)`,
  ).run(r.id, r.projectId, r.assessmentId, r.createdAt);
}

export function insertRecipient(
  db: Db,
  r: { id: string; campaignId: string; roleId: string; personName: string; token: string },
): void {
  db.prepare(
    `INSERT INTO survey_recipients (id, campaign_id, role_id, person_name, token) VALUES (?, ?, ?, ?, ?)`,
  ).run(r.id, r.campaignId, r.roleId, r.personName, r.token);
}

export function getCampaignRow(db: Db, id: string): CampaignRow | null {
  return (db.prepare('SELECT * FROM survey_campaigns WHERE id = ?').get(id) as CampaignRow | undefined) ?? null;
}

export function listCampaignRows(db: Db, projectId: string): CampaignRow[] {
  return db
    .prepare('SELECT * FROM survey_campaigns WHERE project_id = ? ORDER BY created_at DESC, rowid DESC')
    .all(projectId) as CampaignRow[];
}

export function listRecipientRows(db: Db, campaignId: string): RecipientRow[] {
  return db
    .prepare(
      `SELECT sr.*, r.role_name
         FROM survey_recipients sr
         LEFT JOIN roles r ON r.id = sr.role_id
        WHERE sr.campaign_id = ?
        ORDER BY sr.person_name, sr.rowid`,
    )
    .all(campaignId) as RecipientRow[];
}

export function recipientCounts(db: Db, campaignId: string): { total: number; submitted: number } {
  return db
    .prepare(
      `SELECT COUNT(*) AS total,
              COUNT(submitted_at) AS submitted
         FROM survey_recipients WHERE campaign_id = ?`,
    )
    .get(campaignId) as { total: number; submitted: number };
}
