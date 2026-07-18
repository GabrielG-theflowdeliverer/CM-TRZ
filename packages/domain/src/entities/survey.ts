import { z } from 'zod';

/**
 * A survey campaign distributes one existing assessment to a set of
 * role-holders, each of whom fills it via their own tokenized link. Recipients
 * are always people who hold a confirmed role in the project (identity comes
 * from the role roster); the app never surveys anonymous or impacted-group
 * populations.
 */
export const campaignCreateSchema = z.object({
  assessmentId: z.string().min(1),
  /** Roles to invite. Each must belong to the project and name a person. */
  roleIds: z.array(z.string().min(1)).min(1),
});

export interface SurveyRecipient {
  id: string;
  /** The role this invite came from; null if that role was later removed. */
  roleId: string | null;
  /** Person's name, snapshotted at invite time so it survives roster edits. */
  personName: string;
  /** Live role label for display; null if the role was removed. */
  roleName: string | null;
  /** Opaque link token. */
  token: string;
  submittedAt: string | null;
}

export interface SurveyCampaign {
  id: string;
  projectId: string;
  assessmentId: string;
  createdAt: string;
  recipients: SurveyRecipient[];
}

/** Lightweight row for listing a project's campaigns with response progress. */
export interface SurveyCampaignSummary {
  id: string;
  assessmentId: string;
  createdAt: string;
  recipientCount: number;
  submittedCount: number;
}
