import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import type { Project } from '../../lib/types';
import { useProject } from '../../app/ProjectLayout';
import { ProjectDashboardView, type ProjectDashboardDto } from './ProjectDashboardView';

export type { ProjectDashboardDto } from './ProjectDashboardView';

export function ProjectDashboardPage() {
  const { projectId } = useProject();
  const queryClient = useQueryClient();
  const { data: d } = useQuery({
    queryKey: ['project-dashboard', projectId],
    queryFn: () => api.get<ProjectDashboardDto>(`/api/projects/${projectId}/dashboard`),
    enabled: projectId !== '',
  });
  const saveWatchList = useMutation({
    mutationFn: (watchGroupIds: string[]) => api.patch<Project>(`/api/projects/${projectId}`, { watchGroupIds }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['project-dashboard', projectId] });
      void queryClient.invalidateQueries({ queryKey: ['project', projectId] });
    },
  });

  if (!d) return null;
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold">Project Dashboard</h2>
        <p className="text-sm text-slate-500">Health across assessments, impacted groups and CM performance.</p>
      </div>
      <ProjectDashboardView d={d} nav={{ projectId, onSaveWatchList: (ids) => saveWatchList.mutate(ids) }} />
    </div>
  );
}
