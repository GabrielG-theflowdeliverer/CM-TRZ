import { Link } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ADKAR_ELEMENTS, ADKAR_LABELS, MAX_RELEASES } from '@cmt/domain';
import { api } from '../../lib/api';
import type { Roadmap } from '../../lib/types';
import { useProject } from '../../app/ProjectLayout';
import { useGroups } from '../impact/useGroups';
import { useRoadmap } from './useRoadmap';
import { DateInput, TextField } from '../../ui/controls';
import { useInvalidateProjectCaches } from '../../lib/queryInvalidation';

export function RoadmapPage() {
  const { projectId, project } = useProject();
  const queryClient = useQueryClient();
  const { data: roadmap } = useRoadmap(projectId);
  const { data: groups } = useGroups(projectId);
  const invalidateCaches = useInvalidateProjectCaches();
  const update = useMutation({
    mutationFn: (fields: Record<string, unknown>) =>
      api.put<Roadmap>(`/api/projects/${projectId}/roadmap`, fields),
    onSuccess: (data) => {
      queryClient.setQueryData(['roadmap', projectId], data);
      invalidateCaches(['blueprints', projectId], ['assessments', projectId]);
    },
  });

  if (!roadmap || !project) return null;

  // The roadmap style follows the Project Management Approach chosen in Settings.
  const approach = project.pmApproach;
  const iterative = approach === 'Iterative';

  const milestone = (releaseNo: number, element: string, groupId: string | null = null) =>
    roadmap.adkarMilestones.find(
      (m) => m.releaseNo === releaseNo && m.element === element && m.groupId === groupId,
    )?.date ?? null;
  const release = (releaseNo: number) => roadmap.releases.find((r) => r.releaseNo === releaseNo);
  const setMilestone = (releaseNo: number, element: string, date: string | null, groupId: string | null = null) =>
    update.mutate({ adkarMilestones: [{ releaseNo, element, date, groupId }] });

  const groupMilestoneMatrix = (
    <div className="cmt-card overflow-x-auto">
      <h3 className="mb-1 font-semibold">Group ADKAR Milestone Dates</h3>
      <p className="mb-3 text-xs text-slate-500">
        Per-group milestones override the overall dates as defaults for that group’s blueprints.
      </p>
      {(groups ?? []).length === 0 ? (
        <p className="text-sm text-slate-400">
          No impacted groups yet — define them under{' '}
          <Link className="text-indigo-600 hover:underline" to={`/projects/${projectId}/impact`}>
            Define Impact
          </Link>
          .
        </p>
      ) : (
        <table className="w-full min-w-[900px]">
          <thead>
            <tr>
              <th className="cmt-th w-44">Impacted Group</th>
              {ADKAR_ELEMENTS.map((el) => (
                <th key={el} className="cmt-th">
                  {ADKAR_LABELS[el]} Milestone
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(groups ?? []).map((g) => (
              <tr key={g.id}>
                <td className="cmt-td font-medium">{g.name}</td>
                {ADKAR_ELEMENTS.map((el) => (
                  <td key={el} className="cmt-td">
                    <DateInput
                      value={milestone(0, el, g.id)}
                      onSave={(v) => setMilestone(0, el, v, g.id)}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );

  return (
    <div className="max-w-4xl space-y-4">
      <div>
        <h2 className="text-xl font-bold">Roadmap</h2>
        <p className="text-sm text-slate-500">
          Key technical-side and people-side dates. ADKAR milestone dates feed the blueprints and tracking calendar.
        </p>
        <p className="mt-1 text-xs text-slate-400">
          Showing the <strong>{iterative ? 'Iterative' : 'Sequential'}</strong> roadmap
          {approach
            ? ` (Project Management Approach: ${approach})`
            : ' — set a Project Management Approach in Settings to change it'}
          .{' '}
          <Link to={`/projects/${projectId}/settings`} className="text-indigo-600 hover:underline">
            Change in Settings
          </Link>
        </p>
      </div>

      {!iterative && (
        <>
        <div className="cmt-card">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <h4 className="mb-2 text-sm font-semibold text-slate-600">Key Project Milestone Dates</h4>
              {(
                [
                  ['Kickoff', 'kickoffDate', roadmap.kickoffDate],
                  ['Go Live', 'goliveDate', roadmap.goliveDate],
                  ['Outcomes', 'outcomesDate', roadmap.outcomesDate],
                ] as const
              ).map(([label, field, value]) => (
                <div key={field} className="mb-2 flex items-center gap-3">
                  <span className="w-28 text-sm">{label}</span>
                  <DateInput value={value} onSave={(v) => update.mutate({ [field]: v })} />
                </div>
              ))}
              <p className="mt-2 text-[11px] text-slate-400">
                Saving key dates schedules the Kickoff / Go Live / Outcomes PCT assessments automatically.
              </p>
            </div>
            <div>
              <h4 className="mb-2 text-sm font-semibold text-slate-600">ADKAR Milestone Dates (Overall)</h4>
              {ADKAR_ELEMENTS.map((el) => (
                <div key={el} className="mb-2 flex items-center gap-3">
                  <span className="w-28 text-sm">{ADKAR_LABELS[el]}</span>
                  <DateInput value={milestone(0, el)} onSave={(v) => setMilestone(0, el, v)} />
                </div>
              ))}
            </div>
          </div>
        </div>
        {groupMilestoneMatrix}
        </>
      )}

      {iterative && (
        <>
          <div className="cmt-card">
            <h4 className="mb-2 text-sm font-semibold text-slate-600">Key Project Milestone Dates</h4>
            <div className="grid gap-2 md:grid-cols-3">
              {(
                [
                  ['Kickoff', 'kickoffDate', roadmap.kickoffDate],
                  ['Go Live', 'goliveDate', roadmap.goliveDate],
                  ['Outcomes', 'outcomesDate', roadmap.outcomesDate],
                ] as const
              ).map(([label, field, value]) => (
                <div key={field} className="flex items-center gap-3">
                  <span className="w-20 text-sm">{label}</span>
                  <DateInput value={value} onSave={(v) => update.mutate({ [field]: v })} />
                </div>
              ))}
            </div>
          </div>
          <div className="cmt-card overflow-x-auto">
            <h4 className="mb-2 text-sm font-semibold text-slate-600">
              Key Initiative Release Dates and Iterative ADKAR Milestone Dates
            </h4>
            <table className="w-full min-w-[1050px]">
              <thead>
                <tr>
                  <th className="cmt-th w-44">Release Name</th>
                  <th className="cmt-th w-36">Release Date</th>
                  {ADKAR_ELEMENTS.map((el) => (
                    <th key={el} className="cmt-th">
                      {ADKAR_LABELS[el]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: MAX_RELEASES }, (_, i) => i + 1).map((releaseNo) => (
                  <tr key={releaseNo}>
                    <td className="cmt-td">
                      <TextField
                        value={release(releaseNo)?.name ?? null}
                        placeholder={`Release ${releaseNo}`}
                        onSave={(v) => update.mutate({ releases: [{ releaseNo, name: v }] })}
                      />
                    </td>
                    <td className="cmt-td">
                      <DateInput
                        value={release(releaseNo)?.date ?? null}
                        onSave={(v) => update.mutate({ releases: [{ releaseNo, date: v }] })}
                      />
                    </td>
                    {ADKAR_ELEMENTS.map((el) => (
                      <td key={el} className="cmt-td">
                        <DateInput value={milestone(releaseNo, el)} onSave={(v) => setMilestone(releaseNo, el, v)} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {groupMilestoneMatrix}
        </>
      )}
    </div>
  );
}
