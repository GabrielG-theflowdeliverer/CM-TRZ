import { useParams } from 'react-router-dom';
import { ProjectDashboardView } from '../dashboard/ProjectDashboardView';
import { useSharedDashboard } from './useShare';

/**
 * The stakeholder's view behind a share link: the project dashboard, read-only,
 * with no app chrome and no navigation — see everything, touch nothing.
 */
export function SharedDashboardPage() {
  const { token = '' } = useParams();
  const { data, isLoading, isError } = useSharedDashboard(token);

  return (
    <div className="mx-auto max-w-5xl p-6">
      {isLoading && <p className="text-slate-500">Loading dashboard…</p>}
      {isError && (
        <div className="cmt-card">
          <h1 className="text-lg font-semibold">This share link isn’t valid</h1>
          <p className="text-sm text-slate-500">
            It may have been revoked or mistyped. Please check with whoever sent it.
          </p>
        </div>
      )}
      {data && (
        <div className="space-y-4">
          <header className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold">{data.project.name}</h1>
              <p className="text-sm text-slate-500">Change management dashboard</p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-500">
              View only
            </span>
          </header>
          <ProjectDashboardView d={data} />
        </div>
      )}
    </div>
  );
}
