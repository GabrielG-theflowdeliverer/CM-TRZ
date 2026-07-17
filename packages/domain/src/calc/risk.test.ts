import { describe, expect, it } from 'vitest';
import { riskQuadrant, riskScores, riskSectionScore } from './risk.js';
import { riskItemKey } from '../content/riskFactors.js';

describe('riskSectionScore', () => {
  it('sums fourteen answered factors', () => {
    expect(riskSectionScore(Array(14).fill(1))).toBe(14);
    expect(riskSectionScore(Array(14).fill(5))).toBe(70);
    expect(riskSectionScore(Array(14).fill(3))).toBe(42);
  });

  it('is null (Excel "NA") until all fourteen are answered', () => {
    expect(riskSectionScore([...Array(13).fill(3), null])).toBeNull();
    expect(riskSectionScore(Array(14).fill(null))).toBeNull();
    expect(riskSectionScore(Array(13).fill(3))).toBeNull();
  });
});

describe('riskQuadrant', () => {
  it('matches Excel quadrant boundaries at exactly 42', () => {
    expect(riskQuadrant(42, 42)).toBe('High');
    expect(riskQuadrant(42, 41)).toBe('Medium');
    expect(riskQuadrant(41, 42)).toBe('Medium');
    expect(riskQuadrant(41, 41)).toBe('Low');
    expect(riskQuadrant(70, 70)).toBe('High');
    expect(riskQuadrant(14, 14)).toBe('Low');
  });

  it('is null when either section is incomplete', () => {
    expect(riskQuadrant(null, 50)).toBeNull();
    expect(riskQuadrant(50, null)).toBeNull();
    expect(riskQuadrant(null, null)).toBeNull();
  });
});

describe('riskScores', () => {
  it('derives both sections and the quadrant from a response map', () => {
    const responses: Record<string, number | null> = {};
    for (let i = 0; i < 14; i++) responses[riskItemKey('cc', i)] = 4; // 56
    for (let i = 0; i < 14; i++) responses[riskItemKey('oa', i)] = 2; // 28
    const scores = riskScores(responses);
    expect(scores.cc).toBe(56);
    expect(scores.oa).toBe(28);
    expect(scores.quadrant).toBe('Medium');
  });
});
