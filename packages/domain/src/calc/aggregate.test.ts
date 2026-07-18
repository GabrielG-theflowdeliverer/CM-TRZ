import { describe, expect, it } from 'vitest';
import { aggregateResponses } from './aggregate.js';
import { pctScores } from './pct.js';
import { pctItemKey } from '../content/pctFactors.js';

describe('aggregateResponses', () => {
  it('means each item over the respondents who answered it', () => {
    const agg = aggregateResponses([
      { 'a': 2, 'b': 4 },
      { 'a': 4, 'b': 2 },
    ]);
    expect(agg.respondents).toBe(2);
    expect(agg.mean.a).toBe(3);
    expect(agg.mean.b).toBe(3);
    expect(agg.byKey.a).toEqual({ mean: 3, answered: 2, distribution: { 2: 1, 4: 1 } });
  });

  it('ignores null (unanswered) items in both mean and count', () => {
    const agg = aggregateResponses([
      { 'a': 5, 'b': null },
      { 'a': 1, 'b': 3 },
      { 'a': null },
    ]);
    expect(agg.mean.a).toBe(3); // (5 + 1) / 2, the null does not drag it down
    expect(agg.byKey.a?.answered).toBe(2);
    expect(agg.mean.b).toBe(3); // only one real answer
    expect(agg.byKey.b?.answered).toBe(1);
    expect(agg.respondents).toBe(3); // the blank respondent still counts as present
  });

  it('treats an item only ever left blank as absent, not present-with-null', () => {
    const agg = aggregateResponses([{ 'a': null }, { 'a': null }]);
    // A key nobody answered is indistinguishable from one never sent.
    expect(agg.byKey.a).toBeUndefined();
    expect(agg.mean.a).toBeUndefined();
    expect(agg.respondents).toBe(2);
  });

  it('handles the empty roster without dividing by zero', () => {
    const agg = aggregateResponses([]);
    expect(agg).toEqual({ mean: {}, byKey: {}, respondents: 0 });
  });

  it('builds a per-value histogram', () => {
    const agg = aggregateResponses([{ x: 5 }, { x: 5 }, { x: 3 }, { x: 5 }]);
    expect(agg.byKey.x?.distribution).toEqual({ 3: 1, 5: 3 });
    expect(agg.byKey.x?.mean).toBe(4.5);
  });

  it('feeds straight into the existing PCT scorer', () => {
    // Two respondents fully answer the "success" aspect; means -> aspect sum.
    const build = (v: number) => {
      const r: Record<string, number | null> = {};
      for (let i = 0; i < 10; i++) r[pctItemKey('success', i)] = v;
      return r;
    };
    const agg = aggregateResponses([build(3), build(1)]); // each factor mean = 2
    const scores = pctScores(agg.mean);
    expect(scores.success).toBe(20); // 10 factors x mean 2
  });

  it('leaves an aspect null when the aggregate is missing a factor', () => {
    const build = (n: number) => {
      const r: Record<string, number | null> = {};
      for (let i = 0; i < n; i++) r[pctItemKey('success', i)] = 3;
      return r;
    };
    const agg = aggregateResponses([build(9), build(9)]); // only 9 of 10 factors ever answered
    expect(pctScores(agg.mean).success).toBeNull();
  });
});
