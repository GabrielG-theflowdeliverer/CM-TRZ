import {
  ADKAR_LABELS,
  aspectsImpactedHistogram,
  barrierPointCounts,
  buildPortfolioSummary,
  buildProjectHealth,
  degreeOfImpactHistogram,
  type ActivityStatus,
  type BarrierPoint,
  type CmPerfStatus,
  type ProjectHealth,
  type ProjectHealthInput,
} from '@cmt/domain';
import { today as todayIso, type Db } from '../../infra/db.js';
import * as projects from '../projects/projects.service.js';
import * as assessments from '../assessments/assessments.service.js';
import * as impact from '../impact/impact.service.js';
import * as roadmap from '../roadmap/roadmap.service.js';
import * as cmPerf from '../cm-perf/cm-perf.service.js';

export interface DashboardPayload {
  summary: ReturnType<typeof buildPortfolioSummary>;
  projects: ProjectHealth[];
  generatedAt: string;
}

export interface ProjectDashboardPayload {
  project: ReturnType<typeof projects.getProject>;
  pct: { label: string | null; date: string | null; scores: Record<string, number | null> } | null;
  risk: { label: string | null; date: string | null; cc: number | null; oa: number | null; quadrant: string | null } | null;
  aspectsImpactedHistogram: number[];
  degreeOfImpactHistogram: number[];
  barrierCounts: Record<string, number>;
  groups: Array<{
    id: string;
    name: string;
    numPeople: number | null;
    aspectsImpacted: number;
    degreeOfImpact: number | null;
    barrierPoint: string | null;
    riskQuadrant: string | null;
  }>;
  latestCmPerf: { id: string; name: string; date: string | null; worstStatus: string | null } | null;
}

/** Per-project dashboard (official Proxima's project landing page). */
export function getProjectDashboard(db: Db, projectId: string): ProjectDashboardPayload {
  const project = projects.getProject(db, projectId);
  const latestPct = assessments.latestAssessment(db, projectId, 'pct');
  const latestRisk = assessments.latestAssessment(db, projectId, 'risk', { kind: 'project', id: null });
  const groups = impact.listGroups(db, projectId);
  const histogramInput = groups.map((g) => ({ aspectImpacts: g.aspects.map((a) => a.impact) }));
  const latestReport = cmPerf
    .listReports(db, projectId)
    .sort((a, b) => ((a.date ?? a.createdAt) < (b.date ?? b.createdAt) ? 1 : -1))[0];
  return {
    project,
    pct: latestPct?.computed.pct
      ? {
          label: latestPct.label,
          date: latestPct.completedDate ?? latestPct.scheduledDate,
          scores: latestPct.computed.pct as unknown as Record<string, number | null>,
        }
      : null,
    risk: latestRisk?.computed.risk
      ? {
          label: latestRisk.label,
          date: latestRisk.completedDate ?? latestRisk.scheduledDate,
          ...latestRisk.computed.risk,
        }
      : null,
    aspectsImpactedHistogram: aspectsImpactedHistogram(histogramInput),
    degreeOfImpactHistogram: degreeOfImpactHistogram(histogramInput),
    barrierCounts: barrierPointCounts(groups.map((g) => g.computed.barrierPoint as BarrierPoint | null)),
    groups: groups.map((g) => ({
      id: g.id,
      name: g.name,
      numPeople: g.numPeople,
      aspectsImpacted: g.computed.aspectsImpacted,
      degreeOfImpact: g.computed.degreeOfImpact,
      barrierPoint: g.computed.barrierPoint,
      riskQuadrant: g.computed.risk?.quadrant ?? null,
    })),
    latestCmPerf: latestReport
      ? {
          id: latestReport.id,
          name: latestReport.name,
          date: latestReport.date,
          worstStatus: cmPerf.latestReportStatus(db, projectId),
        }
      : null,
  };
}

export function getDashboard(db: Db): DashboardPayload {
  const today = todayIso();
  const allProjects = projects.listProjects(db).filter((p) => !p.archived);
  const healths: ProjectHealth[] = [];
  const allCheckDates: Array<{ date: string | null }> = [];

  for (const project of allProjects) {
    const latestPct = assessments.latestAssessment(db, project.id, 'pct');
    const latestRisk = assessments.latestAssessment(db, project.id, 'risk');
    const groups = impact.listGroups(db, project.id);

    // Unified activities: each counts once no matter how many plans/blueprints link it.
    const activityStatuses = (
      db
        .prepare(`SELECT status, finish_date FROM activities WHERE project_id = ?`)
        .all(project.id) as Array<{ status: string | null; finish_date: string | null }>
    ).map((r) => ({ status: r.status as ActivityStatus | null, finishDate: r.finish_date }));

    const latestCmPerfStatus = cmPerf.latestReportStatus(db, project.id);

    // Candidate "next milestone" dates: roadmap milestones + scheduled checks.
    const upcomingDates: Array<{ date: string; label: string }> = [];
    const rm = roadmap.getRoadmap(db, project.id);
    if (rm.kickoffDate) upcomingDates.push({ date: rm.kickoffDate, label: 'Kickoff' });
    if (rm.goliveDate) upcomingDates.push({ date: rm.goliveDate, label: 'Go Live' });
    if (rm.outcomesDate) upcomingDates.push({ date: rm.outcomesDate, label: 'Outcomes' });
    for (const m of rm.adkarMilestones) {
      if (m.date) {
        const label = ADKAR_LABELS[m.element as keyof typeof ADKAR_LABELS] ?? m.element;
        upcomingDates.push({
          date: m.date,
          label: m.releaseNo === 0 ? `${label} milestone` : `${label} milestone (Release ${m.releaseNo})`,
        });
      }
    }
    for (const r of rm.releases) {
      if (r.date) upcomingDates.push({ date: r.date, label: `Release ${r.releaseNo}` });
    }
    const checks = db
      .prepare(
        `SELECT scheduled_date, description, completed_date FROM tracking_entries WHERE project_id = ? AND scheduled_date IS NOT NULL`,
      )
      .all(project.id) as Array<{ scheduled_date: string; description: string | null; completed_date: string | null }>;
    for (const c of checks) {
      upcomingDates.push({ date: c.scheduled_date, label: c.description ?? 'Status check' });
      if (!c.completed_date) allCheckDates.push({ date: c.scheduled_date });
    }

    const input: ProjectHealthInput = {
      projectId: project.id,
      name: project.name,
      projectType: project.projectType,
      pmApproach: project.pmApproach,
      latestPct: latestPct?.computed.pct
        ? { scores: latestPct.computed.pct, date: latestPct.completedDate ?? latestPct.scheduledDate }
        : null,
      latestRisk: latestRisk?.computed.risk
        ? { ...latestRisk.computed.risk, date: latestRisk.completedDate ?? latestRisk.scheduledDate }
        : null,
      groups: groups.map((g) => ({
        numPeople: g.numPeople,
        aspectImpacts: g.aspects.map((a) => a.impact),
        barrierPoint: g.computed.barrierPoint as BarrierPoint | null,
      })),
      activityStatuses,
      latestCmPerfStatus: (latestCmPerfStatus as CmPerfStatus | null) ?? null,
      upcomingDates,
    };
    healths.push(buildProjectHealth(input, today));
  }

  return {
    summary: buildPortfolioSummary(healths, allCheckDates, today),
    projects: healths,
    generatedAt: today,
  };
}
