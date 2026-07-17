import { z } from 'zod';
import { ADKAR_ELEMENTS } from '../content/adkar.js';
import { nullableDate } from './common.js';

export const ROADMAP_MODES = ['sequential', 'iterative'] as const;
export type RoadmapMode = (typeof ROADMAP_MODES)[number];

/** Release 0 = the sequential milestone set; releases 1-8 are iterative. */
export const MAX_RELEASES = 8;

export const roadmapUpdateSchema = z.object({
  mode: z.enum(ROADMAP_MODES).optional(),
  kickoffDate: nullableDate.optional(),
  goliveDate: nullableDate.optional(),
  outcomesDate: nullableDate.optional(),
  releases: z
    .array(
      z.object({
        releaseNo: z.number().int().min(1).max(MAX_RELEASES),
        date: nullableDate.optional(),
        name: z.string().max(300).nullable().optional(),
      }),
    )
    .optional(),
  adkarMilestones: z
    .array(
      z.object({
        releaseNo: z.number().int().min(0).max(MAX_RELEASES),
        element: z.enum(ADKAR_ELEMENTS),
        date: nullableDate,
        /** Impacted group the milestone belongs to; omitted/null = overall change. */
        groupId: z.string().nullable().optional(),
      }),
    )
    .optional(),
});

export interface Roadmap {
  projectId: string;
  mode: RoadmapMode;
  kickoffDate: string | null;
  goliveDate: string | null;
  outcomesDate: string | null;
  releases: Array<{ releaseNo: number; date: string | null; name: string | null }>;
  adkarMilestones: Array<{ releaseNo: number; element: string; date: string | null; groupId: string | null }>;
}
