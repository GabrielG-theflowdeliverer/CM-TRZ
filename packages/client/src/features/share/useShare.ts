import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import type { ProjectDashboardDto } from '../dashboard/ProjectDashboardView';

export interface ShareState {
  token: string | null;
}

/** Practitioner-side: whether view-only sharing is on for a project. */
export function useShareState(projectId: string) {
  return useQuery({
    queryKey: ['share', projectId],
    queryFn: () => api.get<ShareState>(`/api/projects/${projectId}/share`),
    enabled: projectId !== '',
  });
}

/** Enable sharing — or rotate the token, revoking every previously sent link. */
export function useEnableShare(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<ShareState>(`/api/projects/${projectId}/share`),
    onSuccess: (data) => queryClient.setQueryData(['share', projectId], data),
  });
}

export function useDisableShare(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.del(`/api/projects/${projectId}/share`),
    onSuccess: () => queryClient.setQueryData<ShareState>(['share', projectId], { token: null }),
  });
}

/** Stakeholder-side: the read-only dashboard behind a share token. */
export function useSharedDashboard(token: string) {
  return useQuery({
    queryKey: ['shared-dashboard', token],
    queryFn: () => api.get<ProjectDashboardDto>(`/api/share/${token}`),
    enabled: token !== '',
    // A dead link is a 404, not a transient failure — don't retry.
    retry: false,
  });
}
