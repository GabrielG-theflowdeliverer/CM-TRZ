import { describe, expect, it } from 'vitest';
import { barrierPoint } from './adkar.js';

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
