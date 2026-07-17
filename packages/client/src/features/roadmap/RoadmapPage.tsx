import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ADKAR_ELEMENTS, ADKAR_LABELS, MAX_RELEASES } from '@cmt/domain';
import { api } from '../../lib/api';
import type { Roadmap } from '../../lib/types';
import { useProject } from '../../app/ProjectLayout';
import { DateInput } from '../../ui/controls';

export function RoadmapPage() {
  const { projectId } = useProject();
  const queryClient = useQueryClient();
  const { data: roadmap } = useQuery({
    queryKey: ['roadmap', projectId],
    queryFn: () => api.get<Roadmap>(`/api/projects/${projectId}/roadmap`),
    enabled: projectId !== '',
  });
  const update = useMutation({
    mutationFn: (fields: Record<string, unknown>) =>
      api.put<Roadmap>(`/api/projects/${projectId}/roadmap`, fields),
    onSuccess: (data) => {
      queryClient.setQueryData(['roadmap', projectId], data);
      void queryClient.invalidateQueries({ queryKey: ['blueprints', projectId] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });

  if (!roadmap) return null;

  const milestone = (releaseNo: number, element: string) =>
    roadmap.adkarMilestones.find((m) => m.releaseNo === releaseNo && m.element === element)?.date ?? null;
  const release = (releaseNo: number) => roadmap.releases.find((r) => r.releaseNo === releaseNo)?.date ?? null;
  const setMilestone = (releaseNo: number, element: string, date: string | null) =>
    update.mutate({ adkarMilestones: [{ releaseNo, element, date }] });

  return (
    <div className="max-w-4xl space-y-4">
      <div>
        <h2 className="text-xl font-bold">Roadmap & Timeline</h2>
        <p className="text-sm text-slate-500">
          Key technical-side and people-side dates. ADKAR milestone dates feed the blueprints and tracking calendar.
        </p>
      </div>

      <div className="cmt-card">
        <h3 className="mb-3 font-semibold">Sequential</h3>
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
          </div>
          <div>
            <h4 className="mb-2 text-sm font-semibold text-slate-600">ADKAR Milestone Dates</h4>
            {ADKAR_ELEMENTS.map((el) => (
              <div key={el} className="mb-2 flex items-center gap-3">
                <span className="w-28 text-sm">{ADKAR_LABELS[el]}</span>
                <DateInput value={milestone(0, el)} onSave={(v) => setMilestone(0, el, v)} />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="cmt-card overflow-x-auto">
        <h3 className="mb-3 font-semibold">Iterative</h3>
        <table className="w-full min-w-[900px]">
          <thead>
            <tr>
              <th className="cmt-th w-32">Release</th>
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
                <td className="cmt-td font-medium">Release {releaseNo}</td>
                <td className="cmt-td">
                  <DateInput
                    value={release(releaseNo)}
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
    </div>
  );
}
