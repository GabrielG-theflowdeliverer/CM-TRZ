import { describe, expect, it } from 'vitest';
import {
  aspectsImpactedHistogram,
  barrierPointCounts,
  buildPortfolioSummary,
  buildProjectHealth,
  degreeOfImpactHistogram,
  outcomeHealth,
  worstCmPerfStatus,
  type ProjectHealth,
  type ProjectHealthInput,
} from './health.js';

const TODAY = '2026-07-17';

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

  it('counts every aspect that scores above zero, including all ten', () => {
    expect(aspectsImpactedHistogram([{ aspectImpacts: Array(10).fill(3) as number[] }])).toEqual([
      0, 0, 0, 0, 0, 0, 0, 0, 0, 1,
    ]);
  });

  it('ignores nulls and non-positive scores when counting aspects', () => {
    expect(aspectsImpactedHistogram([{ aspectImpacts: [null, 0, 4, null, 0, 0, 0, 0, 0, 0] }])).toEqual([
      1, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    ]);
  });

  it('clamps a degree into the 1..5 buckets rather than dropping it', () => {
    // Every aspect at 5 averages to 5 — the top bucket, not an overflow.
    expect(degreeOfImpactHistogram([{ aspectImpacts: Array(10).fill(5) as number[] }])).toEqual([0, 0, 0, 0, 1]);
  });

  it('counts barrier points including No barrier', () => {
    expect(barrierPointCounts(['Desire', 'Desire', 'No barrier', null])).toMatchObject({
      Desire: 2,
      'No barrier': 1,
      Awareness: 0,
    });
  });

  it('returns a fully-zeroed barrier tally for no groups', () => {
    expect(barrierPointCounts([])).toEqual({
      Awareness: 0,
      Desire: 0,
      Knowledge: 0,
      Ability: 0,
      Reinforcement: 0,
      'No barrier': 0,
    });
  });

  it('takes the most pessimistic CM perf status', () => {
    expect(worstCmPerfStatus(['On Target', 'Behind Target', null])).toBe('Behind Target');
    expect(worstCmPerfStatus(['Ahead of Target'])).toBe('Ahead of Target');
    expect(worstCmPerfStatus([null, null])).toBeNull();
  });

  it('ignores statuses outside the known ordering', () => {
    expect(worstCmPerfStatus(['Made Up', 'On Target'])).toBe('On Target');
    expect(worstCmPerfStatus(['Made Up'])).toBeNull();
    expect(worstCmPerfStatus([])).toBeNull();
  });

  it('ranks No Progress as the worst status of all', () => {
    expect(worstCmPerfStatus(['Ahead of Target', 'No Progress', 'Well Behind Target'])).toBe('No Progress');
  });
});

describe('outcomeHealth', () => {
  it('is null across the board when there are no metrics', () => {
    expect(outcomeHealth([])).toEqual({
      realization: null,
      adoption: null,
      benefit: null,
      metricCount: 0,
      measuredCount: 0,
    });
  });

  it('counts unmeasured metrics but leaves them out of the means', () => {
    const h = outcomeHealth([
      { kind: 'benefit', pct: 50 },
      { kind: 'benefit', pct: null },
      { kind: 'adoption', pct: null },
    ]);
    expect(h).toEqual({ realization: 50, adoption: null, benefit: 50, metricCount: 3, measuredCount: 1 });
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

  it('treats a milestone dated today as still upcoming', () => {
    const h = buildProjectHealth({ ...base, upcomingDates: [{ date: TODAY, label: 'Today' }] }, TODAY);
    expect(h.nextMilestone).toEqual({ date: TODAY, label: 'Today' });
  });

  it('picks the earliest upcoming milestone regardless of input order', () => {
    const h = buildProjectHealth(
      {
        ...base,
        upcomingDates: [
          { date: '2026-12-01', label: 'Later' },
          { date: '2026-07-18', label: 'Sooner' },
        ],
      },
      TODAY,
    );
    expect(h.nextMilestone).toEqual({ date: '2026-07-18', label: 'Sooner' });
  });

  it('has no next milestone when every date is in the past', () => {
    const h = buildProjectHealth({ ...base, upcomingDates: [{ date: '2026-01-01', label: 'Gone' }] }, TODAY);
    expect(h.nextMilestone).toBeNull();
  });

  it('reports an empty project without dividing by zero', () => {
    const h = buildProjectHealth(
      {
        ...base,
        groups: [],
        activityStatuses: [],
        upcomingDates: [],
        outcomeMetrics: [],
        incompleteCheckDates: [],
      },
      TODAY,
    );
    expect(h.groupCount).toBe(0);
    expect(h.totalPeople).toBe(0);
    expect(h.avgDegreeOfImpact).toBeNull();
    expect(h.barrierDistribution).toEqual({});
    expect(h.progress.percentComplete).toBeNull();
    expect(h.overdueCount).toBe(0);
    expect(h.nextMilestone).toBeNull();
    expect(h.checksDueSoon).toBe(0);
    expect(h.outcomes.realization).toBeNull();
  });
});

describe('buildPortfolioSummary', () => {
  const health = (over: Partial<ProjectHealth> = {}): ProjectHealth =>
    ({
      ...buildProjectHealth(
        {
          projectId: 'p',
          name: 'P',
          projectType: null,
          pmApproach: null,
          latestPct: null,
          latestRisk: { cc: 56, oa: 44, quadrant: 'High', date: null },
          groups: [],
          activityStatuses: [{ status: 'In Progress', finishDate: '2026-01-01' }],
          latestCmPerfStatus: null,
          upcomingDates: [],
          outcomeMetrics: [{ kind: 'benefit', pct: 60 }],
          incompleteCheckDates: ['2026-07-20'],
        },
        TODAY,
      ),
      ...over,
    }) as ProjectHealth;

  it('sums per-project figures and averages realization', () => {
    const s = buildPortfolioSummary([health(), health()]);
    expect(s).toEqual({
      totalProjects: 2,
      highRiskCount: 2,
      overdueActivities: 2,
      checksDueSoon: 2,
      avgRealization: 60,
    });
  });

  it('is all zeros with a null average for an empty portfolio', () => {
    expect(buildPortfolioSummary([])).toEqual({
      totalProjects: 0,
      highRiskCount: 0,
      overdueActivities: 0,
      checksDueSoon: 0,
      avgRealization: null,
    });
  });

  it('only counts High-quadrant projects as high risk, and tolerates no risk run', () => {
    const s = buildPortfolioSummary([
      health({ risk: { cc: 20, oa: 80, quadrant: 'Low', date: null } }),
      health({ risk: null }),
      health(),
    ]);
    expect(s.totalProjects).toBe(3);
    expect(s.highRiskCount).toBe(1);
  });

  it('averages only over projects with measurable outcomes', () => {
    const s = buildPortfolioSummary([
      health(),
      health({ outcomes: { realization: null, adoption: null, benefit: null, metricCount: 0, measuredCount: 0 } }),
    ]);
    expect(s.avgRealization).toBe(60);
  });
});
