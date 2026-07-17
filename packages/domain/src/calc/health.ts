import type { PctScores } from './pct.js';
import type { RiskQuadrant } from './risk.js';
import type { BarrierPoint } from './adkar.js';
import type { ActivityStatus, CmPerfStatus } from '../vocab/index.js';
import { activityProgress, isOverdue, isUpcoming, type ProgressSummary } from './progress.js';
import { degreeOfImpact } from './impact.js';

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
  };
}

export interface PortfolioSummary {
  totalProjects: number;
  highRiskCount: number;
  overdueActivities: number;
  checksDueSoon: number;
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
  };
}
