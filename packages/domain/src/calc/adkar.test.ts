import { describe, expect, it } from 'vitest';
import { adkarScoresFromResponses, barrierPoint } from './adkar.js';
import { ADKAR_ELEMENTS } from '../content/adkar.js';

describe('barrierPoint', () => {
  it('is null when Awareness is unanswered (Excel: blank result)', () => {
    expect(barrierPoint({})).toBeNull();
    expect(barrierPoint({ desire: 1 })).toBeNull();
  });

  it('returns the first element scoring <= 3 in A-D-K-A-R order', () => {
    expect(barrierPoint({ awareness: 3 })).toBe('Awareness');
    expect(barrierPoint({ awareness: 1, desire: 5 })).toBe('Awareness');
    expect(barrierPoint({ awareness: 4, desire: 2 })).toBe('Desire');
    expect(barrierPoint({ awareness: 5, desire: 4, knowledge: 3 })).toBe('Knowledge');
    expect(barrierPoint({ awareness: 5, desire: 4, knowledge: 4, ability: 2 })).toBe('Ability');
    expect(
      barrierPoint({ awareness: 5, desire: 4, knowledge: 4, ability: 4, reinforcement: 3 }),
    ).toBe('Reinforcement');
  });

  it('returns "No barrier" when all answered elements are above 3', () => {
    expect(
      barrierPoint({ awareness: 4, desire: 4, knowledge: 4, ability: 4, reinforcement: 4 }),
    ).toBe('No barrier');
  });

  it('skips unanswered later elements, matching Excel text-vs-number comparison', () => {
    // A=4, D blank, K=2 -> Excel evaluates ""<=3 as FALSE and lands on Knowledge.
    expect(barrierPoint({ awareness: 4, knowledge: 2 })).toBe('Knowledge');
    // A=4 and everything else blank -> "No barrier" in Excel.
    expect(barrierPoint({ awareness: 4 })).toBe('No barrier');
  });
});

describe('adkarScoresFromResponses', () => {
  it('reads each element from its adkar.<element> item key', () => {
    expect(
      adkarScoresFromResponses({
        'adkar.awareness': 5,
        'adkar.desire': 4,
        'adkar.knowledge': 3,
        'adkar.ability': 2,
        'adkar.reinforcement': 1,
      }),
    ).toEqual({ awareness: 5, desire: 4, knowledge: 3, ability: 2, reinforcement: 1 });
  });

  it('always returns all five elements, nulling the ones not answered', () => {
    const scores = adkarScoresFromResponses({ 'adkar.desire': 2 });
    expect(Object.keys(scores).sort()).toEqual([...ADKAR_ELEMENTS].sort());
    expect(scores).toEqual({
      awareness: null,
      desire: 2,
      knowledge: null,
      ability: null,
      reinforcement: null,
    });
  });

  it('normalises an explicit null the same as a missing key', () => {
    expect(adkarScoresFromResponses({ 'adkar.awareness': null })).toEqual(adkarScoresFromResponses({}));
  });

  it('ignores response keys belonging to other assessment types', () => {
    expect(adkarScoresFromResponses({ 'pct.leadership': 5, awareness: 4 })).toEqual({
      awareness: null,
      desire: null,
      knowledge: null,
      ability: null,
      reinforcement: null,
    });
  });

  it('feeds barrierPoint directly — a score of 0 is still an answer', () => {
    // 0 is falsy but not null: it must survive the extraction and drive the barrier.
    const scores = adkarScoresFromResponses({ 'adkar.awareness': 0 });
    expect(scores.awareness).toBe(0);
    expect(barrierPoint(scores)).toBe('Awareness');
  });
});
