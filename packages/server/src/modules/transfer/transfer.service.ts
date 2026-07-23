import { z } from 'zod';
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
  cmPerfReports: Record<string, unknown>[];
  cmPerfItems: Record<string, unknown>[];
  adaptActions: Record<string, unknown>[];
  projectDocs: Record<string, unknown>[];
  resistanceItems: Record<string, unknown>[];
}

/** Version 1 exports carried the pre-unification activity tables and free-form CM perf entries. */
interface ProjectExportV1
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

function rows(db: Db, sql: string, projectId: string): Record<string, unknown>[] {
  return db.prepare(sql).all(projectId) as Record<string, unknown>[];
}

export function exportProject(db: Db, projectId: string): ProjectExport {
  getProject(db, projectId);
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId) as Record<string, unknown>;
  // Never carry the live share token in an export file — it's an access
  // credential, and its UNIQUE index would collide on import/duplicate.
  delete project.share_token;
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
    cmPerfReports: rows(db, 'SELECT * FROM cm_perf_reports WHERE project_id = ?', projectId),
    cmPerfItems: rows(
      db,
      `SELECT ci.* FROM cm_perf_items ci JOIN cm_perf_reports cr ON cr.id = ci.report_id WHERE cr.project_id = ?`,
      projectId,
    ),
    adaptActions: rows(db, 'SELECT * FROM adapt_actions WHERE project_id = ?', projectId),
    projectDocs: rows(db, 'SELECT * FROM project_docs WHERE project_id = ?', projectId),
    resistanceItems: rows(db, 'SELECT * FROM resistance_items WHERE project_id = ?', projectId),
  };
}

const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;

function insertRow(db: Db, table: string, row: Record<string, unknown>): void {
  const keys = Object.keys(row);
  // Column names come from the (untrusted) import payload and are interpolated
  // into SQL, so every one must be a plain identifier — reject anything else as
  // a bad payload (400) rather than letting it reach the query builder. Values
  // stay parameterized; identifiers are also quoted defensively.
  for (const k of keys) {
    if (!IDENTIFIER.test(k)) throw new HttpError(400, `Invalid column name in import payload: ${k}`);
  }
  const cols = keys.map((k) => `"${k}"`).join(', ');
  const sql = `INSERT INTO ${table} (${cols}) VALUES (${keys.map(() => '?').join(', ')})`;
  db.prepare(sql).run(...keys.map((k) => row[k]));
}

const importRow = z.record(z.string(), z.unknown());
const importRows = z.array(importRow).default([]);

/**
 * Envelope validation for POST /api/import. Guarantees the format/version and
 * that every collection the importer iterates is actually an array (so a
 * malformed file yields a 400, not a mid-transaction 500). Per-row column keys
 * are validated separately in insertRow. Unknown top-level keys are dropped.
 */
export const projectExportSchema = z.object({
  format: z.literal('change-management-tool/project'),
  version: z.union([z.literal(1), z.literal(2)]),
  project: importRow,
  roadmap: importRow.nullable().default(null),
  assessments: importRows,
  assessmentResponses: importRows,
  groups: importRows,
  groupAspects: importRows,
  roles: importRows,
  roleGroups: importRows,
  blueprints: importRows,
  blueprintElements: importRows,
  blueprintSnapshots: importRows,
  plans: importRows,
  activities: importRows,
  activityAdkar: importRows,
  activityGroups: importRows,
  activityPlans: importRows,
  activityBlueprints: importRows,
  activityRoles: importRows,
  roadmapReleases: importRows,
  roadmapAdkarMilestones: importRows,
  trackingEntries: importRows,
  cmPerfReports: importRows,
  cmPerfItems: importRows,
  adaptActions: importRows,
  projectDocs: importRows,
  resistanceItems: importRows,
  // v1-only collections (upgraded to the v2 shape by upgradeV1); optional so a
  // v2 payload validates without them.
  blueprintActivities: importRows.optional(),
  planActivities: importRows.optional(),
  cmPerfEntries: importRows.optional(),
});

export type ProjectImportPayload = z.infer<typeof projectExportSchema>;

export function importProject(db: Db, rawPayload: ProjectImportPayload, options?: { name?: string }): Project {
  const payload: ProjectExport =
    rawPayload.version === 1
      ? upgradeV1(rawPayload as unknown as ProjectExportV1)
      : (rawPayload as unknown as ProjectExport);
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
    // watch_group_ids reference old group ids; blank now, remap after groups exist.
    // share_token is a per-project credential with a UNIQUE index — never copy it.
    insertRow(db, 'projects', {
      ...payload.project,
      id: newProjectId,
      name: options?.name ?? payload.project.name,
      watch_group_ids: null,
      share_token: null,
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
    const reportIds = new Map<string, string>();
    for (const cr of payload.cmPerfReports) {
      const id = newId();
      reportIds.set(cr.id as string, id);
      insertRow(db, 'cm_perf_reports', { ...cr, id, project_id: newProjectId });
    }
    for (const ci of payload.cmPerfItems) {
      const reportId = remap(reportIds, ci.report_id);
      if (!reportId) continue;
      // ref_id points at a blueprint or plan; remap when possible, keep the label otherwise.
      let refId: string | null = null;
      if (typeof ci.ref_id === 'string') {
        refId = ci.kind === 'blueprint' ? remap(blueprintIds, ci.ref_id) : remap(planIds, ci.ref_id);
      }
      insertRow(db, 'cm_perf_items', { ...ci, id: newId(), report_id: reportId, ref_id: refId });
    }
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

    // Remap the watch list now that group ids are known.
    const oldWatch = (() => {
      try {
        return payload.project.watch_group_ids ? (JSON.parse(payload.project.watch_group_ids as string) as string[]) : [];
      } catch {
        return [];
      }
    })();
    const newWatch = oldWatch.map((oldId) => remap(groupIds, oldId)).filter((x): x is string => !!x);
    db.prepare('UPDATE projects SET watch_group_ids = ? WHERE id = ?').run(JSON.stringify(newWatch), newProjectId);
  })();

  return getProject(db, newProjectId);
}

/** Duplicate = lossless export -> import under a new name. */
export function duplicateProject(db: Db, projectId: string): Project {
  const source = getProject(db, projectId) ?? notFound('Project');
  const payload = exportProject(db, projectId);
  return importProject(db, payload, { name: `${source.name} (copy)` });
}
