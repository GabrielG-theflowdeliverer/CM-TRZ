import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import type { PlanDto } from '../../lib/types';

export function usePlans(projectId: string) {
  return useQuery({
    queryKey: ['plans', projectId],
    queryFn: () => api.get<PlanDto[]>(`/api/projects/${projectId}/plans`),
    enabled: projectId !== '',
  });
}

export function usePlanMutations(projectId: string) {
  const queryClient = useQueryClient();
  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ['plans', projectId] });
  const create = useMutation({
    mutationFn: (name: string) => api.post<PlanDto>(`/api/projects/${projectId}/plans`, { kind: 'extend', name }),
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.del(`/api/plans/${id}`),
    onSuccess: invalidate,
  });
  return { create, remove };
}
