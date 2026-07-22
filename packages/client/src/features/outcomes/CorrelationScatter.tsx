import { CartesianGrid, Legend, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis } from 'recharts';
import { BarrierBadge } from '../../ui/scores';

export interface CorrelationPoint {
  group: string;
  adkar: number | null; // mean ADKAR score, 1..5
  adoption: number | null; // adoption realization %, 0..100+
  barrier: string | null;
  project?: string; // set on the portfolio (pooled) view
}

/** Static hex (not interpolated) so dots + legend + table swatches stay consistent per project. */
const PROJECT_COLORS = ['#4f46e5', '#059669', '#d97706', '#e11d48', '#0284c7', '#7c3aed', '#0891b2', '#ca8a04'];

/**
 * Shared leading→lagging scatter: ADKAR readiness (x) against adoption
 * realization (y), one dot per group. A directional signal, not proof of cause.
 * Used by the per-project Outcomes panel and the portfolio dashboard (pooled).
 */
export function CorrelationScatter({ points, showProject = false }: { points: CorrelationPoint[]; showProject?: boolean }) {
  const plottable = points.filter(
    (p): p is CorrelationPoint & { adkar: number; adoption: number } => p.adkar !== null && p.adoption !== null,
  );
  // On the pooled portfolio view, colour dots by project (with a legend + table swatches).
  const projects = showProject ? [...new Set(points.map((p) => p.project ?? ''))] : [];
  const colorFor = (project?: string) => PROJECT_COLORS[Math.max(0, projects.indexOf(project ?? '')) % PROJECT_COLORS.length]!;

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
              {showProject && <Legend wrapperStyle={{ fontSize: 11 }} />}
              {showProject ? (
                projects.map((proj) => (
                  <Scatter
                    key={proj}
                    name={proj || '(project)'}
                    data={plottable.filter((p) => (p.project ?? '') === proj)}
                    fill={colorFor(proj)}
                  />
                ))
              ) : (
                <Scatter data={plottable} fill="#4f46e5" />
              )}
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
              {showProject && (
                <td className="cmt-td text-slate-500">
                  <span className="inline-flex items-center gap-1.5">
                    <span
                      className="inline-block h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: colorFor(p.project) }}
                    />
                    {p.project}
                  </span>
                </td>
              )}
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
