import { describe, expect, it } from 'vitest';
import { activityProgress, addDays, isOverdue, isUpcoming } from './progress.js';
import { buildProjectHealth, buildPortfolioSummary, type ProjectHealthInput } from './health.js';

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

describe('buildProjectHealth', () => {
  const base: ProjectHealthInput = {
    projectId: 'p1',
    name: 'CRM Rollout',
    projectType: null,
    pmApproach: null,
    latestPct: null,
    latestRisk: { cc: 56, oa: 44, quadrant: 'High', date: '2026-07-01' },
    groups: [
      { numPeople: 40, aspectImpacts: [5, 0, 3, 0, 0, 0, 0, 0, 0, 0], barrierPoint: 'Desire' },
      { numPeople: 10, aspectImpacts: [2, 2, 2, 2, 0, 0, 0, 0, 0, 0], barrierPoint: 'Desire' },
      { numPeople: null, aspectImpacts: Array(10).fill(0), barrierPoint: null },
    ],
    activityStatuses: [
      { status: 'Completed', finishDate: '2026-07-01' },
      { status: 'In Progress', finishDate: '2026-07-10' },
      { status: 'Not Started', finishDate: '2026-08-10' },
    ],
    latestCmPerfStatus: 'On Target',
    upcomingDates: [
      { date: '2026-07-10', label: 'past' },
      { date: '2026-07-20', label: 'Go Live' },
      { date: '2026-09-01', label: 'Outcomes' },
    ],
  };

  it('aggregates groups, progress, overdue and next milestone', () => {
    const h = buildProjectHealth(base, TODAY);
    expect(h.groupCount).toBe(3);
    expect(h.totalPeople).toBe(50);
    expect(h.avgDegreeOfImpact).toBe(3); // (4 + 2) / 2, group with all zeros excluded
    expect(h.barrierDistribution).toEqual({ Desire: 2 });
    expect(h.progress.percentComplete).toBe(33);
    expect(h.overdueCount).toBe(1); // In Progress finishing 07-10
    expect(h.nextMilestone).toEqual({ date: '2026-07-20', label: 'Go Live' });
  });

  it('feeds the portfolio summary', () => {
    const h = buildProjectHealth(base, TODAY);
    const s = buildPortfolioSummary([h], [{ date: '2026-07-20' }, { date: '2026-09-09' }, { date: null }], TODAY);
    expect(s).toEqual({ totalProjects: 1, highRiskCount: 1, overdueActivities: 1, checksDueSoon: 1 });
  });
});
