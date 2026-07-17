import { describe, expect, it } from 'vitest';
import { aspectsImpacted, degreeOfImpact } from './impact.js';

describe('aspectsImpacted', () => {
  it('counts only aspects scored above zero', () => {
    expect(aspectsImpacted([0, 0, 0, 0, 0, 0, 0, 0, 0, 0])).toBe(0);
    expect(aspectsImpacted([5, 0, 3, null, null, 0, 0, 0, 0, 0])).toBe(2);
    expect(aspectsImpacted([1, 2, 3, 4, 5, 1, 2, 3, 4, 5])).toBe(10);
  });
});

describe('degreeOfImpact', () => {
  it('averages across only the impacted (non-zero) aspects', () => {
    // 5 + 3 = 8 over 2 impacted aspects -> 4
    expect(degreeOfImpact([5, 0, 3, 0, 0, 0, 0, 0, 0, 0])).toBe(4);
    expect(degreeOfImpact([4, 4, 4, 4, 4, 4, 4, 4, 4, 4])).toBe(4);
    // Zeros pull nothing in: 2 over 1 aspect -> 2, not 0.2
    expect(degreeOfImpact([2, 0, 0, 0, 0, 0, 0, 0, 0, 0])).toBe(2);
  });

  it('is null when no aspect is impacted', () => {
    expect(degreeOfImpact([0, 0, 0])).toBeNull();
    expect(degreeOfImpact([null, null])).toBeNull();
    expect(degreeOfImpact([])).toBeNull();
  });
});
