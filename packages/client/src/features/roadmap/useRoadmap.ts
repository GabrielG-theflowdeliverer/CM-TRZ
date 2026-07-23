import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import type { Roadmap } from '../../lib/types';

/**
 * A project's roadmap (release dates + ADKAR milestones). The same query is
 * inlined across several feature pages; this is its one authoritative home.
 */
export function useRoadmap(projectId: string) {
  return useQuery({
    queryKey: ['roadmap', projectId],
    queryFn: () => api.get<Roadmap>(`/api/projects/${projectId}/roadmap`),
    enabled: projectId !== '',
  });
}
