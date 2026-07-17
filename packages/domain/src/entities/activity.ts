import { z } from 'zod';
import { ADKAR_ELEMENTS } from '../content/adkar.js';
import { ACTIVITY_STATUSES } from '../vocab/index.js';
import { nullableDate, nullableText } from './common.js';

/**
 * Unified activity: one entity viewable from the ADKAR Blueprint perspective
 * (via adkarOutcomes), the CM Plan perspective (via planIds), by impacted
 * group, by roster role, or by status — mirroring official Proxima's
 * "Blueprints and Plans" interconnection.
 */
export const activityCreateSchema = z.object({
  name: nullableText.optional(),
  methodMechanism: nullableText.optional(),
  rolesRequiredText: nullableText.optional(),
  responsible: nullableText.optional(),
  startDate: nullableDate.optional(),
  finishDate: nullableDate.optional(),
  status: z.enum(ACTIVITY_STATUSES).nullable().optional(),
  resultFeedback: nullableText.optional(),
  /** Activity targets the overall change (in addition to specific groups). */
  overall: z.boolean().optional(),
  adkarOutcomes: z.array(z.enum(ADKAR_ELEMENTS)).optional(),
  groupIds: z.array(z.string()).optional(),
  planIds: z.array(z.string()).optional(),
  blueprintIds: z.array(z.string()).optional(),
  roleIds: z.array(z.string()).optional(),
});

export const activityUpdateSchema = activityCreateSchema.extend({
  position: z.number().int().min(0).optional(),
});

export interface Activity {
  id: string;
  projectId: string;
  position: number;
  name: string | null;
  methodMechanism: string | null;
  rolesRequiredText: string | null;
  responsible: string | null;
  startDate: string | null;
  finishDate: string | null;
  status: string | null;
  resultFeedback: string | null;
  overall: boolean;
  adkarOutcomes: string[];
  groupIds: string[];
  planIds: string[];
  blueprintIds: string[];
  roleIds: string[];
}

export const ACTIVITY_GROUP_BY = ['adkar', 'plan', 'group', 'role', 'status'] as const;
export type ActivityGroupBy = (typeof ACTIVITY_GROUP_BY)[number];

export const ACTIVITY_GROUP_BY_LABELS: Record<ActivityGroupBy, string> = {
  adkar: 'ADKAR Outcomes',
  plan: 'Plan',
  group: 'Impacted Group',
  role: 'Role(s) Required',
  status: 'Status',
};
