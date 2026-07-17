import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import type { GroupDto } from '../../lib/types';

export function useGroups(projectId: string) {
  return useQuery({
    queryKey: ['groups', projectId],
    queryFn: () => api.get<GroupDto[]>(`/api/projects/${projectId}/groups`),
    enabled: projectId !== '',
  });
}

export function useGroupMutations(projectId: string) {
  const queryClient = useQueryClient();
  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['groups', projectId] });
    void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    void queryClient.invalidateQueries({ queryKey: ['assessments', projectId] });
  };
  const create = useMutation({
    mutationFn: (name: string) => api.post<GroupDto>(`/api/projects/${projectId}/groups`, { name }),
    onSuccess: invalidate,
  });
  const update = useMutation({
    mutationFn: (input: { id: string; fields: Record<string, unknown> }) =>
      api.patch<GroupDto>(`/api/groups/${input.id}`, input.fields),
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.del(`/api/groups/${id}`),
    onSuccess: invalidate,
  });
  const saveAspects = useMutation({
    mutationFn: (input: { id: string; aspects: Array<Record<string, unknown>> }) =>
      api.put<GroupDto>(`/api/groups/${input.id}/aspects`, input.aspects),
    onSuccess: invalidate,
  });
  const saveAdkar = useMutation({
    mutationFn: (input: { id: string; responses: Record<string, number | null> }) =>
      api.put<GroupDto>(`/api/groups/${input.id}/adkar`, input.responses),
    onSuccess: invalidate,
  });
  return { create, update, remove, saveAspects, saveAdkar };
}
