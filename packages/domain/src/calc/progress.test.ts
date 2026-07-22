import { describe, expect, it } from 'vitest';
import { activityProgress, addDays, isOverdue, isUpcoming } from './progress.js';
import {
  aspectsImpactedHistogram,
  barrierPointCounts,
  buildPortfolioSummary,
  buildProjectHealth,
  degreeOfImpactHistogram,
  worstCmPerfStatus,
  type ProjectHealthInput,
} from './health.js';

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

describe('project dashboard distributions', () => {
  const groups = [
    { aspectImpacts: [5, 4, 3, 0, 0, 0, 0, 0, 0, 0] }, // 3 aspects, degree 4
    { aspectImpacts: [2, 0, 0, 0, 0, 0, 0, 0, 0, 0] }, // 1 aspect, degree 2
    { aspectImpacts: [1, 1, 1, 0, 0, 0, 0, 0, 0, 0] }, // 3 aspects, degree 1
    { aspectImpacts: Array(10).fill(0) as number[] }, // unscored -> excluded
  ];

  it('builds the aspects-impacted histogram (1..10)', () => {
    expect(aspectsImpactedHistogram(groups)).toEqual([1, 0, 2, 0, 0, 0, 0, 0, 0, 0]);
  });

  it('builds the degree-of-impact histogram (1..5, rounded)', () => {
    expect(degreeOfImpactHistogram(groups)).toEqual([1, 1, 0, 1, 0]);
  });

  it('counts barrier points including No barrier', () => {
    expect(barrierPointCounts(['Desire', 'Desire', 'No barrier', null])).toMatchObject({
      Desire: 2,
      'No barrier': 1,
      Awareness: 0,
    });
  });

  it('takes the most pessimistic CM perf status', () => {
    expect(worstCmPerfStatus(['On Target', 'Behind Target', null])).toBe('Behind Target');
    expect(worstCmPerfStatus(['Ahead of Target'])).toBe('Ahead of Target');
    expect(worstCmPerfStatus([null, null])).toBeNull();
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
    outcomeMetrics: [
      { kind: 'benefit', pct: 80 },
      { kind: 'benefit', pct: 40 },
      { kind: 'adoption', pct: 60 },
      { kind: 'adoption', pct: null }, // unmeasured -> excluded from means
    ],
    incompleteCheckDates: ['2026-07-20', '2026-09-09'], // first is within 14 days of TODAY
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
    expect(h.checksDueSoon).toBe(1); // only 2026-07-20 is within the 14-day window
  });

  it('rolls up outcome realization (overall / adoption / benefit), ignoring unmeasured', () => {
    const h = buildProjectHealth(base, TODAY);
    expect(h.outcomes).toEqual({
      realization: 60, // mean(80, 40, 60)
      benefit: 60, // mean(80, 40)
      adoption: 60, // mean(60), the null excluded
      metricCount: 4,
      measuredCount: 3,
    });
  });

  it('feeds the portfolio summary (incl. average realization), summing per-project', () => {
    const h = buildProjectHealth(base, TODAY);
    const s = buildPortfolioSummary([h, h]); // two identical projects double the sums
    expect(s).toEqual({
      totalProjects: 2,
      highRiskCount: 2,
      overdueActivities: 2,
      checksDueSoon: 2,
      avgRealization: 60,
    });
  });
});
