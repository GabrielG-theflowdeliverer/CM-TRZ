import { z } from 'zod';
import { nullableText } from './common.js';

/** Levels at which success is defined (Prosci: organizational / initiative / individual). */
export const OBJECTIVE_LEVELS = ['organization', 'initiative', 'individual'] as const;
export type ObjectiveLevel = (typeof OBJECTIVE_LEVELS)[number];

export const objectiveCreateSchema = z.object({
  level: z.enum(OBJECTIVE_LEVELS),
  statement: z.string().min(1).max(500),
  notes: nullableText.optional(),
});
export const objectiveUpdateSchema = objectiveCreateSchema.partial();

export interface Objective {
  id: string;
  projectId: string;
  level: ObjectiveLevel;
  statement: string;
  notes: string | null;
  createdAt: string;
}

/** Two metric families: adoption (people changed) and benefit (business value). */
export const METRIC_KINDS = ['adoption', 'benefit'] as const;
export type MetricKind = (typeof METRIC_KINDS)[number];

/** Prosci's three adoption metrics. */
export const ADOPTION_MEASURES = ['speed', 'utilization', 'proficiency'] as const;
export type AdoptionMeasure = (typeof ADOPTION_MEASURES)[number];

export const ADOPTION_MEASURE_LABELS: Record<AdoptionMeasure, string> = {
  speed: 'Speed of adoption',
  utilization: 'Ultimate utilization',
  proficiency: 'Proficiency',
};

/** Which direction of movement counts as progress toward the target. */
export const METRIC_DIRECTIONS = ['increase', 'decrease'] as const;
export type MetricDirection = (typeof METRIC_DIRECTIONS)[number];

export const metricCreateSchema = z
  .object({
    objectiveId: z.string().min(1),
    kind: z.enum(METRIC_KINDS),
    name: z.string().min(1).max(300),
    unit: z.string().max(50).nullable().optional(),
    baseline: z.number().nullable().optional(),
    target: z.number().nullable().optional(),
    direction: z.enum(METRIC_DIRECTIONS).default('increase'),
    /** Adoption metrics only: which of the three, and the group they measure. */
    adoptionMeasure: z.enum(ADOPTION_MEASURES).nullable().optional(),
    groupId: z.string().nullable().optional(),
  })
  .refine((m) => m.kind !== 'adoption' || m.adoptionMeasure != null, {
    message: 'adoption metrics require an adoptionMeasure',
    path: ['adoptionMeasure'],
  });

export const metricUpdateSchema = z.object({
  name: z.string().min(1).max(300).optional(),
  unit: z.string().max(50).nullable().optional(),
  baseline: z.number().nullable().optional(),
  target: z.number().nullable().optional(),
  direction: z.enum(METRIC_DIRECTIONS).optional(),
  groupId: z.string().nullable().optional(),
});

export interface Metric {
  id: string;
  projectId: string;
  objectiveId: string;
  kind: MetricKind;
  name: string;
  unit: string | null;
  baseline: number | null;
  target: number | null;
  direction: MetricDirection;
  adoptionMeasure: AdoptionMeasure | null;
  groupId: string | null;
  createdAt: string;
}

export const measurementCreateSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD'),
  value: z.number(),
});

export interface Measurement {
  id: string;
  metricId: string;
  date: string;
  value: number;
}
