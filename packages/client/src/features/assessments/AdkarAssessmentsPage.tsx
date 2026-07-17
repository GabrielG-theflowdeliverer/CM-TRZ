import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { ADKAR_ASSESSMENT_INTRO } from '@cmt/domain';
import { api } from '../../lib/api';
import type { AssessmentDto } from '../../lib/types';
import { useProject } from '../../app/ProjectLayout';
import { useGroups } from '../impact/useGroups';
import { useAssessments, useInvalidateAssessments } from './useAssessments';
import { BarrierBadge } from '../../ui/scores';

const OVERALL = '__overall__';

export function AdkarAssessmentsPage() {
  const { projectId } = useProject();
  const { data: runs } = useAssessments(projectId, 'adkar');
  const { data: groups } = useGroups(projectId);
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

  const groupName = (run: AssessmentDto) => {
    if (run.subjectKind === 'project') return 'Overall Change';
    if (run.subjectKind === 'role') return 'Role';
    return (groups ?? []).find((g) => g.id === run.subjectId)?.name ?? '(deleted group)';
  };

  return (
    <div className="max-w-4xl space-y-4">
      <div>
        <h2 className="text-xl font-bold">ADKAR Assessments</h2>
        <p className="text-sm text-slate-500">{ADKAR_ASSESSMENT_INTRO}</p>
      </div>

      <div className="cmt-card flex flex-wrap items-center gap-2">
        <label className="text-xs font-semibold uppercase text-slate-500">Target</label>
        <select className="cmt-input w-56" value={target} onChange={(e) => setTarget(e.target.value)}>
          <option value={OVERALL}>Overall Change</option>
          {(groups ?? []).map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
        <button className="cmt-btn" onClick={() => create.mutate({})}>
          Add assessment
        </button>
        <button className="cmt-btn-secondary" onClick={() => create.mutate({ copyFromLatest: true })}>
          Add (copy latest)
        </button>
      </div>

      <div className="cmt-card">
        <table className="w-full">
          <thead>
            <tr>
              <th className="cmt-th">ADKAR Assessment Name</th>
              <th className="cmt-th w-44">Impacted Group(s)</th>
              <th className="cmt-th w-32">Scheduled</th>
              <th className="cmt-th w-32">Completed</th>
              <th className="cmt-th w-28">Status</th>
              <th className="cmt-th w-36">Barrier Point</th>
              <th className="cmt-th w-14"></th>
            </tr>
          </thead>
          <tbody>
            {(runs ?? [])
              .filter((r) => r.subjectKind !== 'role')
              .map((run, i) => (
                <tr key={run.id}>
                  <td className="cmt-td">
                    <Link
                      to={`/projects/${projectId}/assessments/${run.id}`}
                      className="font-medium text-indigo-700 hover:underline"
                    >
                      {run.label ?? `ADKAR run ${i + 1}`}
                    </Link>
                  </td>
                  <td className="cmt-td text-xs">{groupName(run)}</td>
                  <td className="cmt-td text-xs text-slate-500">{run.scheduledDate ?? '—'}</td>
                  <td className="cmt-td text-xs text-slate-500">{run.completedDate ?? '—'}</td>
                  <td className="cmt-td text-xs text-slate-500">{run.status ?? '—'}</td>
                  <td className="cmt-td">
                    <BarrierBadge barrier={run.computed.adkar?.barrierPoint} />
                  </td>
                  <td className="cmt-td text-right">
                    <button
                      className="cmt-btn-danger"
                      onClick={() => {
                        if (confirm('Delete this ADKAR assessment?')) deleteRun.mutate(run.id);
                      }}
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            {(runs ?? []).filter((r) => r.subjectKind !== 'role').length === 0 && (
              <tr>
                <td colSpan={7} className="cmt-td py-8 text-center text-slate-400">
                  No ADKAR assessments yet — add one for the overall change or a specific group.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
