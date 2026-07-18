import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ADKAR_ELEMENTS, ADKAR_LABELS, PCT_ASPECT_KEYS, PCT_ASPECT_LABELS, type PctScores } from '@cmt/domain';
import { api } from '../../lib/api';
import type { Project } from '../../lib/types';
import { useProject } from '../../app/ProjectLayout';
import { BandChip, BarrierBadge, HeatCell, RiskBadge, impactCellColor } from '../../ui/scores';
import { TriangleChart } from '../../ui/TriangleChart';
import { QuadrantChart } from '../../ui/QuadrantChart';
import { MultiSelect } from '../../ui/MultiSelect';

export interface ProjectDashboardDto {
  project: Project;
  pct: { label: string | null; date: string | null; scores: PctScores } | null;
  risk: {
    label: string | null;
    date: string | null;
    subject: string;
    cc: number | null;
    oa: number | null;
    quadrant: string | null;
  } | null;
  groupRisks: Array<{ groupId: string; groupName: string; cc: number | null; oa: number | null; quadrant: string | null }>;
  aspectsImpactedHistogram: number[];
  degreeOfImpactHistogram: number[];
  barrierCounts: Record<string, number>;
  groups: Array<{
    id: string;
    name: string;
    numPeople: number | null;
    aspectsImpacted: number;
    degreeOfImpact: number | null;
    barrierPoint: string | null;
    riskQuadrant: string | null;
  }>;
  latestCmPerf: { id: string; name: string; date: string | null; worstStatus: string | null } | null;
}

function Histogram(props: { title: string; counts: number[]; startAt: number }) {
  const max = Math.max(1, ...props.counts);
  return (
    <div>
      <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{props.title}</h4>
      <div className="flex h-24 items-end gap-1">
        {props.counts.map((count, i) => (
          <div key={i} className="flex flex-1 flex-col items-center gap-0.5">
            <span className="text-[9px] text-slate-500">{count > 0 ? count : ''}</span>
            <div
              className={`w-full rounded-t ${count > 0 ? 'bg-indigo-500' : 'bg-slate-100'}`}
              style={{ height: `${(count / max) * 64 + (count > 0 ? 6 : 2)}px` }}
              title={`${props.startAt + i}: ${count} group(s)`}
            />
            <span className="text-[9px] text-slate-400">{props.startAt + i}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ProjectDashboardPage() {
  const { projectId } = useProject();
  const queryClient = useQueryClient();
  const { data: d } = useQuery({
    queryKey: ['project-dashboard', projectId],
    queryFn: () => api.get<ProjectDashboardDto>(`/api/projects/${projectId}/dashboard`),
    enabled: projectId !== '',
  });
  const saveWatchList = useMutation({
    mutationFn: (watchGroupIds: string[]) => api.patch<Project>(`/api/projects/${projectId}`, { watchGroupIds }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['project-dashboard', projectId] });
      void queryClient.invalidateQueries({ queryKey: ['project', projectId] });
    },
  });

  if (!d) return null;
  const watchIds = d.project.watchGroupIds.filter((id) => d.groups.some((g) => g.id === id));
  const watched = d.groups.filter((g) => watchIds.includes(g.id));

  return (
    <div className="max-w-5xl space-y-4">
      <div>
        <h2 className="text-xl font-bold">Project Dashboard</h2>
        <p className="text-sm text-slate-500">Health across assessments, impacted groups and CM performance.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="cmt-card">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="font-semibold">PCT Assessment</h3>
            <Link to={`/projects/${projectId}/assessments`} className="text-xs font-medium text-indigo-600 hover:underline">
              Go to assessments →
            </Link>
          </div>
          {d.pct ? (
            <div className="flex flex-col items-center gap-2">
              <TriangleChart scores={d.pct.scores} />
              <div className="flex flex-wrap justify-center gap-1.5">
                {PCT_ASPECT_KEYS.map((k) => (
                  <BandChip key={k} label={PCT_ASPECT_LABELS[k].split('/')[0]!} score={d.pct!.scores[k]} />
                ))}
              </div>
              <p className="text-xs text-slate-400">
                {d.pct.label ?? 'Latest run'}
                {d.pct.date ? ` · ${d.pct.date}` : ''}
              </p>
            </div>
          ) : (
            <p className="py-10 text-center text-sm text-slate-400">
              Assess project health across the four critical aspects at a point in time.
            </p>
          )}
        </div>

        <div className="cmt-card">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="font-semibold">Risk Assessment</h3>
            {d.risk && <RiskBadge quadrant={d.risk.quadrant} />}
          </div>
          {d.risk && d.risk.cc != null && d.risk.oa != null ? (
            <div className="flex flex-col items-center gap-1">
              <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-700">
                {d.risk.subject}
              </span>
              <QuadrantChart points={[{ cc: d.risk.cc, oa: d.risk.oa, current: true }]} />
              <p className="text-xs text-slate-400">
                CC: {d.risk.cc} · OA: {d.risk.oa}
                {d.risk.date ? ` · Completed: ${d.risk.date}` : ''}
              </p>
            </div>
          ) : (
            <p className="py-10 text-center text-sm text-slate-400">
              Complete all 28 factors to plot the risk quadrant.
            </p>
          )}
          {d.groupRisks.length > 0 && (
            <div className="mt-3 border-t border-slate-100 pt-2">
              <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Risk by group</h4>
              <ul className="space-y-1">
                {d.groupRisks.map((g) => (
                  <li key={g.groupId} className="flex items-center justify-between text-sm">
                    <Link to={`/projects/${projectId}/impact/${g.groupId}`} className="text-indigo-700 hover:underline">
                      {g.groupName}
                    </Link>
                    <span className="flex items-center gap-2 text-xs text-slate-500">
                      CC: {g.cc ?? 'NA'} · OA: {g.oa ?? 'NA'} <RiskBadge quadrant={g.quadrant} />
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="cmt-card">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="font-semibold">Assess Change Impact</h3>
            <Link to={`/projects/${projectId}/impact`} className="text-xs font-medium text-indigo-600 hover:underline">
              View impacted groups →
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Histogram title="Number of Aspects Impacted" counts={d.aspectsImpactedHistogram} startAt={1} />
            <Histogram title="Overall Degree of Impact" counts={d.degreeOfImpactHistogram} startAt={1} />
          </div>
        </div>

        <div className="cmt-card">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="font-semibold">ADKAR Barrier Points</h3>
            <Link to={`/projects/${projectId}/assessments`} className="text-xs font-medium text-indigo-600 hover:underline">
              ADKAR assessments →
            </Link>
          </div>
          <div className="flex items-end justify-between gap-2 px-2 pt-4">
            {ADKAR_ELEMENTS.map((el) => {
              const count = d.barrierCounts[ADKAR_LABELS[el]] ?? 0;
              return (
                <div key={el} className="flex flex-1 flex-col items-center gap-1">
                  <span
                    className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold ${
                      count > 0 ? 'bg-red-100 text-red-800' : 'bg-slate-100 text-slate-400'
                    }`}
                  >
                    {count}
                  </span>
                  <span className="text-[10px] font-medium text-slate-500">{ADKAR_LABELS[el]}</span>
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-center text-xs text-slate-400">
            Groups whose latest ADKAR assessment sits at each barrier point.
            {(d.barrierCounts['No barrier'] ?? 0) > 0 && ` ${d.barrierCounts['No barrier']} group(s) have no barrier.`}
          </p>
        </div>
      </div>

      <div className="cmt-card">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-semibold">Key Impacted Groups</h3>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">Watch list (max 5):</span>
            <div className="w-64">
              <MultiSelect
                options={d.groups.map((g) => ({ value: g.id, label: g.name }))}
                selected={watchIds}
                placeholder="Select impacted groups…"
                onChange={(ids) => {
                  if (ids.length <= 5) saveWatchList.mutate(ids);
                }}
              />
            </div>
          </div>
        </div>
        {watched.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-400">
            Create and track a watch list of up to 5 key impacted groups critical to change success.
          </p>
        ) : (
          <table className="w-full">
            <thead>
              <tr>
                <th className="cmt-th">Impacted Group</th>
                <th className="cmt-th w-32">Degree of Impact</th>
                <th className="cmt-th w-40">ADKAR Barrier Point</th>
                <th className="cmt-th w-40">Risk Assessment</th>
                <th className="cmt-th w-24"># of People</th>
              </tr>
            </thead>
            <tbody>
              {watched.map((g) => (
                <tr key={g.id}>
                  <td className="cmt-td">
                    <Link to={`/projects/${projectId}/impact/${g.id}`} className="font-medium text-indigo-700 hover:underline">
                      {g.name}
                    </Link>
                  </td>
                  <td className="cmt-td text-center">
                    <HeatCell value={g.degreeOfImpact} colorFor={impactCellColor} />
                  </td>
                  <td className="cmt-td">
                    <BarrierBadge barrier={g.barrierPoint} />
                  </td>
                  <td className="cmt-td">
                    <RiskBadge quadrant={g.riskQuadrant} />
                  </td>
                  <td className="cmt-td">{g.numPeople ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="cmt-card flex items-center justify-between">
        <div>
          <h3 className="font-semibold">CM Performance</h3>
          {d.latestCmPerf ? (
            <p className="text-sm text-slate-600">
              Latest report: <strong>{d.latestCmPerf.name}</strong>
              {d.latestCmPerf.date ? ` (${d.latestCmPerf.date})` : ''} — worst metric status:{' '}
              <strong>{d.latestCmPerf.worstStatus ?? 'not set'}</strong>
            </p>
          ) : (
            <p className="text-sm text-slate-400">No CM performance reports yet.</p>
          )}
        </div>
        <Link to={`/projects/${projectId}/cm-performance`} className="cmt-btn-secondary">
          CM Performance Reports →
        </Link>
      </div>
    </div>
  );
}
