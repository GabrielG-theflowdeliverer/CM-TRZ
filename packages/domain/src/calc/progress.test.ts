import { describe, expect, it } from 'vitest';
import { activityProgress, addDays, isOverdue, isUpcoming } from './progress.js';

const TODAY = '2026-07-17';

describe('activityProgress', () => {
  it('rolls up statuses and percent complete', () => {
    const p = activityProgress(['Completed', 'Completed', 'In Progress', 'Not Started', null]);
    expect(p).toEqual({ total: 5, completed: 2, inProgress: 1, notStarted: 2, percentComplete: 40 });
  });

  it('has null percent when there are no activities', () => {
    expect(activityProgress([]).percentComplete).toBeNull();
  });
});

describe('isOverdue / isUpcoming / addDays', () => {
  it('flags past finish dates unless completed', () => {
    expect(isOverdue('2026-07-16', 'In Progress', TODAY)).toBe(true);
    expect(isOverdue('2026-07-16', 'Completed', TODAY)).toBe(false);
    expect(isOverdue('2026-07-17', 'Not Started', TODAY)).toBe(false);
    expect(isOverdue(null, 'Not Started', TODAY)).toBe(false);
  });

  it('windows upcoming dates inclusively', () => {
    expect(isUpcoming('2026-07-17', TODAY, 14)).toBe(true);
    expect(isUpcoming('2026-07-31', TODAY, 14)).toBe(true);
    expect(isUpcoming('2026-08-01', TODAY, 14)).toBe(false);
    expect(isUpcoming('2026-07-16', TODAY, 14)).toBe(false);
  });

  it('adds days across month boundaries', () => {
    expect(addDays('2026-07-25', 14)).toBe('2026-08-08');
  });
});
