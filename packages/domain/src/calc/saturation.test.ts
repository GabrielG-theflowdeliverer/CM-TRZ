import { describe, expect, it } from 'vitest';
import {
  GOLIVE_WEIGHT,
  monthOf,
  monthRange,
  projectWindow,
  saturationBand,
  saturationLoad,
} from './saturation.js';

const noRoadmap = { kickoffDate: null, goliveDate: null, outcomesDate: null };

describe('projectWindow', () => {
  it('uses roadmap kickoff → outcomes, preferring outcomes over go-live for the end', () => {
    const roadmap = { kickoffDate: '2026-07-01', goliveDate: '2026-09-15', outcomesDate: '2026-12-01' };
    expect(projectWindow(roadmap, [])).toEqual({ start: '2026-07-01', end: '2026-12-01' });
    expect(projectWindow({ ...roadmap, outcomesDate: null }, [])).toEqual({
      start: '2026-07-01',
      end: '2026-09-15',
    });
  });

  it('falls back to activity extents for a missing side', () => {
    const activities = [
      { startDate: '2026-08-05', finishDate: null },
      { startDate: '2026-08-01', finishDate: '2026-10-20' },
    ];
    expect(projectWindow(noRoadmap, activities)).toEqual({ start: '2026-08-01', end: '2026-10-20' });
    expect(projectWindow({ ...noRoadmap, kickoffDate: '2026-07-01' }, activities)).toEqual({
      start: '2026-07-01',
      end: '2026-10-20',
    });
  });

  it('contributes nothing when a side cannot be established or is inverted', () => {
    expect(projectWindow(noRoadmap, [])).toBeNull();
    expect(projectWindow(noRoadmap, [{ startDate: null, finishDate: null }])).toBeNull();
    expect(
      projectWindow({ kickoffDate: '2026-10-01', goliveDate: '2026-07-01', outcomesDate: null }, []),
    ).toBeNull();
  });
});

describe('month helpers', () => {
  it('buckets dates and spans year boundaries inclusively', () => {
    expect(monthOf('2026-07-18')).toBe('2026-07');
    expect(monthRange('2026-11', '2027-02')).toEqual(['2026-11', '2026-12', '2027-01', '2027-02']);
    expect(monthRange('2026-07', '2026-07')).toEqual(['2026-07']);
    expect(monthRange('2026-08', '2026-07')).toEqual([]);
  });
});

describe('saturationLoad', () => {
  const window = { start: '2026-07-01', end: '2026-12-01' };

  it('is the degree of impact inside the window and zero outside', () => {
    expect(saturationLoad(4, window, '2026-07', null)).toBe(4);
    expect(saturationLoad(4, window, '2026-12', null)).toBe(4); // end month inclusive
    expect(saturationLoad(4, window, '2026-06', null)).toBe(0);
    expect(saturationLoad(4, window, '2027-01', null)).toBe(0);
  });

  it('weighs go-live proximity (±1 month) heavier', () => {
    const golive = '2026-09-15';
    expect(saturationLoad(4, window, '2026-08', golive)).toBe(4 * GOLIVE_WEIGHT);
    expect(saturationLoad(4, window, '2026-09', golive)).toBe(4 * GOLIVE_WEIGHT);
    expect(saturationLoad(4, window, '2026-10', golive)).toBe(4 * GOLIVE_WEIGHT);
    expect(saturationLoad(4, window, '2026-11', golive)).toBe(4);
  });

  it('handles go-live weighting across a year boundary', () => {
    const dec = { start: '2026-11-01', end: '2027-02-28' };
    expect(saturationLoad(2, dec, '2027-01', '2026-12-20')).toBe(2 * GOLIVE_WEIGHT);
    expect(saturationLoad(2, dec, '2027-02', '2026-12-20')).toBe(2);
  });

  it('contributes nothing without a degree or a window', () => {
    expect(saturationLoad(null, window, '2026-07', null)).toBe(0);
    expect(saturationLoad(4, null, '2026-07', null)).toBe(0);
  });
});

describe('saturationBand', () => {
  it('maps scores at the documented thresholds', () => {
    expect(saturationBand(0)).toBe('ok');
    expect(saturationBand(4.9)).toBe('ok');
    expect(saturationBand(5)).toBe('elevated');
    expect(saturationBand(8.9)).toBe('elevated');
    expect(saturationBand(9)).toBe('overloaded');
  });
});
