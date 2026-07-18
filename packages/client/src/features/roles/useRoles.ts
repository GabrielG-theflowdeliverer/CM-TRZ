import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import type { RoleDto } from '../../lib/types';

/**
 * A project's role roster with each role's computed block. The same query is
 * inlined across several feature pages; this is its one authoritative home.
 */
export function useRoles(projectId: string) {
  return useQuery({
    queryKey: ['roles', projectId],
    queryFn: () => api.get<RoleDto[]>(`/api/projects/${projectId}/roles`),
    enabled: projectId !== '',
  });
}
