import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';

export type DocValues = Record<string, string | null>;

export function useDoc(projectId: string, docKey: string) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['doc', projectId, docKey],
    queryFn: () => api.get<DocValues>(`/api/projects/${projectId}/docs/${docKey}`),
    enabled: projectId !== '',
  });
  const save = useMutation({
    mutationFn: (fields: DocValues) => api.put<DocValues>(`/api/projects/${projectId}/docs/${docKey}`, fields),
    onSuccess: (data) => queryClient.setQueryData(['doc', projectId, docKey], data),
  });
  return {
    doc: query.data,
    saveField: (field: string, value: string | null) => save.mutate({ [field]: value }),
    complete: query.data?._status === 'Completed',
    toggleComplete: () => save.mutate({ _status: query.data?._status === 'Completed' ? null : 'Completed' }),
  };
}
