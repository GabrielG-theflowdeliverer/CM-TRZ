import { Navigate, NavLink, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import type { ProjectDashboardDto } from '../features/dashboard/ProjectDashboardView';
import { ErrorBoundary } from '../ui/ErrorBoundary';
import { NAV_SECTIONS, useProject } from './ProjectLayout';
import { PROJECT_PAGE_ROUTES } from './projectRoutes';

/**
 * The SPA in view-only share mode (booted by main.tsx when the URL is
 * /view/:token, which also becomes the router basename — so the regular pages'
 * absolute /projects/... links resolve inside the share view untouched). Same
 * pages, same data shapes; reads go through the token mirror and writes are
 * refused at the api layer and 403'd by the server.
 */
export function ShareApp({ token }: { token: string }) {
  return (
    <Routes>
      <Route path="/" element={<ShareEntry token={token} />} />
      <Route path="/projects/:projectId" element={<SharedProjectLayout />}>
        <Route index element={<Navigate to="dashboard" replace />} />
        {PROJECT_PAGE_ROUTES.filter((r) => !r.editorOnly).map((r) => (
          <Route key={r.path} path={r.path} element={r.element} />
        ))}
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

/** Resolve the token to its project, then land on the dashboard. */
function ShareEntry({ token }: { token: string }) {
  // Plain fetch of the entry payload — deliberately NOT via the api helper,
  // whose share rewrite would turn /api/share/:token into a nested path.
  const { data, isError } = useQuery({
    queryKey: ['share-entry', token],
    queryFn: async () => {
      const res = await fetch(`/api/share/${token}`);
      if (!res.ok) throw new Error('Shared view not found');
      return (await res.json()) as ProjectDashboardDto;
    },
    retry: false,
  });

  if (isError) {
    return (
      <div className="mx-auto max-w-2xl p-6">
        <div className="cmt-card">
          <h1 className="text-lg font-semibold">This share link isn’t valid</h1>
          <p className="text-sm text-slate-500">
            It may have been revoked or mistyped. Please check with whoever sent it.
          </p>
        </div>
      </div>
    );
  }
  if (!data) return <p className="p-6 text-slate-500">Loading…</p>;
  return <Navigate to={`/projects/${data.project.id}/dashboard`} replace />;
}

/** ProjectLayout's read-only twin: same nav minus Settings, nothing editable. */
function SharedProjectLayout() {
  const location = useLocation();
  return (
    <div className="flex min-h-screen">
      <aside className="w-64 shrink-0 border-r border-slate-200 bg-white">
        <div className="border-b border-slate-200 p-4">
          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-500">
            View only
          </span>
          <ProjectHeading />
        </div>
        <nav className="space-y-4 p-3">
          {NAV_SECTIONS.map((section) => {
            const items = section.items.filter((item) => item.to !== 'settings');
            if (items.length === 0) return null;
            return (
              <div key={section.title}>
                <div className="px-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  {section.title}
                </div>
                <ul>
                  {items.map((item) => (
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
            );
          })}
        </nav>
      </aside>
      {/* data-view-only: index.css disables form controls inside; the server's
          GET-only guard is the actual enforcement, this is just honest UI. */}
      <main className="min-w-0 flex-1 p-6" data-view-only>
        <ErrorBoundary resetKey={location.pathname}>
          <Outlet />
        </ErrorBoundary>
      </main>
    </div>
  );
}

function ProjectHeading() {
  // Same query the pages use; in share mode it resolves via the token mirror.
  const { project } = useProject();
  return (
    <>
      <h1 className="mt-1 truncate text-lg font-bold" title={project?.name}>
        {project?.name ?? '…'}
      </h1>
      <p className="truncate text-xs text-slate-500">{project?.projectType ?? 'No project type set'}</p>
    </>
  );
}
