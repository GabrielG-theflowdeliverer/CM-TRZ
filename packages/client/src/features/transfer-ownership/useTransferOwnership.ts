import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { TransferItem } from '@cmt/domain';
import { api } from '../../lib/api';

export function useTransferItems(projectId: string) {
  return useQuery({
    queryKey: ['transfer-items', projectId],
    queryFn: () => api.get<TransferItem[]>(`/api/projects/${projectId}/transfer-items`),
    enabled: projectId !== '',
  });
}

export function useTransferMutations(projectId: string) {
  const queryClient = useQueryClient();
  const onSuccess = () => void queryClient.invalidateQueries({ queryKey: ['transfer-items', projectId] });
  return {
    create: useMutation({
      mutationFn: (input: { responsibility: string }) =>
        api.post<TransferItem>(`/api/projects/${projectId}/transfer-items`, input),
      onSuccess,
    }),
    update: useMutation({
      mutationFn: (input: { id: string; fields: Record<string, unknown> }) =>
        api.patch<TransferItem>(`/api/transfer-items/${input.id}`, input.fields),
      onSuccess,
    }),
    remove: useMutation({ mutationFn: (id: string) => api.del(`/api/transfer-items/${id}`), onSuccess }),
  };
}
