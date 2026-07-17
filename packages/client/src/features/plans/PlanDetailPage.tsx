import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ACTIVITY_STATUSES,
  ADKAR_ELEMENTS,
  ADKAR_LABELS,
  PLAN_COLUMN_HEADERS,
  PLAN_COLUMN_HELP,
  PLAN_TYPES,
} from '@cmt/domain';
import { api } from '../../lib/api';
import type { PlanDto } from '../../lib/types';
import { useProject } from '../../app/ProjectLayout';
import { useGroups } from '../impact/useGroups';
import { DateInput, Select, TextArea, TextField } from '../../ui/controls';

export function PlanDetailPage() {
  const { projectId, project } = useProject();
  const { planId = '' } = useParams();
  const queryClient = useQueryClient();
  const { data: plan } = useQuery({
    queryKey: ['plans', projectId, planId],
    queryFn: () => api.get<PlanDto>(`/api/plans/${planId}`),
    enabled: planId !== '',
  });
  const { data: groups } = useGroups(projectId);

  const refresh = (data?: PlanDto) => {
    if (data) queryClient.setQueryData(['plans', projectId, planId], data);
    void queryClient.invalidateQueries({ queryKey: ['plans', projectId] });
    void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  };
  const update = useMutation({
    mutationFn: (fields: Record<string, unknown>) => api.patch<PlanDto>(`/api/plans/${planId}`, fields),
    onSuccess: refresh,
  });
  const addActivity = useMutation({
    mutationFn: () => api.post<PlanDto>(`/api/plans/${planId}/activities`, {}),
    onSuccess: refresh,
  });
  const updateActivity = useMutation({
    mutationFn: (input: { activityId: string; fields: Record<string, unknown> }) =>
      api.patch<PlanDto>(`/api/plan-activities/${input.activityId}`, input.fields),
    onSuccess: refresh,
  });
  const removeActivity = useMutation({
    mutationFn: (activityId: string) => api.del<PlanDto>(`/api/plan-activities/${activityId}`),
    onSuccess: (data) => refresh(data as PlanDto),
  });

  if (!plan) return null;
  const progress = plan.computed.progress;

  return (
    <div className="max-w-full space-y-4">
      <div className="flex items-end justify-between">
        <div>
          <Link to={`/projects/${projectId}/plans`} className="text-xs font-semibold text-indigo-600 hover:underline">
            ← All plans
          </Link>
          <h2 className="text-xl font-bold">{plan.name}</h2>
          <p className="text-xs text-slate-500">
            Project: {project?.name} · {progress.completed}/{progress.total} activities completed
            {progress.percentComplete != null ? ` (${progress.percentComplete}%)` : ''}
          </p>
        </div>
        <button className="cmt-btn" onClick={() => addActivity.mutate()}>
          Add activity
        </button>
      </div>

      <div className="cmt-card grid grid-cols-2 gap-3 md:grid-cols-4">
        <div>
          <label className="cmt-label">Plan Type</label>
          <Select value={plan.planType} options={PLAN_TYPES} onSave={(v) => update.mutate({ planType: v })} />
        </div>
        <div>
          <label className="cmt-label">Sponsor</label>
          <TextField value={plan.sponsor} onSave={(v) => update.mutate({ sponsor: v })} />
        </div>
        <div>
          <label className="cmt-label">Change Practitioner</label>
          <TextField value={plan.practitioner} onSave={(v) => update.mutate({ practitioner: v })} />
        </div>
        <div>
          <label className="cmt-label">Last updated</label>
          <DateInput value={plan.lastUpdated} onSave={(v) => update.mutate({ lastUpdated: v })} />
        </div>
      </div>

      <div className="cmt-card overflow-x-auto">
        <table className="w-full min-w-[1250px]">
          <thead>
            <tr>
              <th className="cmt-th w-8">#</th>
              <th className="cmt-th w-48" title={PLAN_COLUMN_HELP.activityName}>
                {PLAN_COLUMN_HEADERS.activityName}
              </th>
              <th className="cmt-th w-36" title={PLAN_COLUMN_HELP.adkarOutcome}>
                {PLAN_COLUMN_HEADERS.adkarOutcome}
              </th>
              <th className="cmt-th w-36" title={PLAN_COLUMN_HELP.group}>
                {PLAN_COLUMN_HEADERS.group}
              </th>
              <th className="cmt-th w-44" title={PLAN_COLUMN_HELP.methodMechanism}>
                {PLAN_COLUMN_HEADERS.methodMechanism}
              </th>
              <th className="cmt-th w-36" title={PLAN_COLUMN_HELP.rolesRequired}>
                {PLAN_COLUMN_HEADERS.rolesRequired}
              </th>
              <th className="cmt-th w-36" title={PLAN_COLUMN_HELP.responsible}>
                {PLAN_COLUMN_HEADERS.responsible}
              </th>
              <th className="cmt-th w-36" title={PLAN_COLUMN_HELP.startDate}>
                {PLAN_COLUMN_HEADERS.startDate}
              </th>
              <th className="cmt-th w-36" title={PLAN_COLUMN_HELP.finishDate}>
                {PLAN_COLUMN_HEADERS.finishDate}
              </th>
              <th className="cmt-th w-32" title={PLAN_COLUMN_HELP.status}>
                {PLAN_COLUMN_HEADERS.status}
              </th>
              <th className="cmt-th w-44" title={PLAN_COLUMN_HELP.resultFeedback}>
                {PLAN_COLUMN_HEADERS.resultFeedback}
              </th>
              <th className="cmt-th w-10"></th>
            </tr>
          </thead>
          <tbody>
            {plan.activities.map((a, i) => (
              <tr key={a.id}>
                <td className="cmt-td text-slate-400">{i + 1}</td>
                <td className="cmt-td">
                  <TextArea
                    rows={1}
                    value={a.name}
                    onSave={(v) => updateActivity.mutate({ activityId: a.id, fields: { name: v } })}
                  />
                </td>
                <td className="cmt-td">
                  <select
                    className="cmt-input"
                    value={a.adkarOutcome ?? ''}
                    onChange={(e) =>
                      updateActivity.mutate({
                        activityId: a.id,
                        fields: { adkarOutcome: e.target.value === '' ? null : e.target.value },
                      })
                    }
                  >
                    <option value="">—</option>
                    {ADKAR_ELEMENTS.map((el) => (
                      <option key={el} value={el}>
                        {ADKAR_LABELS[el]}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="cmt-td">
                  <select
                    className="cmt-input"
                    value={a.groupId ?? ''}
                    onChange={(e) =>
                      updateActivity.mutate({
                        activityId: a.id,
                        fields: { groupId: e.target.value === '' ? null : e.target.value },
                      })
                    }
                  >
                    <option value="">—</option>
                    {(groups ?? []).map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="cmt-td">
                  <TextArea
                    rows={1}
                    value={a.methodMechanism}
                    onSave={(v) => updateActivity.mutate({ activityId: a.id, fields: { methodMechanism: v } })}
                  />
                </td>
                <td className="cmt-td">
                  <TextField
                    value={a.rolesRequired}
                    onSave={(v) => updateActivity.mutate({ activityId: a.id, fields: { rolesRequired: v } })}
                  />
                </td>
                <td className="cmt-td">
                  <TextField
                    value={a.responsible}
                    onSave={(v) => updateActivity.mutate({ activityId: a.id, fields: { responsible: v } })}
                  />
                </td>
                <td className="cmt-td">
                  <DateInput
                    value={a.startDate}
                    onSave={(v) => updateActivity.mutate({ activityId: a.id, fields: { startDate: v } })}
                  />
                </td>
                <td className="cmt-td">
                  <DateInput
                    value={a.finishDate}
                    onSave={(v) => updateActivity.mutate({ activityId: a.id, fields: { finishDate: v } })}
                  />
                </td>
                <td className="cmt-td">
                  <Select
                    value={a.status}
                    options={ACTIVITY_STATUSES}
                    onSave={(v) => updateActivity.mutate({ activityId: a.id, fields: { status: v } })}
                  />
                </td>
                <td className="cmt-td">
                  <TextArea
                    rows={1}
                    value={a.resultFeedback}
                    onSave={(v) => updateActivity.mutate({ activityId: a.id, fields: { resultFeedback: v } })}
                  />
                </td>
                <td className="cmt-td">
                  <button
                    className="cmt-btn-danger"
                    onClick={() => {
                      if (confirm('Delete this activity?')) removeActivity.mutate(a.id);
                    }}
                  >
                    ✕
                  </button>
                </td>
              </tr>
            ))}
            {plan.activities.length === 0 && (
              <tr>
                <td colSpan={12} className="cmt-td py-8 text-center text-slate-400">
                  No activities yet — use “Add activity”.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
