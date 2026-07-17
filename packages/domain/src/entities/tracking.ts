import { z } from 'zod';
import { ACTIVITY_STATUSES, CM_PERF_STATUSES, CM_PERF_TYPES, TRACKING_SCHEDULES } from '../vocab/index.js';
import { nullableDate, nullableText } from './common.js';

export const trackingEntryCreateSchema = z.object({
  schedule: z.enum(TRACKING_SCHEDULES),
  scheduledDate: nullableDate.optional(),
  completedDate: nullableDate.optional(),
  description: nullableText.optional(),
  status: z.enum(ACTIVITY_STATUSES).nullable().optional(),
  results: nullableText.optional(),
  notes: nullableText.optional(),
});

export const trackingEntryUpdateSchema = trackingEntryCreateSchema.partial().extend({
  position: z.number().int().min(0).optional(),
});

export interface TrackingEntry {
  id: string;
  projectId: string;
  schedule: string;
  position: number;
  scheduledDate: string | null;
  completedDate: string | null;
  description: string | null;
  status: string | null;
  results: string | null;
  notes: string | null;
}

export const cmPerfEntryCreateSchema = z.object({
  type: z.enum(CM_PERF_TYPES).nullable().optional(),
  description: nullableText.optional(),
  scheduledDate: nullableDate.optional(),
  completedDate: nullableDate.optional(),
  status: z.enum(CM_PERF_STATUSES).nullable().optional(),
  notes: nullableText.optional(),
});

export const cmPerfEntryUpdateSchema = cmPerfEntryCreateSchema.partial().extend({
  position: z.number().int().min(0).optional(),
});

export interface CmPerfEntry {
  id: string;
  projectId: string;
  position: number;
  type: string | null;
  description: string | null;
  scheduledDate: string | null;
  completedDate: string | null;
  status: string | null;
  notes: string | null;
}

export const adaptActionCreateSchema = z.object({
  assessmentResults: nullableText.optional(),
  strengths: nullableText.optional(),
  opportunities: nullableText.optional(),
  observations: nullableText.optional(),
  implications: nullableText.optional(),
  actionSteps: nullableText.optional(),
  notes: nullableText.optional(),
});

export const adaptActionUpdateSchema = adaptActionCreateSchema.partial().extend({
  position: z.number().int().min(0).optional(),
});

export interface AdaptAction {
  id: string;
  projectId: string;
  position: number;
  assessmentResults: string | null;
  strengths: string | null;
  opportunities: string | null;
  observations: string | null;
  implications: string | null;
  actionSteps: string | null;
  notes: string | null;
}
