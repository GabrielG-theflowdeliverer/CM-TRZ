import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { OrgGroup } from '@cmt/domain';
import { api } from '../../lib/api';

/** Cross-project org-group registry (rows of the saturation heatmap). */
export function useOrgGroups() {
  return useQuery({
    queryKey: ['org-groups'],
    queryFn: () => api.get<OrgGroup[]>('/api/org-groups'),
  });
}

export function useCreateOrgGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => api.post<OrgGroup>('/api/org-groups', { name }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['org-groups'] }),
  });
}
