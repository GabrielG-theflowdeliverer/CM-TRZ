import { z } from 'zod';
import { nullableText } from './common.js';

/**
 * A transfer-of-ownership checklist item (Prosci Phase 3). One sustainment
 * responsibility being handed from the temporary project structure to a
 * permanent business owner; `done` records that the handoff is confirmed.
 */
export const transferItemCreateSchema = z.object({
  responsibility: z.string().min(1).max(500),
  newOwner: z.string().max(300).nullable().optional(),
  done: z.boolean().optional(),
  notes: nullableText.optional(),
});

export const transferItemUpdateSchema = transferItemCreateSchema.partial();

export interface TransferItem {
  id: string;
  projectId: string;
  responsibility: string;
  newOwner: string | null;
  done: boolean;
  notes: string | null;
  createdAt: string;
}
