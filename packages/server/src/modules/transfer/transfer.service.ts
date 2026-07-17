import type { Project } from '@cmt/domain';
import { newId, nowIso, type Db } from '../../infra/db.js';
import { HttpError, notFound } from '../../infra/http.js';
import { getProject } from '../projects/projects.service.js';

/**
 * Full-fidelity project export. The payload carries raw table rows keyed by
 * their original ids; import re-keys everything and remaps references.
 */
export interface ProjectExport {
  format: 'change-management-tool/project';
  version: 2;
  exportedAt: string;
  project: Record<string, unknown>;
  assessments: Record<string, unknown>[];
  assessmentResponses: Record<string, unknown>[];
  groups: Record<string, unknown>[];
  groupAspects: Record<string, unknown>[];
  roles: Record<string, unknown>[];
  roleGroups: Record<string, unknown>[];
  blueprints: Record<string, unknown>[];
  blueprintElements: Record<string, unknown>[];
  blueprintSnapshots: Record<string, unknown>[];
  plans: Record<string, unknown>[];
  activities: Record<string, unknown>[];
  activityAdkar: Record<string, unknown>[];
  activityGroups: Record<string, unknown>[];
  activityPlans: Record<string, unknown>[];
  activityBlueprints: Record<string, unknown>[];
  activityRoles: Record<string, unknown>[];
  roadmap: Record<string, unknown> | null;
  roadmapReleases: Record<string, unknown>[];
  roadmapAdkarMilestones: Record<string, unknown>[];
  trackingEntries: Record<string, unknown>[];
  cmPerfEntries: Record<string, unknown>[];
  adaptActions: Record<string, unknown>[];
  projectDocs: Record<string, unknown>[];
  resistanceItems: Record<string, unknown>[];
}

/** Version 1 exports carried the pre-unification activity tables. */
interface ProjectExportV1 extends Omit<ProjectExport, 'version' | 'activities' | 'activityAdkar' | 'activityGroups' | 'activityPlans' | 'activityBlueprints' | 'activityRoles'> {
  version: 1;
  blueprintActivities: Record<string, unknown>[];
  planActivities: Record<string, unknown>[];
}

/** Upgrade a v1 payload to the unified-activity v2 shape (same mapping as migration 002). */
function upgradeV1(v1: ProjectExportV1): ProjectExport {
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
  const { blueprintActivities: _ba, planActivities: _pa, ...rest } = v1;
  return {
    ...rest,
    version: 2,
    activities,
    activityAdkar,
    activityGroups,
    activityPlans,
    activityBlueprints,
    activityRoles: [],
    // v1 milestone rows have no group_id column; default them to overall.
    roadmapAdkarMilestones: (v1.roadmapAdkarMilestones ?? []).map((m) => ({ group_id: '', ...m })),
  };
}

function rows(db: Db, sql: string, projectId: string): Record<string, unknown>[] {
  return db.prepare(sql).all(projectId) as Record<string, unknown>[];
}

export function exportProject(db: Db, projectId: string): ProjectExport {
  getProject(db, projectId);
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId) as Record<string, unknown>;
  return {
    format: 'change-management-tool/project',
    version: 2,
    exportedAt: nowIso(),
    project,
    assessments: rows(db, 'SELECT * FROM assessments WHERE project_id = ?', projectId),
    assessmentResponses: rows(
      db,
      `SELECT ar.* FROM assessment_responses ar JOIN assessments a ON a.id = ar.assessment_id WHERE a.project_id = ?`,
      projectId,
    ),
    groups: rows(db, 'SELECT * FROM impacted_groups WHERE project_id = ?', projectId),
    groupAspects: rows(
      db,
      `SELECT ga.* FROM group_aspects ga JOIN impacted_groups g ON g.id = ga.group_id WHERE g.project_id = ?`,
      projectId,
    ),
    roles: rows(db, 'SELECT * FROM roles WHERE project_id = ?', projectId),
    roleGroups: rows(
      db,
      `SELECT rg.* FROM role_groups rg JOIN roles r ON r.id = rg.role_id WHERE r.project_id = ?`,
      projectId,
    ),
    blueprints: rows(db, 'SELECT * FROM blueprints WHERE project_id = ?', projectId),
    blueprintElements: rows(
      db,
      `SELECT be.* FROM blueprint_elements be JOIN blueprints b ON b.id = be.blueprint_id WHERE b.project_id = ?`,
      projectId,
    ),
    blueprintSnapshots: rows(
      db,
      `SELECT bs.* FROM blueprint_snapshots bs JOIN blueprints b ON b.id = bs.blueprint_id WHERE b.project_id = ?`,
      projectId,
    ),
    plans: rows(db, 'SELECT * FROM plans WHERE project_id = ?', projectId),
    activities: rows(db, 'SELECT * FROM activities WHERE project_id = ?', projectId),
    activityAdkar: rows(
      db,
      `SELECT aa.* FROM activity_adkar aa JOIN activities a ON a.id = aa.activity_id WHERE a.project_id = ?`,
      projectId,
    ),
    activityGroups: rows(
      db,
      `SELECT ag.* FROM activity_groups ag JOIN activities a ON a.id = ag.activity_id WHERE a.project_id = ?`,
      projectId,
    ),
    activityPlans: rows(
      db,
      `SELECT ap.* FROM activity_plans ap JOIN activities a ON a.id = ap.activity_id WHERE a.project_id = ?`,
      projectId,
    ),
    activityBlueprints: rows(
      db,
      `SELECT ab.* FROM activity_blueprints ab JOIN activities a ON a.id = ab.activity_id WHERE a.project_id = ?`,
      projectId,
    ),
    activityRoles: rows(
      db,
      `SELECT ar2.* FROM activity_roles ar2 JOIN activities a ON a.id = ar2.activity_id WHERE a.project_id = ?`,
      projectId,
    ),
    roadmap: (db.prepare('SELECT * FROM roadmaps WHERE project_id = ?').get(projectId) as Record<string, unknown>) ?? null,
    roadmapReleases: rows(db, 'SELECT * FROM roadmap_releases WHERE project_id = ?', projectId),
    roadmapAdkarMilestones: rows(db, 'SELECT * FROM roadmap_adkar_milestones WHERE project_id = ?', projectId),
    trackingEntries: rows(db, 'SELECT * FROM tracking_entries WHERE project_id = ?', projectId),
    cmPerfEntries: rows(db, 'SELECT * FROM cm_perf_entries WHERE project_id = ?', projectId),
    adaptActions: rows(db, 'SELECT * FROM adapt_actions WHERE project_id = ?', projectId),
    projectDocs: rows(db, 'SELECT * FROM project_docs WHERE project_id = ?', projectId),
    resistanceItems: rows(db, 'SELECT * FROM resistance_items WHERE project_id = ?', projectId),
  };
}

function insertRow(db: Db, table: string, row: Record<string, unknown>): void {
  const keys = Object.keys(row);
  const sql = `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`;
  db.prepare(sql).run(...keys.map((k) => row[k]));
}

export function importProject(
  db: Db,
  rawPayload: ProjectExport | ProjectExportV1,
  options?: { name?: string },
): Project {
  if (rawPayload?.format !== 'change-management-tool/project' || ![1, 2].includes(rawPayload.version)) {
    throw new HttpError(400, 'Unrecognized project export format');
  }
  const payload: ProjectExport = rawPayload.version === 1 ? upgradeV1(rawPayload) : rawPayload;
  const newProjectId = newId();
  const now = nowIso();

  // Old id -> new id maps for every re-keyed entity.
  const groupIds = new Map<string, string>();
  const roleIds = new Map<string, string>();
  const assessmentIds = new Map<string, string>();
  const blueprintIds = new Map<string, string>();
  const planIds = new Map<string, string>();
  const activityIds = new Map<string, string>();

  const remap = (map: Map<string, string>, oldId: unknown): string | null =>
    typeof oldId === 'string' ? (map.get(oldId) ?? null) : null;

  db.transaction(() => {
    insertRow(db, 'projects', {
      ...payload.project,
      id: newProjectId,
      name: options?.name ?? payload.project.name,
      created_at: now,
      updated_at: now,
    });

    for (const g of payload.groups) {
      const id = newId();
      groupIds.set(g.id as string, id);
      insertRow(db, 'impacted_groups', { ...g, id, project_id: newProjectId });
    }
    for (const ga of payload.groupAspects) {
      const groupId = remap(groupIds, ga.group_id);
      if (groupId) insertRow(db, 'group_aspects', { ...ga, group_id: groupId });
    }
    for (const r of payload.roles) {
      const id = newId();
      roleIds.set(r.id as string, id);
      insertRow(db, 'roles', { ...r, id, project_id: newProjectId });
    }
    for (const rg of payload.roleGroups) {
      const roleId = remap(roleIds, rg.role_id);
      const groupId = remap(groupIds, rg.group_id);
      if (roleId && groupId) insertRow(db, 'role_groups', { role_id: roleId, group_id: groupId });
    }
    for (const a of payload.assessments) {
      const id = newId();
      assessmentIds.set(a.id as string, id);
      let subjectId = a.subject_id as string | null;
      if (a.subject_kind === 'group') subjectId = remap(groupIds, subjectId);
      if (a.subject_kind === 'role') subjectId = remap(roleIds, subjectId);
      insertRow(db, 'assessments', { ...a, id, project_id: newProjectId, subject_id: subjectId });
    }
    for (const ar of payload.assessmentResponses) {
      const assessmentId = remap(assessmentIds, ar.assessment_id);
      if (assessmentId) insertRow(db, 'assessment_responses', { ...ar, assessment_id: assessmentId });
    }
    for (const b of payload.blueprints) {
      const id = newId();
      blueprintIds.set(b.id as string, id);
      insertRow(db, 'blueprints', {
        ...b,
        id,
        project_id: newProjectId,
        group_id: remap(groupIds, b.group_id),
      });
    }
    for (const be of payload.blueprintElements) {
      const blueprintId = remap(blueprintIds, be.blueprint_id);
      if (blueprintId) insertRow(db, 'blueprint_elements', { ...be, blueprint_id: blueprintId });
    }
    for (const bs of payload.blueprintSnapshots) {
      const blueprintId = remap(blueprintIds, bs.blueprint_id);
      if (blueprintId) insertRow(db, 'blueprint_snapshots', { ...bs, id: newId(), blueprint_id: blueprintId });
    }
    for (const p of payload.plans) {
      const id = newId();
      planIds.set(p.id as string, id);
      insertRow(db, 'plans', { ...p, id, project_id: newProjectId });
    }
    for (const a of payload.activities) {
      const id = newId();
      activityIds.set(a.id as string, id);
      insertRow(db, 'activities', { ...a, id, project_id: newProjectId });
    }
    const linkInsert = (
      rows2: Record<string, unknown>[],
      table: string,
      column: string,
      map: Map<string, string>,
    ) => {
      for (const link of rows2) {
        const activityId = remap(activityIds, link.activity_id);
        const target = remap(map, link[column]);
        if (activityId && target) insertRow(db, table, { activity_id: activityId, [column]: target });
      }
    };
    for (const aa of payload.activityAdkar) {
      const activityId = remap(activityIds, aa.activity_id);
      if (activityId) insertRow(db, 'activity_adkar', { activity_id: activityId, element: aa.element });
    }
    linkInsert(payload.activityGroups, 'activity_groups', 'group_id', groupIds);
    linkInsert(payload.activityPlans, 'activity_plans', 'plan_id', planIds);
    linkInsert(payload.activityBlueprints, 'activity_blueprints', 'blueprint_id', blueprintIds);
    linkInsert(payload.activityRoles, 'activity_roles', 'role_id', roleIds);
    if (payload.roadmap) insertRow(db, 'roadmaps', { ...payload.roadmap, project_id: newProjectId });
    for (const rr of payload.roadmapReleases) insertRow(db, 'roadmap_releases', { ...rr, project_id: newProjectId });
    for (const rm of payload.roadmapAdkarMilestones) {
      const groupId = rm.group_id === '' || rm.group_id == null ? '' : remap(groupIds, rm.group_id);
      if (groupId === null) continue; // milestone for a group that no longer exists
      insertRow(db, 'roadmap_adkar_milestones', { ...rm, project_id: newProjectId, group_id: groupId });
    }
    for (const t of payload.trackingEntries) {
      insertRow(db, 'tracking_entries', { ...t, id: newId(), project_id: newProjectId });
    }
    for (const c of payload.cmPerfEntries) insertRow(db, 'cm_perf_entries', { ...c, id: newId(), project_id: newProjectId });
    for (const a of payload.adaptActions) insertRow(db, 'adapt_actions', { ...a, id: newId(), project_id: newProjectId });
    for (const d of payload.projectDocs) insertRow(db, 'project_docs', { ...d, project_id: newProjectId });
    for (const ri of payload.resistanceItems) {
      insertRow(db, 'resistance_items', {
        ...ri,
        id: newId(),
        project_id: newProjectId,
        group_id: remap(groupIds, ri.group_id),
      });
    }
  })();

  return getProject(db, newProjectId);
}

/** Duplicate = lossless export -> import under a new name. */
export function duplicateProject(db: Db, projectId: string): Project {
  const source = getProject(db, projectId) ?? notFound('Project');
  const payload = exportProject(db, projectId);
  return importProject(db, payload, { name: `${source.name} (copy)` });
}
