import { describe, expect, it } from 'vitest';
import { measurementCreateSchema, metricCreateSchema, objectiveCreateSchema } from './outcomes.js';

describe('objectiveCreateSchema', () => {
  it('accepts a valid objective and rejects an empty statement', () => {
    expect(objectiveCreateSchema.safeParse({ level: 'organization', statement: 'Cut handling time' }).success).toBe(true);
    expect(objectiveCreateSchema.safeParse({ level: 'organization', statement: '' }).success).toBe(false);
    expect(objectiveCreateSchema.safeParse({ level: 'nope', statement: 'x' }).success).toBe(false);
  });
});

describe('metricCreateSchema', () => {
  it('accepts a benefit metric with a default direction', () => {
    const parsed = metricCreateSchema.parse({ objectiveId: 'o1', kind: 'benefit', name: 'Revenue', target: 100 });
    expect(parsed.direction).toBe('increase');
  });

  it('requires an adoptionMeasure for adoption metrics (refine)', () => {
    expect(metricCreateSchema.safeParse({ objectiveId: 'o1', kind: 'adoption', name: 'Usage' }).success).toBe(false);
    expect(
      metricCreateSchema.safeParse({ objectiveId: 'o1', kind: 'adoption', name: 'Usage', adoptionMeasure: 'utilization' })
        .success,
    ).toBe(true);
  });
});

describe('measurementCreateSchema', () => {
  it('requires a YYYY-MM-DD date and a numeric value', () => {
    expect(measurementCreateSchema.safeParse({ date: '2026-07-01', value: 42 }).success).toBe(true);
    expect(measurementCreateSchema.safeParse({ date: 'July 1', value: 42 }).success).toBe(false);
    expect(measurementCreateSchema.safeParse({ date: '2026-07-01', value: 'x' }).success).toBe(false);
  });
});
