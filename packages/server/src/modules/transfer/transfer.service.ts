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
  version: 1;
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
  blueprintActivities: Record<string, unknown>[];
  blueprintSnapshots: Record<string, unknown>[];
  plans: Record<string, unknown>[];
  planActivities: Record<string, unknown>[];
  roadmap: Record<string, unknown> | null;
  roadmapReleases: Record<string, unknown>[];
  roadmapAdkarMilestones: Record<string, unknown>[];
  trackingEntries: Record<string, unknown>[];
  cmPerfEntries: Record<string, unknown>[];
  adaptActions: Record<string, unknown>[];
  projectDocs: Record<string, unknown>[];
  resistanceItems: Record<string, unknown>[];
}

function rows(db: Db, sql: string, projectId: string): Record<string, unknown>[] {
  return db.prepare(sql).all(projectId) as Record<string, unknown>[];
}

export function exportProject(db: Db, projectId: string): ProjectExport {
  getProject(db, projectId);
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId) as Record<string, unknown>;
  return {
    format: 'change-management-tool/project',
    version: 1,
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
    blueprintActivities: rows(
      db,
      `SELECT ba.* FROM blueprint_activities ba JOIN blueprints b ON b.id = ba.blueprint_id WHERE b.project_id = ?`,
      projectId,
    ),
    blueprintSnapshots: rows(
      db,
      `SELECT bs.* FROM blueprint_snapshots bs JOIN blueprints b ON b.id = bs.blueprint_id WHERE b.project_id = ?`,
      projectId,
    ),
    plans: rows(db, 'SELECT * FROM plans WHERE project_id = ?', projectId),
    planActivities: rows(
      db,
      `SELECT pa.* FROM plan_activities pa JOIN plans p ON p.id = pa.plan_id WHERE p.project_id = ?`,
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

export function importProject(db: Db, payload: ProjectExport, options?: { name?: string }): Project {
  if (payload?.format !== 'change-management-tool/project' || payload.version !== 1) {
    throw new HttpError(400, 'Unrecognized project export format');
  }
  const newProjectId = newId();
  const now = nowIso();

  // Old id -> new id maps for every re-keyed entity.
  const groupIds = new Map<string, string>();
  const roleIds = new Map<string, string>();
  const assessmentIds = new Map<string, string>();
  const blueprintIds = new Map<string, string>();
  const planIds = new Map<string, string>();

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
    for (const ba of payload.blueprintActivities) {
      const blueprintId = remap(blueprintIds, ba.blueprint_id);
      if (blueprintId) insertRow(db, 'blueprint_activities', { ...ba, id: newId(), blueprint_id: blueprintId });
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
    for (const pa of payload.planActivities) {
      const planId = remap(planIds, pa.plan_id);
      if (planId) {
        insertRow(db, 'plan_activities', {
          ...pa,
          id: newId(),
          plan_id: planId,
          group_id: remap(groupIds, pa.group_id),
        });
      }
    }
    if (payload.roadmap) insertRow(db, 'roadmaps', { ...payload.roadmap, project_id: newProjectId });
    for (const rr of payload.roadmapReleases) insertRow(db, 'roadmap_releases', { ...rr, project_id: newProjectId });
    for (const rm of payload.roadmapAdkarMilestones) {
      insertRow(db, 'roadmap_adkar_milestones', { ...rm, project_id: newProjectId });
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
