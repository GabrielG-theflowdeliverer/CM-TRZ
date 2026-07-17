import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import type { Activity } from '../../lib/types';

export function useActivities(projectId: string) {
  return useQuery({
    queryKey: ['activities', projectId],
    queryFn: () => api.get<Activity[]>(`/api/projects/${projectId}/activities`),
    enabled: projectId !== '',
  });
}

export function useActivityMutations(projectId: string) {
  const queryClient = useQueryClient();
  const invalidate = () => {
    for (const key of ['activities', 'plans', 'blueprints'] as const) {
      void queryClient.invalidateQueries({ queryKey: [key, projectId] });
    }
    void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  };
  const create = useMutation({
    mutationFn: (input: Record<string, unknown>) =>
      api.post<Activity>(`/api/projects/${projectId}/activities`, input),
    onSuccess: invalidate,
  });
  const update = useMutation({
    mutationFn: (input: { id: string; fields: Record<string, unknown> }) =>
      api.patch<Activity>(`/api/activities/${input.id}`, input.fields),
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.del(`/api/activities/${id}`),
    onSuccess: invalidate,
  });
  return { create, update, remove, invalidate };
}
