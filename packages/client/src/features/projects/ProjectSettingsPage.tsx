import { useMutation, useQueryClient } from '@tanstack/react-query';
import { PM_APPROACHES, PROJECT_STATUSES, PROJECT_TYPES } from '@cmt/domain';
import { api } from '../../lib/api';
import type { Project } from '../../lib/types';
import { useProject } from '../../app/ProjectLayout';
import { Select, TextField } from '../../ui/controls';

export function ProjectSettingsPage() {
  const { projectId, project } = useProject();
  const queryClient = useQueryClient();
  const update = useMutation({
    mutationFn: (fields: Partial<Pick<Project, 'name' | 'projectType' | 'pmApproach' | 'status'>>) =>
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
            onSave={(v) => update.mutate({ pmApproach: v })}
          />
        </div>
        <div>
          <label className="cmt-label">Project Status</label>
          <Select
            value={project.status}
            options={PROJECT_STATUSES}
            onSave={(v) => v && update.mutate({ status: v })}
          />
        </div>
      </div>

      <div className="cmt-card mt-4">
        <h3 className="mb-2 font-semibold">Export</h3>
        <p className="mb-3 text-xs text-slate-500">
          Download the full project as JSON (re-importable) or individual grids as CSV for spreadsheets and project
          planning tools.
        </p>
        <div className="flex flex-wrap gap-2">
          <a className="cmt-btn-secondary" href={`/api/projects/${projectId}/export`} download>
            Export JSON
          </a>
          <a className="cmt-btn-secondary" href={`/api/projects/${projectId}/export/csv`} download>
            All CSVs
          </a>
          {(['groups', 'roles', 'activities', 'assessments'] as const).map((dataset) => (
            <a
              key={dataset}
              className="cmt-btn-secondary"
              href={`/api/projects/${projectId}/export/csv/${dataset}`}
              download
            >
              {dataset[0]!.toUpperCase() + dataset.slice(1)} CSV
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
