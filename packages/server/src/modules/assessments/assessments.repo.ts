import type { Assessment, AssessmentType, SubjectKind } from '@cmt/domain';
import type { Db } from '../../infra/db.js';

interface AssessmentRow {
  id: string;
  project_id: string;
  type: string;
  subject_kind: string;
  subject_id: string | null;
  label: string | null;
  scheduled_date: string | null;
  completed_date: string | null;
  status: string | null;
  notes: string | null;
  created_at: string;
}

function toAssessment(row: AssessmentRow, responses: Record<string, number | null>): Assessment {
  return {
    id: row.id,
    projectId: row.project_id,
    type: row.type as AssessmentType,
    subjectKind: row.subject_kind as SubjectKind,
    subjectId: row.subject_id,
    label: row.label,
    scheduledDate: row.scheduled_date,
    completedDate: row.completed_date,
    status: row.status,
    notes: row.notes,
    createdAt: row.created_at,
    responses,
  };
}

export function getResponses(db: Db, assessmentId: string): Record<string, number | null> {
  const rows = db
    .prepare('SELECT item_key, value FROM assessment_responses WHERE assessment_id = ?')
    .all(assessmentId) as Array<{ item_key: string; value: number | null }>;
  const map: Record<string, number | null> = {};
  for (const r of rows) map[r.item_key] = r.value;
  return map;
}

export function getAssessment(db: Db, id: string): Assessment | null {
  const row = db.prepare('SELECT * FROM assessments WHERE id = ?').get(id) as AssessmentRow | undefined;
  return row ? toAssessment(row, getResponses(db, row.id)) : null;
}

export function listAssessments(
  db: Db,
  projectId: string,
  filter: { type?: string; subjectKind?: string; subjectId?: string },
): Assessment[] {
  let sql = 'SELECT * FROM assessments WHERE project_id = ?';
  const params: unknown[] = [projectId];
  if (filter.type) {
    sql += ' AND type = ?';
    params.push(filter.type);
  }
  if (filter.subjectKind) {
    sql += ' AND subject_kind = ?';
    params.push(filter.subjectKind);
  }
  if (filter.subjectId) {
    sql += ' AND subject_id = ?';
    params.push(filter.subjectId);
  }
  sql += ' ORDER BY created_at';
  const rows = db.prepare(sql).all(...params) as AssessmentRow[];
  return rows.map((row) => toAssessment(row, getResponses(db, row.id)));
}

/**
 * Latest run for trend/dashboard purposes. Completed runs always outrank
 * scheduled/in-progress ones (a future-dated empty run must not mask real
 * results); within each tier, newest first.
 */
export function latestAssessment(
  db: Db,
  projectId: string,
  type: string,
  subject?: { kind: string; id: string | null },
): Assessment | null {
  let sql = 'SELECT * FROM assessments WHERE project_id = ? AND type = ?';
  const params: unknown[] = [projectId, type];
  if (subject) {
    sql += ' AND subject_kind = ?';
    params.push(subject.kind);
    if (subject.id === null) sql += ' AND subject_id IS NULL';
    else {
      sql += ' AND subject_id = ?';
      params.push(subject.id);
    }
  }
  sql +=
    ' ORDER BY (completed_date IS NOT NULL) DESC, COALESCE(completed_date, created_at) DESC, created_at DESC LIMIT 1';
  const row = db.prepare(sql).get(...params) as AssessmentRow | undefined;
  return row ? toAssessment(row, getResponses(db, row.id)) : null;
}

export function insertAssessment(
  db: Db,
  a: {
    id: string;
    projectId: string;
    type: string;
    subjectKind: string;
    subjectId: string | null;
    label: string | null;
    scheduledDate: string | null;
    completedDate: string | null;
    status: string | null;
    notes: string | null;
    createdAt: string;
  },
): void {
  db.prepare(
    `INSERT INTO assessments (id, project_id, type, subject_kind, subject_id, label, scheduled_date, completed_date, status, notes, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    a.id,
    a.projectId,
    a.type,
    a.subjectKind,
    a.subjectId,
    a.label,
    a.scheduledDate,
    a.completedDate,
    a.status,
    a.notes,
    a.createdAt,
  );
}

export function updateAssessment(
  db: Db,
  id: string,
  fields: {
    label?: string | null;
    scheduledDate?: string | null;
    completedDate?: string | null;
    status?: string | null;
    notes?: string | null;
  },
): boolean {
  const row = db.prepare('SELECT * FROM assessments WHERE id = ?').get(id) as AssessmentRow | undefined;
  if (!row) return false;
  db.prepare(
    `UPDATE assessments SET label = ?, scheduled_date = ?, completed_date = ?, status = ?, notes = ? WHERE id = ?`,
  ).run(
    fields.label !== undefined ? fields.label : row.label,
    fields.scheduledDate !== undefined ? fields.scheduledDate : row.scheduled_date,
    fields.completedDate !== undefined ? fields.completedDate : row.completed_date,
    fields.status !== undefined ? fields.status : row.status,
    fields.notes !== undefined ? fields.notes : row.notes,
    id,
  );
  return true;
}

export function deleteAssessment(db: Db, id: string): boolean {
  return db.prepare('DELETE FROM assessments WHERE id = ?').run(id).changes > 0;
}

export function upsertResponses(db: Db, assessmentId: string, responses: Record<string, number | null>): void {
  const stmt = db.prepare(
    `INSERT INTO assessment_responses (assessment_id, item_key, value) VALUES (?, ?, ?)
     ON CONFLICT(assessment_id, item_key) DO UPDATE SET value = excluded.value`,
  );
  const run = db.transaction(() => {
    for (const [key, value] of Object.entries(responses)) stmt.run(assessmentId, key, value);
  });
  run();
}
