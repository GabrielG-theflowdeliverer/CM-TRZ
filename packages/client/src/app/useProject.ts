import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { api } from '../lib/api';
import type { Project } from '../lib/types';

/**
 * The project the current route is scoped to: its id from `:projectId`, and the
 * project record once loaded. Every project-scoped page reads it, which is why
 * it lives in its own module rather than being exported from the layout that
 * happens to render them.
 *
 * `project` is undefined until the query resolves; callers that only need the
 * id can use it immediately.
 */
export function useProject(): { projectId: string; project: Project | undefined } {
  const { projectId = '' } = useParams();
  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => api.get<Project>(`/api/projects/${projectId}`),
    enabled: projectId !== '',
  });
  return { projectId, project };
}
