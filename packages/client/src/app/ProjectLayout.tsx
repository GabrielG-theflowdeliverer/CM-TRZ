import { NavLink, Outlet, useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { Project } from '../lib/types';

const NAV_SECTIONS: Array<{ title: string; items: Array<{ to: string; label: string }> }> = [
  {
    title: 'Project',
    items: [{ to: 'settings', label: 'Settings' }],
  },
  {
    title: 'Assess',
    items: [{ to: 'assessments', label: 'Assessments' }],
  },
  {
    title: 'Phase 1 — Prepare Approach',
    items: [
      { to: 'define-success', label: 'Define Success (4 P’s)' },
      { to: 'why-cm', label: 'Why Change Management' },
      { to: 'impact', label: 'Define Impact' },
      { to: 'roles', label: 'Roles' },
      { to: 'resources', label: 'Resources & Governance' },
      { to: 'resistance', label: 'Resistance' },
      { to: 'roadmap', label: 'Roadmap & Timeline' },
    ],
  },
  {
    title: 'Phase 2 — Manage Change',
    items: [
      { to: 'blueprints', label: 'ADKAR Blueprints' },
      { to: 'plans', label: 'CM Plans' },
      { to: 'tracking', label: 'Tracking Calendar' },
      { to: 'cm-performance', label: 'CM Performance' },
      { to: 'adapt-actions', label: 'Adapt Actions' },
    ],
  },
  {
    title: 'Reference',
    items: [{ to: 'reference', label: 'Methodology Reference' }],
  },
];

export function useProject(): { projectId: string; project: Project | undefined } {
  const { projectId = '' } = useParams();
  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => api.get<Project>(`/api/projects/${projectId}`),
    enabled: projectId !== '',
  });
  return { projectId, project };
}

export function ProjectLayout() {
  const { project } = useProject();
  return (
    <div className="flex min-h-screen">
      <aside className="w-64 shrink-0 border-r border-slate-200 bg-white">
        <div className="border-b border-slate-200 p-4">
          <Link to="/" className="text-xs font-semibold text-indigo-600 hover:underline">
            ← All projects
          </Link>
          <h1 className="mt-1 truncate text-lg font-bold" title={project?.name}>
            {project?.name ?? '…'}
          </h1>
          <p className="truncate text-xs text-slate-500">{project?.projectType ?? 'No project type set'}</p>
        </div>
        <nav className="space-y-4 p-3">
          {NAV_SECTIONS.map((section) => (
            <div key={section.title}>
              <div className="px-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                {section.title}
              </div>
              <ul>
                {section.items.map((item) => (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      className={({ isActive }) =>
                        `block rounded px-2 py-1.5 text-sm ${
                          isActive
                            ? 'bg-indigo-50 font-semibold text-indigo-700'
                            : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                        }`
                      }
                    >
                      {item.label}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </aside>
      <main className="min-w-0 flex-1 p-6">
        <Outlet />
      </main>
    </div>
  );
}
