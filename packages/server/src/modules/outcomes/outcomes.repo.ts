import type {
  AdoptionMeasure,
  Measurement,
  Metric,
  MetricDirection,
  MetricKind,
  Objective,
  ObjectiveLevel,
} from '@cmt/domain';
import type { Db } from '../../infra/db.js';
import { updateById } from '../../infra/sql.js';

interface ObjectiveRow {
  id: string;
  project_id: string;
  level: string;
  statement: string;
  notes: string | null;
  created_at: string;
}
interface MetricRow {
  id: string;
  project_id: string;
  objective_id: string;
  kind: string;
  name: string;
  unit: string | null;
  baseline: number | null;
  target: number | null;
  direction: string;
  adoption_measure: string | null;
  group_id: string | null;
  created_at: string;
}
interface MeasurementRow {
  id: string;
  metric_id: string;
  date: string;
  value: number;
}

const toObjective = (r: ObjectiveRow): Objective => ({
  id: r.id,
  projectId: r.project_id,
  level: r.level as ObjectiveLevel,
  statement: r.statement,
  notes: r.notes,
  createdAt: r.created_at,
});

const toMetric = (r: MetricRow): Metric => ({
  id: r.id,
  projectId: r.project_id,
  objectiveId: r.objective_id,
  kind: r.kind as MetricKind,
  name: r.name,
  unit: r.unit,
  baseline: r.baseline,
  target: r.target,
  direction: r.direction as MetricDirection,
  adoptionMeasure: r.adoption_measure as AdoptionMeasure | null,
  groupId: r.group_id,
  createdAt: r.created_at,
});

const toMeasurement = (r: MeasurementRow): Measurement => ({ id: r.id, metricId: r.metric_id, date: r.date, value: r.value });

// ---- Objectives
export function listObjectives(db: Db, projectId: string): Objective[] {
  return (db.prepare('SELECT * FROM objectives WHERE project_id = ? ORDER BY created_at, rowid').all(projectId) as ObjectiveRow[]).map(toObjective);
}
export function getObjective(db: Db, id: string): Objective | null {
  const r = db.prepare('SELECT * FROM objectives WHERE id = ?').get(id) as ObjectiveRow | undefined;
  return r ? toObjective(r) : null;
}
export function insertObjective(db: Db, o: { id: string; projectId: string; level: string; statement: string; notes: string | null; createdAt: string }): void {
  db.prepare('INSERT INTO objectives (id, project_id, level, statement, notes, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(
    o.id, o.projectId, o.level, o.statement, o.notes, o.createdAt,
  );
}
const OBJECTIVE_COLUMNS = { level: 'level', statement: 'statement', notes: 'notes' } as const;
export function updateObjective(db: Db, id: string, fields: { level?: string; statement?: string; notes?: string | null }): boolean {
  return updateById(db, 'objectives', id, OBJECTIVE_COLUMNS, fields);
}
export function deleteObjective(db: Db, id: string): boolean {
  return db.prepare('DELETE FROM objectives WHERE id = ?').run(id).changes > 0;
}

// ---- Metrics
export function getMetric(db: Db, id: string): Metric | null {
  const r = db.prepare('SELECT * FROM metrics WHERE id = ?').get(id) as MetricRow | undefined;
  return r ? toMetric(r) : null;
}
export function listMetricsForProject(db: Db, projectId: string): Metric[] {
  return (db.prepare('SELECT * FROM metrics WHERE project_id = ? ORDER BY created_at, rowid').all(projectId) as MetricRow[]).map(toMetric);
}
export function insertMetric(db: Db, m: Omit<Metric, never>): void {
  db.prepare(
    `INSERT INTO metrics (id, project_id, objective_id, kind, name, unit, baseline, target, direction, adoption_measure, group_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    m.id, m.projectId, m.objectiveId, m.kind, m.name, m.unit, m.baseline, m.target, m.direction, m.adoptionMeasure, m.groupId, m.createdAt,
  );
}
const METRIC_COLUMNS = { name: 'name', unit: 'unit', baseline: 'baseline', target: 'target', direction: 'direction', groupId: 'group_id' } as const;
export function updateMetric(db: Db, id: string, fields: { name?: string; unit?: string | null; baseline?: number | null; target?: number | null; direction?: string; groupId?: string | null }): boolean {
  return updateById(db, 'metrics', id, METRIC_COLUMNS, fields);
}
export function deleteMetric(db: Db, id: string): boolean {
  return db.prepare('DELETE FROM metrics WHERE id = ?').run(id).changes > 0;
}

// ---- Measurements
export function listMeasurements(db: Db, metricId: string): Measurement[] {
  return (db.prepare('SELECT * FROM measurements WHERE metric_id = ? ORDER BY date, rowid').all(metricId) as MeasurementRow[]).map(toMeasurement);
}
export function insertMeasurement(db: Db, m: { id: string; metricId: string; date: string; value: number }): void {
  db.prepare('INSERT INTO measurements (id, metric_id, date, value) VALUES (?, ?, ?, ?)').run(m.id, m.metricId, m.date, m.value);
}
export function getMeasurement(db: Db, id: string): Measurement | null {
  const r = db.prepare('SELECT * FROM measurements WHERE id = ?').get(id) as MeasurementRow | undefined;
  return r ? toMeasurement(r) : null;
}
export function deleteMeasurement(db: Db, id: string): boolean {
  return db.prepare('DELETE FROM measurements WHERE id = ?').run(id).changes > 0;
}
