import { z } from 'zod';
import { ASPECT_KEYS } from '../content/aspectsOfChange.js';
import { nullableText } from './common.js';

export const aspectKeySchema = z.enum(ASPECT_KEYS);

export const groupAspectSchema = z.object({
  aspectKey: aspectKeySchema,
  yesterday: nullableText.optional(),
  tomorrow: nullableText.optional(),
  /** Degree of impact for this aspect: 0 = No Impact … 5 = Extremely High Impact. */
  impact: z.number().int().min(0).max(5).nullable().optional(),
});

export const groupCreateSchema = z.object({
  name: z.string().min(1).max(300),
  numPeople: z.number().int().min(0).nullable().optional(),
  adoptionUsageDefinition: nullableText.optional(),
  uniqueConsiderations: nullableText.optional(),
  tags: z.array(z.string().min(1).max(100)).max(20).optional(),
});

export const groupUpdateSchema = groupCreateSchema.partial().extend({
  position: z.number().int().min(0).optional(),
});

export const groupAspectsUpsertSchema = z.array(groupAspectSchema).max(ASPECT_KEYS.length);

export interface GroupAspect {
  aspectKey: string;
  yesterday: string | null;
  tomorrow: string | null;
  impact: number | null;
}

export interface ImpactedGroup {
  id: string;
  projectId: string;
  position: number;
  name: string;
  numPeople: number | null;
  adoptionUsageDefinition: string | null;
  uniqueConsiderations: string | null;
  tags: string[];
  aspects: GroupAspect[];
  /** Latest ADKAR run scores for the group (managed via the assessments engine). */
  adkar: Record<string, number | null>;
  adkarAssessmentId: string | null;
}
