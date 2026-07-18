import { z } from 'zod';
import { PM_APPROACHES, PROJECT_STATUSES } from '../vocab/index.js';

export const pmApproachSchema = z.enum(PM_APPROACHES);

export const projectCreateSchema = z.object({
  name: z.string().min(1).max(200),
  projectType: z.string().max(200).nullable().optional(),
  pmApproach: pmApproachSchema.nullable().optional(),
});

export const projectUpdateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  projectType: z.string().max(200).nullable().optional(),
  pmApproach: pmApproachSchema.nullable().optional(),
  status: z.enum(PROJECT_STATUSES).optional(),
  /** Key Impacted Groups watch list shown on the project dashboard (max 5). */
  watchGroupIds: z.array(z.string()).max(5).optional(),
});

export interface Project {
  id: string;
  name: string;
  projectType: string | null;
  pmApproach: string | null;
  status: string;
  watchGroupIds: string[];
  createdAt: string;
  updatedAt: string;
}
