import {
  ADKAR_LABELS,
  buildPortfolioSummary,
  buildProjectHealth,
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

export interface DashboardPayload {
  summary: ReturnType<typeof buildPortfolioSummary>;
  projects: ProjectHealth[];
  generatedAt: string;
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

    const latestCmPerf = db
      .prepare(
        `SELECT status FROM cm_perf_entries WHERE project_id = ? AND status IS NOT NULL
         ORDER BY COALESCE(completed_date, scheduled_date) DESC, position DESC LIMIT 1`,
      )
      .get(project.id) as { status: string | null } | undefined;

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
      latestCmPerfStatus: (latestCmPerf?.status as CmPerfStatus | null) ?? null,
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
