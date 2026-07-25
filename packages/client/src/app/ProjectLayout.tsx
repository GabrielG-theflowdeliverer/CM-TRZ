import { NavLink, Outlet, useLocation, Link } from 'react-router-dom';
import { ErrorBoundary } from '../ui/ErrorBoundary';
import { NAV_SECTIONS } from './navSections';
import { useProject } from './useProject';

export function ProjectLayout() {
  const { project } = useProject();
  const location = useLocation();
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
        <ErrorBoundary resetKey={location.pathname}>
          <Outlet />
        </ErrorBoundary>
      </main>
    </div>
  );
}
