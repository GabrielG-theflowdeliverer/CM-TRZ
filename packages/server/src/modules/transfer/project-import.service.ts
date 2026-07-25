import { z } from 'zod';
import type { Project } from '@cmt/domain';
import { newId, nowIso, type Db } from '../../infra/db.js';
import { getProject } from '../projects/projects.service.js';
import { insertRow, setWatchGroupIds } from './transfer.repo.js';
import type { ProjectExport } from './project-export.service.js';
import { upgradeV1, type ProjectExportV1 } from './export-v1-upgrade.js';

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
    setWatchGroupIds(db, newProjectId, newWatch);
  })();

  return getProject(db, newProjectId);
}
