import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import {
  ADKAR_ASSESSMENT_INTRO,
  ASSESSMENT_TYPE_LABELS,
  PCT_ASPECT_KEYS,
  PCT_ASPECT_LABELS,
  type AssessmentType,
} from '@cmt/domain';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { api } from '../../lib/api';
import type { AssessmentDto, GroupDto } from '../../lib/types';
import { useProject } from '../../app/ProjectLayout';
import { useGroups } from '../impact/useGroups';
import { useAssessments, useInvalidateAssessments } from './useAssessments';
import { BandChip, BarrierBadge, RiskBadge } from '../../ui/scores';

// ADKAR sits directly below PCT; competency assessments follow the risk block.
const HUB_TYPES: AssessmentType[] = ['pct', 'adkar', 'risk', 'sponsor_competency', 'manager_competency'];

const TYPE_HINTS: Record<string, string> = {
  pct: 'Prosci Change Triangle — project health across Success, Leadership/Sponsorship, Project Management and Change Management. Repeat over time to track Organizational Performance.',
  adkar: ADKAR_ASSESSMENT_INTRO,
  risk: 'Change Characteristics vs Organizational Attributes — determines the risk quadrant used to scale your approach.',
  sponsor_competency: 'How effectively the primary sponsor fulfilled their role (out of 100).',
  manager_competency: 'How effectively a people manager led their team through the change (out of 100).',
};

const OVERALL = '__overall__';

/** ADKAR section inside the Assessments hub — targets the overall change or a group. */
function AdkarSection({ projectId, runs, groups }: { projectId: string; runs: AssessmentDto[]; groups: GroupDto[] }) {
  const invalidate = useInvalidateAssessments(projectId);
  const [target, setTarget] = useState(OVERALL);
  const create = useMutation({
    mutationFn: (input: { copyFromLatest?: boolean }) =>
      api.post<AssessmentDto>(`/api/projects/${projectId}/assessments`, {
        type: 'adkar',
        subjectKind: target === OVERALL ? 'project' : 'group',
        subjectId: target === OVERALL ? null : target,
        copyFromLatest: input.copyFromLatest,
      }),
    onSuccess: () => invalidate(),
  });
  const deleteRun = useMutation({
    mutationFn: (id: string) => api.del(`/api/assessments/${id}`),
    onSuccess: () => invalidate(),
  });
  const groupName = (run: AssessmentDto) =>
    run.subjectKind === 'project' ? 'Overall Change' : (groups.find((g) => g.id === run.subjectId)?.name ?? '(group)');
  const visible = runs.filter((r) => r.subjectKind !== 'role');

  return (
    <section className="cmt-card">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold">{ASSESSMENT_TYPE_LABELS.adkar}</h3>
        <div className="flex items-center gap-1.5">
          <select className="cmt-input w-44" value={target} onChange={(e) => setTarget(e.target.value)}>
            <option value={OVERALL}>Overall Change</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
          {visible.length > 0 && (
            <button className="cmt-btn-secondary" onClick={() => create.mutate({ copyFromLatest: true })}>
              New run (copy latest)
            </button>
          )}
          <button className="cmt-btn" onClick={() => create.mutate({})}>
            New run
          </button>
        </div>
      </div>
      <p className="mb-3 text-xs text-slate-500">{TYPE_HINTS.adkar}</p>
      {visible.length === 0 ? (
        <p className="text-sm text-slate-400">No runs yet.</p>
      ) : (
        <table className="w-full">
          <thead>
            <tr>
              <th className="cmt-th">Run</th>
              <th className="cmt-th w-44">Impacted Group(s)</th>
              <th className="cmt-th">Scheduled</th>
              <th className="cmt-th">Completed</th>
              <th className="cmt-th">Barrier Point</th>
              <th className="cmt-th w-16"></th>
            </tr>
          </thead>
          <tbody>
            {visible.map((run, i) => (
              <tr key={run.id}>
                <td className="cmt-td">
                  <Link className="font-medium text-indigo-700 hover:underline" to={`/projects/${projectId}/assessments/${run.id}`}>
                    {run.label ?? `Run ${i + 1}`}
                  </Link>
                  {run.status && <span className="ml-2 text-xs text-slate-400">{run.status}</span>}
                </td>
                <td className="cmt-td text-xs">{groupName(run)}</td>
                <td className="cmt-td text-xs text-slate-500">{run.scheduledDate ?? '—'}</td>
                <td className="cmt-td text-xs text-slate-500">{run.completedDate ?? '—'}</td>
                <td className="cmt-td">
                  <BarrierBadge barrier={run.computed.adkar?.barrierPoint} />
                </td>
                <td className="cmt-td text-right">
                  <button
                    className="cmt-btn-danger"
                    onClick={() => {
                      if (confirm('Delete this assessment run?')) deleteRun.mutate(run.id);
                    }}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

const ASPECT_COLORS: Record<string, string> = {
  success: '#4f46e5',
  leadership: '#0891b2',
  project_management: '#d97706',
  change_management: '#16a34a',
};

function RunSummary({ run }: { run: AssessmentDto }) {
  if (run.computed.pct) {
    return (
      <span className="flex flex-wrap gap-1">
        {PCT_ASPECT_KEYS.map((k) => (
          <BandChip key={k} label={PCT_ASPECT_LABELS[k].split('/')[0]!.slice(0, 4)} score={run.computed.pct?.[k]} />
        ))}
      </span>
    );
  }
  if (run.computed.risk) {
    const { cc, oa } = run.computed.risk;
    return (
      <span className="flex items-center gap-2 text-xs text-slate-600">
        CC: {cc ?? 'NA'} · OA: {oa ?? 'NA'} <RiskBadge quadrant={run.computed.risk.quadrant} />
      </span>
    );
  }
  if (run.computed.competency) {
    return (
      <span className="text-xs text-slate-600">
        Total: <strong>{run.computed.competency.total}</strong>/100
        {run.computed.competency.interpretation ? ` — ${run.computed.competency.interpretation}` : ''}
      </span>
    );
  }
  return null;
}

export function AssessmentsHubPage() {
  const { projectId } = useProject();
  const { data: runs } = useAssessments(projectId);
  const { data: groups } = useGroups(projectId);
  const invalidate = useInvalidateAssessments(projectId);

  const createRun = useMutation({
    mutationFn: (input: { type: AssessmentType; copyFromLatest?: boolean }) =>
      api.post<AssessmentDto>(`/api/projects/${projectId}/assessments`, {
        type: input.type,
        subjectKind: input.type.endsWith('competency') ? 'person' : 'project',
        copyFromLatest: input.copyFromLatest,
      }),
    onSuccess: () => invalidate(),
  });
  const deleteRun = useMutation({
    mutationFn: (id: string) => api.del(`/api/assessments/${id}`),
    onSuccess: () => invalidate(),
  });

  const byType = (type: AssessmentType) => (runs ?? []).filter((r) => r.type === type);

  // PCT trend = the Excel Org-Perf view: aspect scores across runs over time.
  const pctRuns = byType('pct');
  const trendData = pctRuns
    .filter((r) => r.computed.pct && Object.values(r.computed.pct).some((v) => v != null))
    .map((r, i) => ({
      name: r.label ?? r.completedDate ?? r.scheduledDate ?? `Run ${i + 1}`,
      ...r.computed.pct,
    }));

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h2 className="text-xl font-bold">Assessments</h2>
        <p className="text-sm text-slate-500">
          Run each assessment as many times as you need — results build the performance trends below.
        </p>
      </div>

      {trendData.length >= 2 && (
        <div className="cmt-card">
          <h3 className="mb-2 font-semibold">Organizational Performance — PCT over time</h3>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={trendData} margin={{ top: 8, right: 16, bottom: 0, left: -16 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis domain={[10, 30]} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              {PCT_ASPECT_KEYS.map((k) => (
                <Line
                  key={k}
                  type="monotone"
                  dataKey={k}
                  name={PCT_ASPECT_LABELS[k]}
                  stroke={ASPECT_COLORS[k]}
                  strokeWidth={2}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {HUB_TYPES.map((type) => {
        if (type === 'adkar') {
          return <AdkarSection key="adkar" projectId={projectId} runs={byType('adkar')} groups={groups ?? []} />;
        }
        const typeRuns = byType(type);
        return (
          <section key={type} className="cmt-card">
            <div className="mb-1 flex items-center justify-between">
              <h3 className="font-semibold">{ASSESSMENT_TYPE_LABELS[type]}</h3>
              <div className="flex gap-1.5">
                {typeRuns.length > 0 && (
                  <button
                    className="cmt-btn-secondary"
                    onClick={() => createRun.mutate({ type, copyFromLatest: true })}
                  >
                    New run (copy latest)
                  </button>
                )}
                <button className="cmt-btn" onClick={() => createRun.mutate({ type })}>
                  New run
                </button>
              </div>
            </div>
            <p className="mb-3 text-xs text-slate-500">{TYPE_HINTS[type]}</p>
            {typeRuns.length === 0 ? (
              <p className="text-sm text-slate-400">No runs yet.</p>
            ) : (
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="cmt-th">Run</th>
                    <th className="cmt-th">Scheduled</th>
                    <th className="cmt-th">Completed</th>
                    <th className="cmt-th">Results</th>
                    <th className="cmt-th w-16"></th>
                  </tr>
                </thead>
                <tbody>
                  {typeRuns.map((run, i) => (
                    <tr key={run.id}>
                      <td className="cmt-td">
                        <Link
                          className="font-medium text-indigo-700 hover:underline"
                          to={`/projects/${projectId}/assessments/${run.id}`}
                        >
                          {run.label ?? `Run ${i + 1}`}
                        </Link>
                        {run.status && <span className="ml-2 text-xs text-slate-400">{run.status}</span>}
                      </td>
                      <td className="cmt-td text-xs text-slate-500">{run.scheduledDate ?? '—'}</td>
                      <td className="cmt-td text-xs text-slate-500">{run.completedDate ?? '—'}</td>
                      <td className="cmt-td">
                        <RunSummary run={run} />
                      </td>
                      <td className="cmt-td text-right">
                        <button
                          className="cmt-btn-danger"
                          onClick={() => {
                            if (confirm('Delete this assessment run?')) deleteRun.mutate(run.id);
                          }}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        );
      })}
    </div>
  );
}
