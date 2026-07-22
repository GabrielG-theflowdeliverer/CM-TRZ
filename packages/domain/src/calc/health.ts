import type { PctScores } from './pct.js';
import type { RiskQuadrant } from './risk.js';
import type { BarrierPoint } from './adkar.js';
import type { ActivityStatus, CmPerfStatus } from '../vocab/index.js';
import { activityProgress, isOverdue, isUpcoming, type ProgressSummary } from './progress.js';
import { degreeOfImpact } from './impact.js';
import { overallRealization } from './outcomes.js';

/** Raw per-project facts the server gathers; health is derived from these. */
export interface ProjectHealthInput {
  projectId: string;
  name: string;
  projectType: string | null;
  pmApproach: string | null;
  /** Latest completed (or latest created) PCT run scores, if any. */
  latestPct: { scores: PctScores; date: string | null } | null;
  /** Latest risk run, if any. */
  latestRisk: { cc: number | null; oa: number | null; quadrant: RiskQuadrant | null; date: string | null } | null;
  groups: Array<{
    numPeople: number | null;
    aspectImpacts: Array<number | null>;
    barrierPoint: BarrierPoint | null;
  }>;
  /** Statuses of every plan + blueprint activity. */
  activityStatuses: Array<{ status: ActivityStatus | null; finishDate: string | null }>;
  latestCmPerfStatus: CmPerfStatus | null;
  /** All dated items that can appear as "next milestone": roadmap dates, checks, activity finishes. */
  upcomingDates: Array<{ date: string; label: string }>;
  /** Each outcome metric's realization % (null = not yet measurable), for the portfolio rollup. */
  outcomeMetrics: Array<{ kind: 'adoption' | 'benefit'; pct: number | null }>;
}

/** Benefit/adoption realization rolled up for the portfolio dashboard. */
export interface OutcomeHealth {
  realization: number | null;
  adoption: number | null;
  benefit: number | null;
  metricCount: number;
  measuredCount: number;
}

export interface ProjectHealth {
  projectId: string;
  name: string;
  projectType: string | null;
  pmApproach: string | null;
  pct: { scores: PctScores; date: string | null } | null;
  risk: { cc: number | null; oa: number | null; quadrant: RiskQuadrant | null; date: string | null } | null;
  groupCount: number;
  totalPeople: number;
  avgDegreeOfImpact: number | null;
  barrierDistribution: Record<string, number>;
  progress: ProgressSummary;
  overdueCount: number;
  latestCmPerfStatus: CmPerfStatus | null;
  nextMilestone: { date: string; label: string } | null;
  outcomes: OutcomeHealth;
}

/** Roll a project's metric realizations into overall / adoption / benefit figures. */
export function outcomeHealth(metrics: ReadonlyArray<{ kind: 'adoption' | 'benefit'; pct: number | null }>): OutcomeHealth {
  const pctsOf = (kind: 'adoption' | 'benefit') => metrics.filter((m) => m.kind === kind).map((m) => m.pct);
  return {
    realization: overallRealization(metrics.map((m) => m.pct)),
    adoption: overallRealization(pctsOf('adoption')),
    benefit: overallRealization(pctsOf('benefit')),
    metricCount: metrics.length,
    measuredCount: metrics.filter((m) => m.pct !== null).length,
  };
}

export function buildProjectHealth(input: ProjectHealthInput, today: string): ProjectHealth {
  const degrees = input.groups
    .map((g) => degreeOfImpact(g.aspectImpacts))
    .filter((d): d is number => d != null);
  const barrierDistribution: Record<string, number> = {};
  for (const g of input.groups) {
    if (g.barrierPoint) barrierDistribution[g.barrierPoint] = (barrierDistribution[g.barrierPoint] ?? 0) + 1;
  }
  const upcoming = input.upcomingDates
    .filter((u) => u.date >= today)
    .sort((a, b) => (a.date < b.date ? -1 : 1));
  return {
    projectId: input.projectId,
    name: input.name,
    projectType: input.projectType,
    pmApproach: input.pmApproach,
    pct: input.latestPct,
    risk: input.latestRisk,
    groupCount: input.groups.length,
    totalPeople: input.groups.reduce((acc, g) => acc + (g.numPeople ?? 0), 0),
    avgDegreeOfImpact: degrees.length ? degrees.reduce((a, b) => a + b, 0) / degrees.length : null,
    barrierDistribution,
    progress: activityProgress(input.activityStatuses.map((a) => a.status)),
    overdueCount: input.activityStatuses.filter((a) => isOverdue(a.finishDate, a.status, today)).length,
    latestCmPerfStatus: input.latestCmPerfStatus,
    nextMilestone: upcoming[0] ?? null,
    outcomes: outcomeHealth(input.outcomeMetrics),
  };
}

/** Histogram of "Number of Aspects Impacted" across groups (index 1..10). */
export function aspectsImpactedHistogram(groups: Array<{ aspectImpacts: Array<number | null> }>): number[] {
  const counts = Array<number>(11).fill(0);
  for (const g of groups) {
    const n = g.aspectImpacts.filter((v) => typeof v === 'number' && v > 0).length;
    if (n >= 1 && n <= 10) counts[n]!++;
  }
  return counts.slice(1);
}

/** Histogram of "Overall Degree of Impact" across groups, rounded into 1..5 buckets. */
export function degreeOfImpactHistogram(groups: Array<{ aspectImpacts: Array<number | null> }>): number[] {
  const counts = Array<number>(6).fill(0);
  for (const g of groups) {
    const degree = degreeOfImpact(g.aspectImpacts);
    if (degree == null) continue;
    const bucket = Math.min(5, Math.max(1, Math.round(degree)));
    counts[bucket]!++;
  }
  return counts.slice(1);
}

/** Count of groups sitting at each ADKAR barrier point (plus "No barrier"). */
export function barrierPointCounts(barriers: Array<BarrierPoint | null>): Record<string, number> {
  const counts: Record<string, number> = {
    Awareness: 0,
    Desire: 0,
    Knowledge: 0,
    Ability: 0,
    Reinforcement: 0,
    'No barrier': 0,
  };
  for (const b of barriers) {
    if (b) counts[b] = (counts[b] ?? 0) + 1;
  }
  return counts;
}

const CM_PERF_ORDER = ['No Progress', 'Well Behind Target', 'Behind Target', 'On Target', 'Ahead of Target'];

/** The most pessimistic metric status across a report's items (dashboard signal). */
export function worstCmPerfStatus(statuses: Array<string | null>): CmPerfStatus | null {
  let worst: string | null = null;
  for (const s of statuses) {
    if (!s || !CM_PERF_ORDER.includes(s)) continue;
    if (worst === null || CM_PERF_ORDER.indexOf(s) < CM_PERF_ORDER.indexOf(worst)) worst = s;
  }
  return worst as CmPerfStatus | null;
}

export interface PortfolioSummary {
  totalProjects: number;
  highRiskCount: number;
  overdueActivities: number;
  checksDueSoon: number;
  /** Mean realization across projects that have measurable outcomes; null if none do. */
  avgRealization: number | null;
}

export function buildPortfolioSummary(
  projects: ProjectHealth[],
  checkDates: Array<{ date: string | null }>,
  today: string,
  windowDays = 14,
): PortfolioSummary {
  return {
    totalProjects: projects.length,
    highRiskCount: projects.filter((p) => p.risk?.quadrant === 'High').length,
    overdueActivities: projects.reduce((acc, p) => acc + p.overdueCount, 0),
    checksDueSoon: checkDates.filter((c) => isUpcoming(c.date, today, windowDays)).length,
    avgRealization: overallRealization(projects.map((p) => p.outcomes.realization)),
  };
}
