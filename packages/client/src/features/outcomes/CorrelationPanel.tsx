import type { GroupDto } from '../../lib/types';
import { CorrelationScatter, type CorrelationPoint } from './CorrelationScatter';
import { type ObjectiveDto } from './useOutcomes';

function mean(values: Array<number | null | undefined>): number | null {
  const nums = values.filter((v): v is number => typeof v === 'number');
  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null;
}

/** Per-group adoption realization (mean of that group's adoption-metric %s). */
function adoptionByGroup(objectives: ObjectiveDto[]): Map<string, number | null> {
  const buckets = new Map<string, Array<number | null>>();
  for (const o of objectives) {
    for (const metric of o.metrics) {
      if (metric.kind === 'adoption' && metric.groupId) {
        (buckets.get(metric.groupId) ?? buckets.set(metric.groupId, []).get(metric.groupId)!).push(metric.computed.pct);
      }
    }
  }
  return new Map([...buckets].map(([id, pcts]) => [id, mean(pcts)]));
}

/**
 * Leading→lagging on the Outcomes page: does ADKAR readiness track adoption?
 * One dot per impacted group. A directional signal for conversations, not proof
 * of cause.
 */
export function CorrelationPanel({ objectives, groups }: { objectives: ObjectiveDto[]; groups: GroupDto[] }) {
  const adoption = adoptionByGroup(objectives);
  const points: CorrelationPoint[] = groups
    .filter((g) => adoption.has(g.id))
    .map((g) => ({
      group: g.name,
      adkar: mean(Object.values(g.adkar)),
      adoption: adoption.get(g.id) ?? null,
      barrier: g.computed.barrierPoint,
    }));

  return (
    <section className="cmt-card space-y-3">
      <div>
        <h3 className="font-semibold">Readiness vs adoption</h3>
        <p className="text-xs text-slate-500">
          Each dot is an impacted group — ADKAR readiness (leading) against adoption realization (lagging).
          A directional signal for conversations, not proof of cause.
        </p>
      </div>
      {points.length === 0 ? (
        <p className="py-4 text-center text-sm text-slate-400">
          Add adoption metrics scoped to impacted groups (and run their ADKAR assessments) to see how readiness
          relates to adoption.
        </p>
      ) : (
        <CorrelationScatter points={points} />
      )}
    </section>
  );
}
