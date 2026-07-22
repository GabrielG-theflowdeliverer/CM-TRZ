import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ReinforcementAction } from '@cmt/domain';
import { api } from '../../lib/api';

export function useReinforcement(projectId: string) {
  return useQuery({
    queryKey: ['reinforcement', projectId],
    queryFn: () => api.get<ReinforcementAction[]>(`/api/projects/${projectId}/reinforcement-actions`),
    enabled: projectId !== '',
  });
}

export function useReinforcementMutations(projectId: string) {
  const queryClient = useQueryClient();
  const onSuccess = () => void queryClient.invalidateQueries({ queryKey: ['reinforcement', projectId] });
  return {
    create: useMutation({
      mutationFn: (input: { groupId: string | null; mechanism: string }) =>
        api.post<ReinforcementAction>(`/api/projects/${projectId}/reinforcement-actions`, input),
      onSuccess,
    }),
    update: useMutation({
      mutationFn: (input: { id: string; fields: Record<string, unknown> }) =>
        api.patch<ReinforcementAction>(`/api/reinforcement-actions/${input.id}`, input.fields),
      onSuccess,
    }),
    remove: useMutation({ mutationFn: (id: string) => api.del(`/api/reinforcement-actions/${id}`), onSuccess }),
  };
}
