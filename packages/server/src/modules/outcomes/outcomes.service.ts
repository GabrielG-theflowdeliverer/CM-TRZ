import {
  metricRealization,
  overallRealization,
  type Measurement,
  type Metric,
  type MetricRealization,
  type Objective,
} from '@cmt/domain';
import { newId, nowIso, type Db } from '../../infra/db.js';
import { HttpError, notFound } from '../../infra/http.js';
import * as repo from './outcomes.repo.js';
import { getProject } from '../projects/projects.service.js';
import { getGroupRow } from '../impact/impact.repo.js';

export type MetricWithData = Metric & { measurements: Measurement[]; computed: MetricRealization };
export type ObjectiveWithMetrics = Objective & { metrics: MetricWithData[]; realization: number | null };

export interface OutcomesPayload {
  objectives: ObjectiveWithMetrics[];
  /** Project-wide realization = mean of all metrics' computable percentages. */
  realization: number | null;
}

function enrichMetric(db: Db, metric: Metric): MetricWithData {
  const measurements = repo.listMeasurements(db, metric.id);
  return { ...metric, measurements, computed: metricRealization(metric, measurements) };
}

/** The whole outcomes tree for a project, with realization derived on read. */
export function getOutcomes(db: Db, projectId: string): OutcomesPayload {
  getProject(db, projectId); // 404 unknown project
  const metricsByObjective = new Map<string, MetricWithData[]>();
  const allPcts: Array<number | null> = [];
  for (const metric of repo.listMetricsForProject(db, projectId)) {
    const enriched = enrichMetric(db, metric);
    (metricsByObjective.get(metric.objectiveId) ?? metricsByObjective.set(metric.objectiveId, []).get(metric.objectiveId)!).push(enriched);
    allPcts.push(enriched.computed.pct);
  }
  const objectives = repo.listObjectives(db, projectId).map((o) => {
    const metrics = metricsByObjective.get(o.id) ?? [];
    return { ...o, metrics, realization: overallRealization(metrics.map((m) => m.computed.pct)) };
  });
  return { objectives, realization: overallRealization(allPcts) };
}

/** Each metric's kind + realization %, for the portfolio dashboard rollup. */
export function listMetricRealizations(db: Db, projectId: string): Array<{ kind: 'adoption' | 'benefit'; pct: number | null }> {
  return repo.listMetricsForProject(db, projectId).map((metric) => ({
    kind: metric.kind,
    pct: metricRealization(metric, repo.listMeasurements(db, metric.id)).pct,
  }));
}

// ---- Objectives
export function createObjective(db: Db, projectId: string, input: { level: string; statement: string; notes?: string | null }): Objective {
  getProject(db, projectId);
  const id = newId();
  repo.insertObjective(db, { id, projectId, level: input.level, statement: input.statement, notes: input.notes ?? null, createdAt: nowIso() });
  return repo.getObjective(db, id)!;
}
export function updateObjective(db: Db, id: string, fields: Parameters<typeof repo.updateObjective>[2]): Objective {
  if (!repo.updateObjective(db, id, fields)) notFound('Objective');
  return repo.getObjective(db, id)!;
}
export function deleteObjective(db: Db, id: string): void {
  if (!repo.deleteObjective(db, id)) notFound('Objective');
}

// ---- Metrics
export function createMetric(
  db: Db,
  objectiveId: string,
  input: { kind: 'adoption' | 'benefit'; name: string; unit?: string | null; baseline?: number | null; target?: number | null; direction: 'increase' | 'decrease'; adoptionMeasure?: string | null; groupId?: string | null },
): Metric {
  const objective = repo.getObjective(db, objectiveId) ?? notFound('Objective');
  if (input.groupId != null) {
    const group = getGroupRow(db, input.groupId);
    if (!group || group.project_id !== objective.projectId) throw new HttpError(400, 'groupId is not in this project');
  }
  const id = newId();
  repo.insertMetric(db, {
    id,
    projectId: objective.projectId,
    objectiveId,
    kind: input.kind,
    name: input.name,
    unit: input.unit ?? null,
    baseline: input.baseline ?? null,
    target: input.target ?? null,
    direction: input.direction,
    adoptionMeasure: (input.adoptionMeasure as Metric['adoptionMeasure']) ?? null,
    groupId: input.groupId ?? null,
    createdAt: nowIso(),
  });
  return repo.getMetric(db, id)!;
}
export function updateMetric(db: Db, id: string, fields: Parameters<typeof repo.updateMetric>[2]): Metric {
  const metric = repo.getMetric(db, id) ?? notFound('Metric');
  if (fields.groupId != null) {
    const group = getGroupRow(db, fields.groupId);
    if (!group || group.project_id !== metric.projectId) throw new HttpError(400, 'groupId is not in this project');
  }
  if (!repo.updateMetric(db, id, fields)) notFound('Metric');
  return repo.getMetric(db, id)!;
}
export function deleteMetric(db: Db, id: string): void {
  if (!repo.deleteMetric(db, id)) notFound('Metric');
}

// ---- Measurements
export function addMeasurement(db: Db, metricId: string, input: { date: string; value: number }): Measurement {
  if (!repo.getMetric(db, metricId)) notFound('Metric');
  const id = newId();
  repo.insertMeasurement(db, { id, metricId, date: input.date, value: input.value });
  return repo.getMeasurement(db, id)!;
}
export function deleteMeasurement(db: Db, id: string): void {
  if (!repo.deleteMeasurement(db, id)) notFound('Measurement');
}
