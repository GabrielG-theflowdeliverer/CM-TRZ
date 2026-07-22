import { CartesianGrid, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis } from 'recharts';
import { BarrierBadge } from '../../ui/scores';

export interface CorrelationPoint {
  group: string;
  adkar: number | null; // mean ADKAR score, 1..5
  adoption: number | null; // adoption realization %, 0..100+
  barrier: string | null;
  project?: string; // set on the portfolio (pooled) view
}

/**
 * Shared leading→lagging scatter: ADKAR readiness (x) against adoption
 * realization (y), one dot per group. A directional signal, not proof of cause.
 * Used by the per-project Outcomes panel and the portfolio dashboard (pooled).
 */
export function CorrelationScatter({ points, showProject = false }: { points: CorrelationPoint[]; showProject?: boolean }) {
  const plottable = points.filter(
    (p): p is CorrelationPoint & { adkar: number; adoption: number } => p.adkar !== null && p.adoption !== null,
  );

  return (
    <div className="space-y-3">
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
                  const p = payload?.[0]?.payload as CorrelationPoint | undefined;
                  if (!p) return null;
                  return (
                    <div className="rounded border border-slate-200 bg-white px-2 py-1 text-xs shadow">
                      <div className="font-semibold">
                        {p.group}
                        {p.project ? ` · ${p.project}` : ''}
                      </div>
                      <div>
                        ADKAR {p.adkar?.toFixed(1)} · adoption {Math.round(p.adoption ?? 0)}%
                      </div>
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
            {showProject && <th className="cmt-th text-left">Project</th>}
            <th className="cmt-th w-28">ADKAR (avg)</th>
            <th className="cmt-th w-40">Barrier</th>
            <th className="cmt-th w-28">Adoption</th>
          </tr>
        </thead>
        <tbody>
          {points.map((p, i) => (
            <tr key={`${p.group}-${p.project ?? ''}-${i}`}>
              <td className="cmt-td font-medium">{p.group}</td>
              {showProject && <td className="cmt-td text-slate-500">{p.project}</td>}
              <td className="cmt-td tabular-nums">{p.adkar === null ? '—' : p.adkar.toFixed(1)}</td>
              <td className="cmt-td">
                <BarrierBadge barrier={p.barrier} />
              </td>
              <td className="cmt-td tabular-nums">{p.adoption === null ? '—' : `${Math.round(p.adoption)}%`}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
