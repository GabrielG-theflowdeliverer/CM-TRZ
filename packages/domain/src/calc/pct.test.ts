import { describe, expect, it } from 'vitest';
import { pctAspectScore, pctBand, pctScores } from './pct.js';
import { PCT_ITEM_KEYS, pctItemKey } from '../content/pctFactors.js';

describe('pctAspectScore', () => {
  it('sums ten answered factors', () => {
    expect(pctAspectScore([3, 3, 3, 3, 3, 3, 3, 3, 3, 2])).toBe(29);
    expect(pctAspectScore(Array(10).fill(1))).toBe(10);
    expect(pctAspectScore(Array(10).fill(3))).toBe(30);
  });

  it('returns null until every factor is answered (Excel COUNTIF=10 rule)', () => {
    expect(pctAspectScore([3, 3, 3, 3, 3, 3, 3, 3, 3, null])).toBeNull();
    expect(pctAspectScore(Array(10).fill(null))).toBeNull();
    expect(pctAspectScore([])).toBeNull();
    expect(pctAspectScore(Array(9).fill(2))).toBeNull();
  });
});

describe('pctBand', () => {
  it('matches the Excel conditional-format boundaries', () => {
    expect(pctBand(30)).toBe('strength');
    expect(pctBand(25)).toBe('strength');
    expect(pctBand(24)).toBe('alert');
    expect(pctBand(20)).toBe('alert');
    expect(pctBand(19)).toBe('risk');
    expect(pctBand(10)).toBe('risk');
  });
});

describe('pctScores', () => {
  it('computes each aspect independently from a response map', () => {
    const responses: Record<string, number | null> = {};
    // Fill success fully with 2s, leadership partially.
    for (let i = 0; i < 10; i++) responses[pctItemKey('success', i)] = 2;
    for (let i = 0; i < 9; i++) responses[pctItemKey('leadership', i)] = 3;
    const scores = pctScores(responses);
    expect(scores.success).toBe(20);
    expect(scores.leadership).toBeNull();
    expect(scores.project_management).toBeNull();
    expect(scores.change_management).toBeNull();
  });

  it('has exactly 40 item keys', () => {
    expect(PCT_ITEM_KEYS).toHaveLength(40);
    expect(new Set(PCT_ITEM_KEYS).size).toBe(40);
  });
});
