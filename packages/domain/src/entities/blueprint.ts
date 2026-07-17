import { z } from 'zod';
import { ADKAR_ELEMENTS } from '../content/adkar.js';
import { ACTIVITY_STATUSES, GAUGE_GAPS } from '../vocab/index.js';
import { nullableDate, nullableText } from './common.js';

export const BLUEPRINT_SCOPES = ['overall', 'group', 'custom'] as const;
export type BlueprintScope = (typeof BLUEPRINT_SCOPES)[number];

export const blueprintCreateSchema = z.object({
  scopeKind: z.enum(BLUEPRINT_SCOPES),
  groupId: z.string().nullable().optional(),
  name: z.string().min(1).max(300),
  notes: nullableText.optional(),
});

export const blueprintUpdateSchema = z.object({
  name: z.string().min(1).max(300).optional(),
  notes: nullableText.optional(),
});

export const blueprintElementSchema = z.object({
  element: z.enum(ADKAR_ELEMENTS),
  milestoneOverrideDate: nullableDate.optional(),
  gaugeGap: z.enum(GAUGE_GAPS).nullable().optional(),
});

export const blueprintActivityCreateSchema = z.object({
  element: z.enum(ADKAR_ELEMENTS),
  name: nullableText.optional(),
  rolesRequired: nullableText.optional(),
  startDate: nullableDate.optional(),
  finishDate: nullableDate.optional(),
  status: z.enum(ACTIVITY_STATUSES).nullable().optional(),
});

export const blueprintActivityUpdateSchema = blueprintActivityCreateSchema.partial().extend({
  position: z.number().int().min(0).optional(),
});

export const snapshotCreateSchema = z.object({
  label: z.string().min(1).max(300),
});

export interface BlueprintActivity {
  id: string;
  blueprintId: string;
  element: string;
  position: number;
  name: string | null;
  rolesRequired: string | null;
  startDate: string | null;
  finishDate: string | null;
  status: string | null;
}

export interface BlueprintElement {
  element: string;
  milestoneOverrideDate: string | null;
  gaugeGap: string | null;
}

export interface Blueprint {
  id: string;
  projectId: string;
  scopeKind: string;
  groupId: string | null;
  name: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  elements: BlueprintElement[];
  activities: BlueprintActivity[];
}

export interface BlueprintSnapshot {
  id: string;
  blueprintId: string;
  label: string;
  takenAt: string;
  payload: unknown;
}
