import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import type { GroupDto } from '../../lib/types';
import { useInvalidateProjectCaches } from '../../lib/queryInvalidation';

export function useGroups(projectId: string) {
  return useQuery({
    queryKey: ['groups', projectId],
    queryFn: () => api.get<GroupDto[]>(`/api/projects/${projectId}/groups`),
    enabled: projectId !== '',
  });
}

export function useGroupMutations(projectId: string) {
  const invalidateCaches = useInvalidateProjectCaches();
  const invalidate = () => invalidateCaches(['groups', projectId], ['assessments', projectId]);
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
