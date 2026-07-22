import type { Measurement, Metric } from '../entities/outcomes.js';

/**
 * Benefit / adoption realization: how far a metric has travelled from its
 * baseline toward its target, as a percentage. Direction-aware via the sign of
 * (target − baseline), so it works for "higher is better" (revenue) and "lower
 * is better" (cost, cycle time) alike. Clamped at 0 (moving the wrong way reads
 * 0, not negative); >100 is allowed and meaningful (overachieved the target).
 * Null when it can't be computed (missing baseline/target/current, or a
 * zero-width baseline→target range).
 */
export function realizationPct(
  baseline: number | null,
  target: number | null,
  current: number | null,
): number | null {
  if (baseline === null || target === null || current === null) return null;
  if (target === baseline) return null;
  const pct = ((current - baseline) / (target - baseline)) * 100;
  return Math.max(0, pct);
}

/** The most recent measurement by date (ties broken by input order — last wins). */
export function latestMeasurement(measurements: ReadonlyArray<Measurement>): Measurement | null {
  let latest: Measurement | null = null;
  for (const m of measurements) {
    if (latest === null || m.date >= latest.date) latest = m;
  }
  return latest;
}

export interface MetricRealization {
  current: number | null;
  pct: number | null;
}

/** A metric's current value (latest measurement) and its realization %. */
export function metricRealization(
  metric: Pick<Metric, 'baseline' | 'target'>,
  measurements: ReadonlyArray<Measurement>,
): MetricRealization {
  const current = latestMeasurement(measurements)?.value ?? null;
  return { current, pct: realizationPct(metric.baseline, metric.target, current) };
}

/**
 * Overall realization across metrics: the mean of the computable percentages.
 * Metrics with no computable % (no target/baseline/measurement yet) are
 * excluded rather than counted as zero — an unmeasured metric isn't a failure.
 * Null when nothing is computable.
 */
export function overallRealization(pcts: ReadonlyArray<number | null>): number | null {
  const computable = pcts.filter((p): p is number => p !== null);
  if (computable.length === 0) return null;
  return computable.reduce((sum, p) => sum + p, 0) / computable.length;
}
