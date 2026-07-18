import { z } from 'zod';
import { nullableText } from './common.js';

/** Structured free-text documents, one per methodology worksheet. */
export const DOC_KEYS = ['define_success', 'why_cm', 'resources'] as const;
export type DocKey = (typeof DOC_KEYS)[number];

/** `_status` is the page-completion marker ("Mark Complete" workflow). */
export const DOC_FIELDS: Record<DocKey, readonly string[]> = {
  define_success: ['project', 'purpose', 'particulars', 'people', 'adoption_percentage', '_status'],
  why_cm: [
    'speed_of_adoption',
    'ultimate_utilization',
    'proficiency',
    'human_factors_notes',
    'people_dependent_roi',
    'investment',
    'roi_notes',
    'cost_individuals',
    'risk_individuals',
    'cost_project',
    'risk_project',
    'cost_organization',
    'risk_organization',
    'cost_results',
    'risk_results',
    '_status',
  ],
  resources: [
    'governance_description',
    'advantages',
    'implications',
    'sponsor_access',
    'action_items',
    'budget_prepare',
    'budget_manage',
    'budget_sustain',
    'budget_source',
    'budget_sufficiency',
    'notes',
    '_status',
  ],
};

export function docUpsertSchemaFor(docKey: DocKey) {
  const valid = new Set(DOC_FIELDS[docKey]);
  return z.record(z.string(), z.string().max(20000).nullable()).superRefine((record, ctx) => {
    for (const key of Object.keys(record)) {
      if (!valid.has(key)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Unknown field for ${docKey}: ${key}` });
      }
    }
  });
}

export const resistanceItemCreateSchema = z.object({
  groupId: z.string().nullable().optional(),
  groupLabel: z.string().max(300).nullable().optional(),
  anticipatedResistance: nullableText.optional(),
  specialTactics: nullableText.optional(),
});

export const resistanceItemUpdateSchema = resistanceItemCreateSchema.partial().extend({
  position: z.number().int().min(0).optional(),
});

export interface ResistanceItem {
  id: string;
  projectId: string;
  position: number;
  groupId: string | null;
  groupLabel: string | null;
  anticipatedResistance: string | null;
  specialTactics: string | null;
}
