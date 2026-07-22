import { z } from 'zod';
import { ACTIVITY_STATUSES } from '../vocab/index.js';
import { nullableText } from './common.js';

/**
 * A reinforcement / sustainment action (Prosci Phase 3). Scoped to an impacted
 * group, or project-wide when groupId is null — the "act" side of the
 * measure → explain → act loop.
 */
export const reinforcementCreateSchema = z.object({
  groupId: z.string().nullable().optional(),
  mechanism: z.string().min(1).max(500),
  owner: z.string().max(200).nullable().optional(),
  status: z.enum(ACTIVITY_STATUSES).nullable().optional(),
  notes: nullableText.optional(),
});

export const reinforcementUpdateSchema = reinforcementCreateSchema.partial();

export interface ReinforcementAction {
  id: string;
  projectId: string;
  groupId: string | null;
  mechanism: string;
  owner: string | null;
  status: string | null;
  notes: string | null;
  createdAt: string;
}
