import { z } from 'zod';
import { ACTIVITY_STATUSES, CM_PERF_STATUSES, TRACKING_SCHEDULES } from '../vocab/index.js';
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

export const CM_PERF_ITEM_KINDS = ['blueprint', 'plan', 'other'] as const;

export const cmPerfReportCreateSchema = z.object({
  name: z.string().min(1).max(300),
  date: nullableDate.optional(),
});

export const cmPerfReportUpdateSchema = z.object({
  name: z.string().min(1).max(300).optional(),
  date: nullableDate.optional(),
  status: z.enum(ACTIVITY_STATUSES).nullable().optional(),
});

export const cmPerfItemUpdateSchema = z.object({
  status: z.enum(CM_PERF_STATUSES).nullable().optional(),
  description: nullableText.optional(),
});

export interface CmPerfItem {
  id: string;
  reportId: string;
  position: number;
  kind: string;
  refId: string | null;
  label: string | null;
  status: string | null;
  description: string | null;
}

export interface CmPerfReport {
  id: string;
  projectId: string;
  name: string;
  date: string | null;
  status: string | null;
  createdAt: string;
  items: CmPerfItem[];
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
