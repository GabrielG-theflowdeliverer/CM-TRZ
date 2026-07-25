import type { ProjectExport } from './project-export.service.js';

/** Version 1 exports carried the pre-unification activity tables and free-form CM perf entries. */
export interface ProjectExportV1
  extends Omit<
    ProjectExport,
    | 'version'
    | 'activities'
    | 'activityAdkar'
    | 'activityGroups'
    | 'activityPlans'
    | 'activityBlueprints'
    | 'activityRoles'
    | 'cmPerfReports'
    | 'cmPerfItems'
  > {
  version: 1;
  blueprintActivities: Record<string, unknown>[];
  planActivities: Record<string, unknown>[];
  cmPerfEntries: Record<string, unknown>[];
}

/** Upgrade a v1 payload to the unified-activity v2 shape (same mapping as migration 002). */
export function upgradeV1(v1: ProjectExportV1): ProjectExport {
  const blueprintById = new Map(v1.blueprints.map((b) => [b.id as string, b]));
  const planById = new Map(v1.plans.map((p) => [p.id as string, p]));
  const activities: Record<string, unknown>[] = [];
  const activityAdkar: Record<string, unknown>[] = [];
  const activityGroups: Record<string, unknown>[] = [];
  const activityPlans: Record<string, unknown>[] = [];
  const activityBlueprints: Record<string, unknown>[] = [];

  for (const ba of v1.blueprintActivities ?? []) {
    const blueprint = blueprintById.get(ba.blueprint_id as string);
    if (!blueprint) continue;
    activities.push({
      id: ba.id,
      project_id: blueprint.project_id,
      position: ba.position ?? 0,
      name: ba.name ?? null,
      method_mechanism: null,
      roles_required_text: ba.roles_required ?? null,
      responsible: null,
      start_date: ba.start_date ?? null,
      finish_date: ba.finish_date ?? null,
      status: ba.status ?? null,
      result_feedback: null,
      overall: blueprint.scope_kind === 'overall' ? 1 : 0,
    });
    if (ba.element) activityAdkar.push({ activity_id: ba.id, element: ba.element });
    activityBlueprints.push({ activity_id: ba.id, blueprint_id: ba.blueprint_id });
    if (blueprint.group_id) activityGroups.push({ activity_id: ba.id, group_id: blueprint.group_id });
  }
  for (const pa of v1.planActivities ?? []) {
    const plan = planById.get(pa.plan_id as string);
    if (!plan) continue;
    activities.push({
      id: pa.id,
      project_id: plan.project_id,
      position: pa.position ?? 0,
      name: pa.name ?? null,
      method_mechanism: pa.method_mechanism ?? null,
      roles_required_text: pa.roles_required ?? null,
      responsible: pa.responsible ?? null,
      start_date: pa.start_date ?? null,
      finish_date: pa.finish_date ?? null,
      status: pa.status ?? null,
      result_feedback: pa.result_feedback ?? null,
      overall: pa.group_id == null ? 1 : 0,
    });
    activityPlans.push({ activity_id: pa.id, plan_id: pa.plan_id });
    if (pa.adkar_outcome) activityAdkar.push({ activity_id: pa.id, element: pa.adkar_outcome });
    if (pa.group_id) activityGroups.push({ activity_id: pa.id, group_id: pa.group_id });
  }
  // Free-form v1 CM perf entries become one "Legacy entries" report.
  const cmPerfReports: Record<string, unknown>[] = [];
  const cmPerfItems: Record<string, unknown>[] = [];
  const legacyEntries = v1.cmPerfEntries ?? [];
  if (legacyEntries.length) {
    const reportId = `${v1.project.id as string}:legacy-cm-perf`;
    cmPerfReports.push({
      id: reportId,
      project_id: v1.project.id,
      name: 'Legacy entries',
      date: null,
      status: 'Completed',
      created_at: '',
    });
    legacyEntries.forEach((entry, i) => {
      cmPerfItems.push({
        id: entry.id ?? `legacy-item-${i}`,
        report_id: reportId,
        position: entry.position ?? i,
        kind: entry.type === 'ADKAR Blueprint' ? 'blueprint' : entry.type ? 'plan' : 'other',
        ref_id: null,
        label: entry.description ?? entry.type ?? null,
        status: entry.status ?? null,
        description: entry.notes ?? null,
      });
    });
  }
  const { blueprintActivities: _ba, planActivities: _pa, cmPerfEntries: _ce, ...rest } = v1;
  return {
    ...rest,
    version: 2,
    activities,
    activityAdkar,
    activityGroups,
    activityPlans,
    activityBlueprints,
    activityRoles: [],
    cmPerfReports,
    cmPerfItems,
    // v1 milestone rows have no group_id column; default them to overall.
    roadmapAdkarMilestones: (v1.roadmapAdkarMilestones ?? []).map((m) => ({ group_id: '', ...m })),
  };
}
