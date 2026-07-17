import { z } from 'zod';
import { ROLE_INFLUENCE_LEVELS, ROLE_ROSTERS, ROLE_SUPPORT_LEVELS } from '../vocab/index.js';
import { nullableText } from './common.js';

export const roleCreateSchema = z.object({
  roster: z.enum(ROLE_ROSTERS),
  roleName: z.string().max(300).nullable().optional(),
  personName: z.string().max(300).nullable().optional(),
  roleDefinition: nullableText.optional(),
  support: z.enum(ROLE_SUPPORT_LEVELS).nullable().optional(),
  influence: z.enum(ROLE_INFLUENCE_LEVELS).nullable().optional(),
  activationTactics: nullableText.optional(),
  groupIds: z.array(z.string()).optional(),
});

export const roleUpdateSchema = roleCreateSchema.partial().extend({
  position: z.number().int().min(0).optional(),
});

export interface Role {
  id: string;
  projectId: string;
  roster: string;
  position: number;
  roleName: string | null;
  personName: string | null;
  roleDefinition: string | null;
  support: string | null;
  influence: string | null;
  activationTactics: string | null;
  groupIds: string[];
  adkar: Record<string, number | null>;
  adkarAssessmentId: string | null;
}
