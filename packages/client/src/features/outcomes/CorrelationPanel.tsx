import { CartesianGrid, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ResponsiveContainer } from 'recharts';
import type { GroupDto } from '../../lib/types';
import { BarrierBadge } from '../../ui/scores';
import { type ObjectiveDto } from './useOutcomes';

interface Point {
  group: string;
  adkar: number | null; // mean of scored ADKAR elements, 1..5
  adoption: number | null; // mean adoption-metric realization %, 0..100+
  barrier: string | null;
}

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
 * Leading→lagging: does ADKAR readiness track adoption? Each dot is an impacted
 * group — its mean ADKAR score (leading) against its adoption realization
 * (lagging). A directional signal to start conversations, NOT proof of cause.
 */
export function CorrelationPanel({ objectives, groups }: { objectives: ObjectiveDto[]; groups: GroupDto[] }) {
  const adoption = adoptionByGroup(objectives);
  const points: Point[] = groups
    .filter((g) => adoption.has(g.id))
    .map((g) => ({
      group: g.name,
      adkar: mean(Object.values(g.adkar)),
      adoption: adoption.get(g.id) ?? null,
      barrier: g.computed.barrierPoint,
    }));

  if (points.length === 0) {
    return (
      <section className="cmt-card">
        <h3 className="font-semibold">Readiness vs adoption</h3>
        <p className="py-4 text-center text-sm text-slate-400">
          Add adoption metrics scoped to impacted groups (and run their ADKAR assessments) to see how readiness
          relates to adoption.
        </p>
      </section>
    );
  }

  const plottable = points.filter((p) => p.adkar !== null && p.adoption !== null) as Array<Point & { adkar: number; adoption: number }>;

  return (
    <section className="cmt-card space-y-3">
      <div>
        <h3 className="font-semibold">Readiness vs adoption</h3>
        <p className="text-xs text-slate-500">
          Each dot is an impacted group — ADKAR readiness (leading) against adoption realization (lagging).
          A directional signal for conversations, not proof of cause.
        </p>
      </div>

      {plottable.length > 0 && (
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 10, right: 20, bottom: 24, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                type="number"
                dataKey="adkar"
                name="ADKAR readiness"
                domain={[1, 5]}
                tickCount={5}
                label={{ value: 'ADKAR readiness (avg 1–5)', position: 'insideBottom', offset: -12, fontSize: 11 }}
              />
              <YAxis
                type="number"
                dataKey="adoption"
                name="Adoption"
                domain={[0, 100]}
                unit="%"
                width={44}
                label={{ value: 'Adoption %', angle: -90, position: 'insideLeft', fontSize: 11 }}
              />
              <Tooltip
                cursor={{ strokeDasharray: '3 3' }}
                content={({ payload }) => {
                  const p = payload?.[0]?.payload as Point | undefined;
                  if (!p) return null;
                  return (
                    <div className="rounded border border-slate-200 bg-white px-2 py-1 text-xs shadow">
                      <div className="font-semibold">{p.group}</div>
                      <div>ADKAR {p.adkar?.toFixed(1)} · adoption {Math.round(p.adoption ?? 0)}%</div>
                    </div>
                  );
                }}
              />
              <Scatter data={plottable} fill="#4f46e5" />
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      )}

      <table className="w-full text-sm">
        <thead>
          <tr>
            <th className="cmt-th text-left">Group</th>
            <th className="cmt-th w-28">ADKAR (avg)</th>
            <th className="cmt-th w-40">Barrier</th>
            <th className="cmt-th w-28">Adoption</th>
          </tr>
        </thead>
        <tbody>
          {points.map((p) => (
            <tr key={p.group}>
              <td className="cmt-td font-medium">{p.group}</td>
              <td className="cmt-td tabular-nums">{p.adkar === null ? '—' : p.adkar.toFixed(1)}</td>
              <td className="cmt-td">
                <BarrierBadge barrier={p.barrier} />
              </td>
              <td className="cmt-td tabular-nums">{p.adoption === null ? '—' : `${Math.round(p.adoption)}%`}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
