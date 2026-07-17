import { z } from 'zod';
import { PLAN_TYPES } from '../vocab/index.js';
import { nullableDate } from './common.js';

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

/** Plan activities are unified activities linked via activity_plans. */
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
  activities: import('./activity.js').Activity[];
}
