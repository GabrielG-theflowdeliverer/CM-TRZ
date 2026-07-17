import { describe, expect, it } from 'vitest';
import { competencyTotal, sponsorInterpretation } from './competency.js';
import {
  MANAGER_COMPETENCY_ITEM_KEYS,
  MANAGER_COMPETENCY_SECTIONS,
  SPONSOR_COMPETENCY_ITEM_KEYS,
  SPONSOR_COMPETENCY_SECTIONS,
} from '../content/competencyItems.js';

describe('competency content', () => {
  it('sponsor assessment has 20 items across 3 sections (6+8+6), max 100', () => {
    expect(SPONSOR_COMPETENCY_SECTIONS.map((s) => s.items.length)).toEqual([6, 8, 6]);
    expect(SPONSOR_COMPETENCY_ITEM_KEYS).toHaveLength(20);
  });

  it('manager assessment has 20 items across 4 sections of 5, max 100', () => {
    expect(MANAGER_COMPETENCY_SECTIONS.map((s) => s.items.length)).toEqual([5, 5, 5, 5]);
    expect(MANAGER_COMPETENCY_ITEM_KEYS).toHaveLength(20);
  });
});

describe('competencyTotal', () => {
  it('sums answered items, ignoring blanks (Excel SUM semantics)', () => {
    expect(competencyTotal(Array(20).fill(5))).toBe(100);
    expect(competencyTotal([5, 4, null, 3])).toBe(12);
    expect(competencyTotal([])).toBe(0);
  });
});

describe('sponsorInterpretation', () => {
  it('matches the printed interpretation boundaries', () => {
    expect(sponsorInterpretation(100)).toBe('Excellent');
    expect(sponsorInterpretation(80)).toBe('Excellent');
    expect(sponsorInterpretation(79)).toBe('Good');
    expect(sponsorInterpretation(70)).toBe('Good');
    expect(sponsorInterpretation(69)).toBe('Fair to Poor');
    expect(sponsorInterpretation(0)).toBe('Fair to Poor');
  });
});
