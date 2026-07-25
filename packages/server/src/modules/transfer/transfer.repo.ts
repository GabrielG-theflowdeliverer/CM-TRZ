import type { Db } from '../../infra/db.js';
import { HttpError } from '../../infra/http.js';

type Row = Record<string, unknown>;

/**
 * Every table that makes up a project, as raw rows keyed by their original ids.
 * This is the data-layer half of the export contract: the transfer service adds
 * the file-format envelope (format/version/exportedAt) around it.
 */
export interface ExportRowSets {
  project: Row;
  assessments: Row[];
  assessmentResponses: Row[];
  groups: Row[];
  groupAspects: Row[];
  roles: Row[];
  roleGroups: Row[];
  blueprints: Row[];
  blueprintElements: Row[];
  blueprintSnapshots: Row[];
  plans: Row[];
  activities: Row[];
  activityAdkar: Row[];
  activityGroups: Row[];
  activityPlans: Row[];
  activityBlueprints: Row[];
  activityRoles: Row[];
  roadmap: Row | null;
  roadmapReleases: Row[];
  roadmapAdkarMilestones: Row[];
  trackingEntries: Row[];
  cmPerfReports: Row[];
  cmPerfItems: Row[];
  adaptActions: Row[];
  projectDocs: Row[];
  resistanceItems: Row[];
}

function rows(db: Db, sql: string, projectId: string): Row[] {
  return db.prepare(sql).all(projectId) as Row[];
}

/** Read every row belonging to a project, for a full-fidelity export. */
export function readExportRowSets(db: Db, projectId: string): ExportRowSets {
  return {
    project: db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId) as Row,
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
    roadmap: (db.prepare('SELECT * FROM roadmaps WHERE project_id = ?').get(projectId) as Row | undefined) ?? null,
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

/** Rewrite the imported project's watch list once group ids have been re-keyed. */
export function setWatchGroupIds(db: Db, projectId: string, groupIds: string[]): void {
  db.prepare('UPDATE projects SET watch_group_ids = ? WHERE id = ?').run(JSON.stringify(groupIds), projectId);
}

const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;

/** Insert a raw imported row, taking its columns from the payload's own keys. */
export function insertRow(db: Db, table: string, row: Row): void {
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
