import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import type { BlueprintDto, BlueprintSnapshot } from '../../lib/types';
import { useInvalidateProjectCaches } from '../../lib/queryInvalidation';

export function useBlueprints(projectId: string) {
  return useQuery({
    queryKey: ['blueprints', projectId],
    queryFn: () => api.get<BlueprintDto[]>(`/api/projects/${projectId}/blueprints`),
    enabled: projectId !== '',
  });
}

export function useBlueprint(projectId: string, blueprintId: string) {
  return useQuery({
    queryKey: ['blueprints', projectId, blueprintId],
    queryFn: () => api.get<BlueprintDto>(`/api/blueprints/${blueprintId}`),
    enabled: blueprintId !== '',
  });
}

export function useBlueprintMutations(projectId: string, blueprintId?: string) {
  const queryClient = useQueryClient();
  const invalidateCaches = useInvalidateProjectCaches();
  const refresh = (data?: BlueprintDto) => {
    if (data && blueprintId) queryClient.setQueryData(['blueprints', projectId, blueprintId], data);
    invalidateCaches(['blueprints', projectId]);
  };
  const create = useMutation({
    mutationFn: (input: { scopeKind: string; groupId?: string | null; name: string }) =>
      api.post<BlueprintDto>(`/api/projects/${projectId}/blueprints`, input),
    onSuccess: () => refresh(),
  });
  const update = useMutation({
    mutationFn: (input: { id: string; fields: Record<string, unknown> }) =>
      api.patch<BlueprintDto>(`/api/blueprints/${input.id}`, input.fields),
    onSuccess: refresh,
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.del(`/api/blueprints/${id}`),
    onSuccess: () => refresh(),
  });
  const saveElement = useMutation({
    mutationFn: (input: { id: string; element: string; fields: Record<string, unknown> }) =>
      api.put<BlueprintDto>(`/api/blueprints/${input.id}/elements`, { element: input.element, ...input.fields }),
    onSuccess: refresh,
  });
  const addActivity = useMutation({
    mutationFn: (input: { id: string; element: string }) =>
      api.post<BlueprintDto>(`/api/blueprints/${input.id}/activities`, { element: input.element }),
    onSuccess: refresh,
  });
  const updateActivity = useMutation({
    mutationFn: (input: { activityId: string; fields: Record<string, unknown> }) =>
      api.patch<BlueprintDto>(`/api/blueprint-activities/${input.activityId}`, input.fields),
    onSuccess: refresh,
  });
  const removeActivity = useMutation({
    mutationFn: (activityId: string) => api.del<BlueprintDto>(`/api/blueprint-activities/${activityId}`),
    onSuccess: (data) => refresh(data as BlueprintDto),
  });
  const takeSnapshot = useMutation({
    mutationFn: (input: { id: string; label: string }) =>
      api.post<BlueprintSnapshot>(`/api/blueprints/${input.id}/snapshots`, { label: input.label }),
    onSuccess: () => {
      if (blueprintId) void queryClient.invalidateQueries({ queryKey: ['snapshots', blueprintId] });
    },
  });
  const deleteSnapshot = useMutation({
    mutationFn: (snapshotId: string) => api.del(`/api/snapshots/${snapshotId}`),
    onSuccess: () => {
      if (blueprintId) void queryClient.invalidateQueries({ queryKey: ['snapshots', blueprintId] });
    },
  });
  return { create, update, remove, saveElement, addActivity, updateActivity, removeActivity, takeSnapshot, deleteSnapshot };
}

export function useSnapshots(blueprintId: string) {
  return useQuery({
    queryKey: ['snapshots', blueprintId],
    queryFn: () => api.get<BlueprintSnapshot[]>(`/api/blueprints/${blueprintId}/snapshots`),
    enabled: blueprintId !== '',
  });
}
