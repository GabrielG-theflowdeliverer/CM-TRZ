import { describe, expect, it } from 'vitest';
import { responsesSchemaFor } from './assessment.js';
import { groupAspectsUpsertSchema, groupCreateSchema } from './impact.js';
import { projectCreateSchema } from './project.js';

describe('assessment response validation', () => {
  it('accepts valid PCT scores and rejects out-of-range values', () => {
    const schema = responsesSchemaFor('pct');
    expect(schema.safeParse({ 'pct.success.1': 3, 'pct.leadership.10': null }).success).toBe(true);
    expect(schema.safeParse({ 'pct.success.1': 4 }).success).toBe(false); // PCT max is 3
    expect(schema.safeParse({ 'pct.success.1': 0 }).success).toBe(false);
    expect(schema.safeParse({ 'pct.success.1': 2.5 }).success).toBe(false); // integers only
  });

  it('rejects unknown item keys per type', () => {
    expect(responsesSchemaFor('pct').safeParse({ 'risk.cc.1': 3 }).success).toBe(false);
    expect(responsesSchemaFor('risk').safeParse({ 'risk.cc.1': 5 }).success).toBe(true);
    expect(responsesSchemaFor('risk').safeParse({ 'risk.cc.15': 5 }).success).toBe(false);
  });

  it('validates ADKAR scores 1-5', () => {
    const schema = responsesSchemaFor('adkar');
    expect(schema.safeParse({ 'adkar.awareness': 5 }).success).toBe(true);
    expect(schema.safeParse({ 'adkar.awareness': 0 }).success).toBe(false);
    expect(schema.safeParse({ 'adkar.awareness': 6 }).success).toBe(false);
  });
});

describe('impact schemas', () => {
  it('bounds aspect impact scores to 0-5', () => {
    expect(groupAspectsUpsertSchema.safeParse([{ aspectKey: 'processes', impact: 5 }]).success).toBe(true);
    expect(groupAspectsUpsertSchema.safeParse([{ aspectKey: 'processes', impact: 6 }]).success).toBe(false);
    expect(groupAspectsUpsertSchema.safeParse([{ aspectKey: 'nonsense', impact: 1 }]).success).toBe(false);
  });

  it('requires a group name', () => {
    expect(groupCreateSchema.safeParse({ name: '' }).success).toBe(false);
    expect(groupCreateSchema.safeParse({ name: 'Client Services', numPeople: 40 }).success).toBe(true);
  });
});

describe('project schema', () => {
  it('validates pm approach against the vocabulary', () => {
    expect(projectCreateSchema.safeParse({ name: 'CRM', pmApproach: 'Iterative' }).success).toBe(true);
    expect(projectCreateSchema.safeParse({ name: 'CRM', pmApproach: 'Agile' }).success).toBe(false);
  });
});
