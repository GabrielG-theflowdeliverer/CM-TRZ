import { describe, expect, it } from 'vitest';
import type { Measurement } from '../entities/outcomes.js';
import { latestMeasurement, metricRealization, overallRealization, realizationPct } from './outcomes.js';

describe('realizationPct', () => {
  it('measures progress from baseline to target for "higher is better"', () => {
    expect(realizationPct(100, 200, 100)).toBe(0); // at baseline
    expect(realizationPct(100, 200, 150)).toBe(50); // halfway
    expect(realizationPct(100, 200, 200)).toBe(100); // at target
  });

  it('works for "lower is better" (cost / cycle time) via the target sign', () => {
    expect(realizationPct(100, 50, 75)).toBe(50); // halved the gap downward
    expect(realizationPct(100, 50, 50)).toBe(100);
  });

  it('allows overachievement above 100 but clamps wrong-way movement at 0', () => {
    expect(realizationPct(100, 200, 250)).toBe(150); // beat the target
    expect(realizationPct(100, 200, 80)).toBe(0); // moved away -> clamped
    expect(realizationPct(100, 50, 120)).toBe(0); // wrong way on a decrease metric
  });

  it('is null when it cannot be computed', () => {
    expect(realizationPct(null, 200, 150)).toBeNull();
    expect(realizationPct(100, null, 150)).toBeNull();
    expect(realizationPct(100, 200, null)).toBeNull();
    expect(realizationPct(100, 100, 100)).toBeNull(); // zero-width range
  });
});

const m = (date: string, value: number): Measurement => ({ id: date, metricId: 'x', date, value });

describe('latestMeasurement', () => {
  it('returns the most recent by date regardless of input order', () => {
    expect(latestMeasurement([m('2026-01-01', 1), m('2026-03-01', 3), m('2026-02-01', 2)])?.value).toBe(3);
    expect(latestMeasurement([])).toBeNull();
  });
});

describe('metricRealization', () => {
  it('pairs the latest value with its realization %', () => {
    const r = metricRealization({ baseline: 0, target: 10 }, [m('2026-01-01', 2), m('2026-02-01', 7)]);
    expect(r).toEqual({ current: 7, pct: 70 });
  });

  it('has a null pct when there is no measurement yet', () => {
    expect(metricRealization({ baseline: 0, target: 10 }, [])).toEqual({ current: null, pct: null });
  });
});

describe('overallRealization', () => {
  it('averages the computable percentages and ignores nulls', () => {
    expect(overallRealization([40, 60, null])).toBe(50);
    expect(overallRealization([null, null])).toBeNull();
    expect(overallRealization([])).toBeNull();
  });
});
