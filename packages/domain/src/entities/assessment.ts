import { z } from 'zod';
import { PCT_ITEM_KEYS } from '../content/pctFactors.js';
import { RISK_ITEM_KEYS } from '../content/riskFactors.js';
import { ADKAR_ITEM_KEYS } from '../content/adkar.js';
import { MANAGER_COMPETENCY_ITEM_KEYS, SPONSOR_COMPETENCY_ITEM_KEYS } from '../content/competencyItems.js';
import { nullableDate, nullableText } from './common.js';

export const ASSESSMENT_TYPES = ['pct', 'risk', 'adkar', 'sponsor_competency', 'manager_competency'] as const;
export type AssessmentType = (typeof ASSESSMENT_TYPES)[number];

export const ASSESSMENT_TYPE_LABELS: Record<AssessmentType, string> = {
  pct: 'PCT Assessment',
  risk: 'Risk Assessment',
  adkar: 'ADKAR Assessment',
  sponsor_competency: 'Sponsor Competency Assessment',
  manager_competency: 'Manager Competency Assessment',
};

export const SUBJECT_KINDS = ['project', 'group', 'role', 'person'] as const;
export type SubjectKind = (typeof SUBJECT_KINDS)[number];

export const ASSESSMENT_STATUSES = ['Not Started', 'In Progress', 'Completed'] as const;

/** Valid item keys per assessment type. */
export const ITEM_KEYS_BY_TYPE: Record<AssessmentType, readonly string[]> = {
  pct: PCT_ITEM_KEYS,
  risk: RISK_ITEM_KEYS,
  adkar: ADKAR_ITEM_KEYS,
  sponsor_competency: SPONSOR_COMPETENCY_ITEM_KEYS,
  manager_competency: MANAGER_COMPETENCY_ITEM_KEYS,
};

/** Valid score range per assessment type (inclusive, integers). */
export const SCORE_RANGE_BY_TYPE: Record<AssessmentType, { min: number; max: number }> = {
  pct: { min: 1, max: 3 },
  risk: { min: 1, max: 5 },
  adkar: { min: 1, max: 5 },
  sponsor_competency: { min: 1, max: 5 },
  manager_competency: { min: 1, max: 5 },
};

export const assessmentCreateSchema = z.object({
  type: z.enum(ASSESSMENT_TYPES),
  subjectKind: z.enum(SUBJECT_KINDS).default('project'),
  subjectId: z.string().nullable().optional(),
  label: z.string().max(300).nullable().optional(),
  scheduledDate: nullableDate.optional(),
  completedDate: nullableDate.optional(),
  status: z.enum(ASSESSMENT_STATUSES).nullable().optional(),
  notes: nullableText.optional(),
});

export const assessmentUpdateSchema = z.object({
  label: z.string().max(300).nullable().optional(),
  scheduledDate: nullableDate.optional(),
  completedDate: nullableDate.optional(),
  status: z.enum(ASSESSMENT_STATUSES).nullable().optional(),
  notes: nullableText.optional(),
});

/** Bulk response upsert: `{ "pct.success.1": 3, "pct.success.2": null }`. */
export function responsesSchemaFor(type: AssessmentType) {
  const { min, max } = SCORE_RANGE_BY_TYPE[type];
  const validKeys = new Set(ITEM_KEYS_BY_TYPE[type]);
  return z
    .record(z.string(), z.number().int().min(min).max(max).nullable())
    .superRefine((record, ctx) => {
      for (const key of Object.keys(record)) {
        if (!validKeys.has(key)) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Unknown item key for ${type}: ${key}` });
        }
      }
    });
}

export interface Assessment {
  id: string;
  projectId: string;
  type: AssessmentType;
  subjectKind: SubjectKind;
  subjectId: string | null;
  label: string | null;
  scheduledDate: string | null;
  completedDate: string | null;
  status: string | null;
  notes: string | null;
  createdAt: string;
  responses: Record<string, number | null>;
}
