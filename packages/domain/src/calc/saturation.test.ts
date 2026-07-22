import { describe, expect, it } from 'vitest';
import {
  buildSaturationRows,
  GOLIVE_WEIGHT,
  monthOf,
  monthRange,
  projectWindow,
  type SaturationProject,
  saturationBand,
  saturationLoad,
  shiftDateByMonths,
  shiftMonth,
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

describe('shiftMonth', () => {
  it('moves whole months across year boundaries in both directions', () => {
    expect(shiftMonth('2026-09', 3)).toBe('2026-12');
    expect(shiftMonth('2026-11', 3)).toBe('2027-02');
    expect(shiftMonth('2026-02', -3)).toBe('2025-11');
    expect(shiftMonth('2026-07', 0)).toBe('2026-07');
  });
});

describe('shiftDateByMonths', () => {
  it('shifts full dates and preserves the day when it fits', () => {
    expect(shiftDateByMonths('2026-09-15', 3)).toBe('2026-12-15');
    expect(shiftDateByMonths('2026-01-10', -2)).toBe('2025-11-10');
    expect(shiftDateByMonths('2026-07-01', 0)).toBe('2026-07-01');
  });

  it('clamps the day to the shorter target month', () => {
    expect(shiftDateByMonths('2026-01-31', 1)).toBe('2026-02-28'); // Feb, non-leap
    expect(shiftDateByMonths('2024-01-31', 1)).toBe('2024-02-29'); // Feb, leap
    expect(shiftDateByMonths('2026-08-31', 2)).toBe('2026-10-31'); // Oct has 31, no clamp
    expect(shiftDateByMonths('2026-05-31', 1)).toBe('2026-06-30'); // Jun has 30
  });
});

describe('buildSaturationRows', () => {
  const orgGroups = [{ id: 'sales', name: 'Sales' }];
  const projects: SaturationProject[] = [
    { id: 'a', name: 'CRM', startMonth: '2026-06', endMonth: '2026-12', goliveMonth: '2026-09', groups: [{ orgGroupId: 'sales', degree: 4 }] },
    { id: 'b', name: 'ERP', startMonth: '2026-09', endMonth: '2027-01', goliveMonth: '2026-10', groups: [{ orgGroupId: 'sales', degree: 2 }] },
  ];
  const months = ['2026-08', '2026-09', '2026-11'];

  it('sums per-project loads into banded cells with contributions', () => {
    const [row] = buildSaturationRows(months, orgGroups, projects);
    const cell = (m: string) => row!.cells[months.indexOf(m)]!;
    expect(cell('2026-08').score).toBe(4 * GOLIVE_WEIGHT); // CRM only, go-live-adjacent
    // Sep: CRM at go-live (4×1.5) + ERP go-live-adjacent (2×1.5) = 9 -> overloaded.
    expect(cell('2026-09').score).toBe(4 * GOLIVE_WEIGHT + 2 * GOLIVE_WEIGHT);
    expect(cell('2026-09').band).toBe('overloaded');
    expect(cell('2026-09').contributions.map((c) => c.projectName)).toEqual(['CRM', 'ERP']);
    // Nov: CRM off-peak (4) + ERP go-live-adjacent to its Oct go-live (2×1.5).
    expect(cell('2026-11').score).toBe(4 + 2 * GOLIVE_WEIGHT);
  });

  it('re-sequences a project by whole months (the what-if path)', () => {
    // Push ERP out 3 months: its window becomes Dec–Apr, go-live Jan.
    const [base] = buildSaturationRows(months, orgGroups, projects, {});
    const [shifted] = buildSaturationRows(months, orgGroups, projects, { b: 3 });
    const at = (row: typeof base, m: string) => row!.cells[months.indexOf(m)]!;
    // September now has only CRM — ERP has moved off it entirely.
    expect(at(shifted!, '2026-09').score).toBe(4 * GOLIVE_WEIGHT);
    expect(at(shifted!, '2026-09').contributions).toHaveLength(1);
    // The unshifted grid is unchanged (pure function, no mutation).
    expect(at(base!, '2026-09').contributions).toHaveLength(2);
  });
});
