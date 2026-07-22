import {
  ADKAR_LABELS,
  aspectsImpactedHistogram,
  barrierPointCounts,
  buildPortfolioSummary,
  buildProjectHealth,
  degreeOfImpactHistogram,
  buildSaturationRows,
  monthOf,
  monthRange,
  projectWindow,
  type ActivityStatus,
  type BarrierPoint,
  type CmPerfStatus,
  type ProjectHealth,
  type ProjectHealthInput,
  type SaturationGridRow,
  type SaturationProject,
} from '@cmt/domain';
import { today as todayIso, type Db } from '../../infra/db.js';
import * as projects from '../projects/projects.service.js';
import * as assessments from '../assessments/assessments.service.js';
import * as impact from '../impact/impact.service.js';
import * as roadmap from '../roadmap/roadmap.service.js';
import * as cmPerf from '../cm-perf/cm-perf.service.js';
import * as activities from '../activities/activities.service.js';
import * as orgGroups from '../org-groups/org-groups.service.js';

export interface DashboardPayload {
  summary: ReturnType<typeof buildPortfolioSummary>;
  projects: ProjectHealth[];
  generatedAt: string;
}

export interface ProjectDashboardPayload {
  project: ReturnType<typeof projects.getProject>;
  pct: { label: string | null; date: string | null; scores: Record<string, number | null> } | null;
  risk: {
    label: string | null;
    date: string | null;
    subject: string;
    cc: number | null;
    oa: number | null;
    quadrant: string | null;
  } | null;
  /** Every group that has its own risk run, for the dashboard's group-risk list. */
  groupRisks: Array<{ groupId: string; groupName: string; cc: number | null; oa: number | null; quadrant: string | null }>;
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

export interface SaturationPayload {
  months: string[];
  rows: SaturationGridRow[];
  /** The reduced project model, so the client can recompute a what-if locally. */
  projects: SaturationProject[];
  /** Project groups in active projects not linked to any org group — coverage gap. */
  unlinkedGroupCount: number;
}

/**
 * Change-saturation heatmap: per org group per month, the summed load from
 * every non-completed project whose linked groups it represents. Derived on
 * read from roadmap windows + degree of impact (see domain/calc/saturation) —
 * nothing stored. Unlinked project groups contribute nothing but are counted,
 * so gaps in coverage are visible rather than silent. The reduced project model
 * is returned too, so the client can recompute the grid for a "what-if"
 * re-sequencing without a round trip (same domain builder, no shifts here).
 */
export function getSaturation(db: Db, from: string, to: string): SaturationPayload {
  const months = monthRange(from, to);
  const groups = orgGroups.listOrgGroups(db);
  const active = projects.listProjects(db).filter((p) => p.status !== 'Completed');

  let unlinkedGroupCount = 0;
  const model: SaturationProject[] = [];
  for (const project of active) {
    const rm = roadmap.getRoadmap(db, project.id);
    const window = projectWindow(
      rm,
      activities.listActivities(db, project.id).map((a) => ({ startDate: a.startDate, finishDate: a.finishDate })),
    );
    const projectGroups: SaturationProject['groups'] = [];
    for (const group of impact.listGroups(db, project.id)) {
      if (group.orgGroupId === null) {
        unlinkedGroupCount += 1;
        continue;
      }
      projectGroups.push({ orgGroupId: group.orgGroupId, degree: group.computed.degreeOfImpact });
    }
    if (projectGroups.length === 0) continue; // can't affect the heatmap; keep the model focused
    model.push({
      id: project.id,
      name: project.name,
      startMonth: window ? monthOf(window.start) : null,
      endMonth: window ? monthOf(window.end) : null,
      goliveMonth: rm.goliveDate ? monthOf(rm.goliveDate) : null,
      groups: projectGroups,
    });
  }

  return {
    months,
    rows: buildSaturationRows(months, groups, model),
    projects: model,
    unlinkedGroupCount,
  };
}

/** Per-project dashboard (official Proxima's project landing page). */
export function getProjectDashboard(db: Db, projectId: string): ProjectDashboardPayload {
  const project = projects.getProject(db, projectId);
  const latestPct = assessments.latestAssessment(db, projectId, 'pct');
  // Latest risk across ANY subject (overall or a group) so it always surfaces.
  const latestRisk = assessments.latestAssessment(db, projectId, 'risk');
  const groups = impact.listGroups(db, projectId);
  const groupNames = new Map(groups.map((g) => [g.id, g.name]));
  const riskSubject = (a: typeof latestRisk): string =>
    a?.subjectKind === 'group'
      ? (groupNames.get(a.subjectId ?? '') ?? 'Group')
      : 'Overall Change';
  const groupRisks = groups
    .filter((g) => g.computed.risk)
    .map((g) => ({
      groupId: g.id,
      groupName: g.name,
      cc: g.computed.risk!.cc,
      oa: g.computed.risk!.oa,
      quadrant: g.computed.risk!.quadrant,
    }));
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
          subject: riskSubject(latestRisk),
          ...latestRisk.computed.risk,
        }
      : null,
    groupRisks,
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
  const allProjects = projects.listProjects(db).filter((p) => p.status === 'Active');
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
