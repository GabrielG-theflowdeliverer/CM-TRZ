import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import type { DashboardDto, Project } from '../../lib/types';
import { BandChip, RiskBadge } from '../../ui/scores';

export function HomePage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const { data: projects } = useQuery({
    queryKey: ['projects'],
    queryFn: () => api.get<Project[]>('/api/projects'),
  });
  const { data: dashboard } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api.get<DashboardDto>('/api/dashboard'),
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['projects'] });
    void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  };

  const create = useMutation({
    mutationFn: (projectName: string) => api.post<Project>('/api/projects', { name: projectName }),
    onSuccess: (project) => {
      invalidate();
      navigate(`/projects/${project.id}/settings`);
    },
  });
  const duplicate = useMutation({
    mutationFn: (id: string) => api.post<Project>(`/api/projects/${id}/duplicate`),
    onSuccess: invalidate,
  });
  const archive = useMutation({
    mutationFn: (p: Project) => api.patch<Project>(`/api/projects/${p.id}`, { archived: !p.archived }),
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.del(`/api/projects/${id}`),
    onSuccess: invalidate,
  });
  const importProject = useMutation({
    mutationFn: (payload: unknown) => api.post<Project>('/api/import', payload),
    onSuccess: invalidate,
  });

  const visible = (projects ?? []).filter((p) => showArchived || !p.archived);
  const healthByProject = new Map((dashboard?.projects ?? []).map((h) => [h.projectId, h]));

  return (
    <div className="mx-auto max-w-5xl p-8">
      <header className="mb-8 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold">Change Management Tool</h1>
          <p className="text-sm text-slate-500">
            Prosci methodology workspace — projects, assessments, ADKAR blueprints and CM plans.
          </p>
        </div>
        <Link to="/dashboard" className="cmt-btn">
          Portfolio Dashboard
        </Link>
      </header>

      <div className="cmt-card mb-6">
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim()) create.mutate(name.trim());
            setName('');
          }}
        >
          <input
            className="cmt-input flex-1"
            placeholder="New project name…"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <button type="submit" className="cmt-btn" disabled={!name.trim() || create.isPending}>
            Create project
          </button>
          <button type="button" className="cmt-btn-secondary" onClick={() => fileInput.current?.click()}>
            Import JSON
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (file) importProject.mutate(JSON.parse(await file.text()));
              e.target.value = '';
            }}
          />
        </form>
      </div>

      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Projects ({visible.length})
        </h2>
        <label className="flex items-center gap-1.5 text-xs text-slate-500">
          <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
          Show archived
        </label>
      </div>

      {visible.length === 0 && (
        <div className="cmt-card py-12 text-center text-sm text-slate-500">
          No projects yet. Create your first change initiative above.
        </div>
      )}

      <ul className="space-y-3">
        {visible.map((project) => {
          const health = healthByProject.get(project.id);
          return (
            <li key={project.id} className={`cmt-card ${project.archived ? 'opacity-60' : ''}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <Link
                    to={`/projects/${project.id}/settings`}
                    className="text-base font-semibold text-indigo-700 hover:underline"
                  >
                    {project.name}
                  </Link>
                  {project.archived && (
                    <span className="ml-2 rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-slate-600">
                      Archived
                    </span>
                  )}
                  <p className="text-xs text-slate-500">
                    {project.projectType ?? 'No type'} · {project.pmApproach ?? 'No approach'}
                  </p>
                  {health && (
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <BandChip label="S" score={health.pct?.scores.success} />
                      <BandChip label="L/S" score={health.pct?.scores.leadership} />
                      <BandChip label="PM" score={health.pct?.scores.project_management} />
                      <BandChip label="CM" score={health.pct?.scores.change_management} />
                      <RiskBadge quadrant={health.risk?.quadrant} />
                    </div>
                  )}
                </div>
                <div className="flex shrink-0 gap-1.5">
                  <button
                    className="cmt-btn-secondary"
                    onClick={() => duplicate.mutate(project.id)}
                    disabled={duplicate.isPending}
                  >
                    Duplicate
                  </button>
                  <a className="cmt-btn-secondary" href={`/api/projects/${project.id}/export`} download>
                    Export
                  </a>
                  <button className="cmt-btn-secondary" onClick={() => archive.mutate(project)}>
                    {project.archived ? 'Unarchive' : 'Archive'}
                  </button>
                  <button
                    className="cmt-btn-danger"
                    onClick={() => {
                      if (confirm(`Delete "${project.name}" and all of its data? This cannot be undone.`)) {
                        remove.mutate(project.id);
                      }
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
