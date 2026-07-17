import { z } from 'zod';

export const id = z.string().uuid();

/** ISO calendar date, e.g. 2026-07-17. */
export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected an ISO date (YYYY-MM-DD)');

export const nullableDate = isoDate.nullable();

export const nullableText = z.string().max(20000).nullable();

export const shortText = z.string().min(1).max(300);
