import { useMutation, useQueryClient } from '@tanstack/react-query';
import { PM_APPROACHES, PROJECT_TYPES } from '@cmt/domain';
import { api } from '../../lib/api';
import type { Project } from '../../lib/types';
import { useProject } from '../../app/ProjectLayout';
import { Select, TextField } from '../../ui/controls';

export function ProjectSettingsPage() {
  const { projectId, project } = useProject();
  const queryClient = useQueryClient();
  const update = useMutation({
    mutationFn: (fields: Partial<Pick<Project, 'name' | 'projectType' | 'pmApproach'>>) =>
      api.patch<Project>(`/api/projects/${projectId}`, fields),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      void queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });

  if (!project) return null;
  return (
    <div className="max-w-2xl">
      <h2 className="mb-1 text-xl font-bold">Project Settings</h2>
      <p className="mb-6 text-sm text-slate-500">Project settings and details (Home sheet in Proxima Offline).</p>
      <div className="cmt-card space-y-4">
        <div>
          <label className="cmt-label">Project Name</label>
          <TextField value={project.name} onSave={(v) => v && update.mutate({ name: v })} />
        </div>
        <div>
          <label className="cmt-label">Project Type</label>
          <Select
            value={project.projectType}
            options={PROJECT_TYPES}
            placeholder="Select a project type…"
            onSave={(v) => update.mutate({ projectType: v })}
          />
        </div>
        <div>
          <label className="cmt-label">Project Management Approach</label>
          <Select
            value={project.pmApproach}
            options={PM_APPROACHES}
            placeholder="Select an approach…"
            onSave={(v) => update.mutate({ pmApproach: v as Project['pmApproach'] })}
          />
        </div>
      </div>
    </div>
  );
}
