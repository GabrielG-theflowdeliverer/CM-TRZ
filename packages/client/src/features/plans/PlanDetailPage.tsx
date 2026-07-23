import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PLAN_TYPES } from '@cmt/domain';
import { api } from '../../lib/api';
import type { PlanDto } from '../../lib/types';
import { useProject } from '../../app/ProjectLayout';
import { useGroups } from '../impact/useGroups';
import { usePlans } from './usePlans';
import { useRoles } from '../roles/useRoles';
import { useBlueprints } from '../blueprints/useBlueprints';
import { useActivityMutations } from '../activities/useActivities';
import { ActivityTable, type ActivityTableContext } from '../activities/ActivityTable';
import { DateInput, Select, TextField } from '../../ui/controls';
import { useInvalidateProjectCaches } from '../../lib/queryInvalidation';

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
  const { data: plans } = usePlans(projectId);
  const { data: blueprints } = useBlueprints(projectId);
  const { data: roles } = useRoles(projectId);
  const activityMutations = useActivityMutations(projectId);

  const invalidateCaches = useInvalidateProjectCaches();
  const refresh = (data?: PlanDto) => {
    if (data) queryClient.setQueryData(['plans', projectId, planId], data);
    invalidateCaches(['plans', projectId], ['activities', projectId]);
  };
  const update = useMutation({
    mutationFn: (fields: Record<string, unknown>) => api.patch<PlanDto>(`/api/plans/${planId}`, fields),
    onSuccess: refresh,
  });
  const addActivity = useMutation({
    mutationFn: () => api.post<PlanDto>(`/api/plans/${planId}/activities`, {}),
    onSuccess: refresh,
  });

  if (!plan) return null;
  const progress = plan.computed.progress;

  const ctx: ActivityTableContext = {
    groups: groups ?? [],
    plans: plans ?? [],
    blueprints: blueprints ?? [],
    roles: roles ?? [],
    onUpdate: (id, fields) => {
      activityMutations.update.mutate(
        { id, fields },
        { onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['plans', projectId, planId] }) },
      );
    },
    onDelete: (id) => {
      activityMutations.remove.mutate(id, {
        onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['plans', projectId, planId] }),
      });
    },
  };

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
            {progress.percentComplete != null ? ` (${progress.percentComplete}%)` : ''} · activities can be shared with
            other plans and blueprints
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

      <div className="cmt-card">
        <ActivityTable activities={plan.activities} ctx={ctx} hideColumns={['blueprints']} />
      </div>
    </div>
  );
}
