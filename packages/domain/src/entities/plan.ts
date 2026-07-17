import { z } from 'zod';
import { ADKAR_ELEMENTS } from '../content/adkar.js';
import { ACTIVITY_STATUSES, PLAN_TYPES } from '../vocab/index.js';
import { nullableDate, nullableText } from './common.js';

export const PLAN_KINDS = ['core', 'extend'] as const;
export type PlanKind = (typeof PLAN_KINDS)[number];

export const planCreateSchema = z.object({
  kind: z.enum(PLAN_KINDS).default('extend'),
  name: z.string().min(1).max(300),
  planType: z.enum(PLAN_TYPES).nullable().optional(),
  sponsor: z.string().max(300).nullable().optional(),
  practitioner: z.string().max(300).nullable().optional(),
});

export const planUpdateSchema = z.object({
  name: z.string().min(1).max(300).optional(),
  planType: z.enum(PLAN_TYPES).nullable().optional(),
  sponsor: z.string().max(300).nullable().optional(),
  practitioner: z.string().max(300).nullable().optional(),
  lastUpdated: nullableDate.optional(),
  position: z.number().int().min(0).optional(),
});

export const planActivityCreateSchema = z.object({
  name: nullableText.optional(),
  adkarOutcome: z.enum(ADKAR_ELEMENTS).nullable().optional(),
  groupId: z.string().nullable().optional(),
  methodMechanism: nullableText.optional(),
  rolesRequired: nullableText.optional(),
  responsible: nullableText.optional(),
  startDate: nullableDate.optional(),
  finishDate: nullableDate.optional(),
  status: z.enum(ACTIVITY_STATUSES).nullable().optional(),
  resultFeedback: nullableText.optional(),
});

export const planActivityUpdateSchema = planActivityCreateSchema.partial().extend({
  position: z.number().int().min(0).optional(),
});

export interface PlanActivity {
  id: string;
  planId: string;
  position: number;
  name: string | null;
  adkarOutcome: string | null;
  groupId: string | null;
  methodMechanism: string | null;
  rolesRequired: string | null;
  responsible: string | null;
  startDate: string | null;
  finishDate: string | null;
  status: string | null;
  resultFeedback: string | null;
}

export interface Plan {
  id: string;
  projectId: string;
  kind: PlanKind;
  name: string;
  planType: string | null;
  sponsor: string | null;
  practitioner: string | null;
  lastUpdated: string | null;
  position: number;
  activities: PlanActivity[];
}
