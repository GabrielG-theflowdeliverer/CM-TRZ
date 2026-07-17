import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CM_PERF_STATUSES, CM_PERF_TYPES } from '@cmt/domain';
import { api } from '../../lib/api';
import type { CmPerfEntry } from '../../lib/types';
import { useProject } from '../../app/ProjectLayout';
import { DateInput, Select, TextArea } from '../../ui/controls';

const STATUS_COLORS: Record<string, string> = {
  'No Progress': 'bg-slate-200 text-slate-700',
  'Well Behind Target': 'bg-red-100 text-red-800',
  'Behind Target': 'bg-amber-100 text-amber-800',
  'On Target': 'bg-green-100 text-green-800',
  'Ahead of Target': 'bg-emerald-200 text-emerald-900',
};

export function CmPerformancePage() {
  const { projectId } = useProject();
  const queryClient = useQueryClient();
  const { data: entries } = useQuery({
    queryKey: ['cm-perf', projectId],
    queryFn: () => api.get<CmPerfEntry[]>(`/api/projects/${projectId}/cm-perf`),
    enabled: projectId !== '',
  });
  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['cm-perf', projectId] });
    void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  };
  const create = useMutation({
    mutationFn: () => api.post<CmPerfEntry>(`/api/projects/${projectId}/cm-perf`, {}),
    onSuccess: invalidate,
  });
  const update = useMutation({
    mutationFn: (input: { id: string; fields: Record<string, unknown> }) =>
      api.patch<CmPerfEntry>(`/api/cm-perf/${input.id}`, input.fields),
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.del(`/api/cm-perf/${id}`),
    onSuccess: invalidate,
  });

  return (
    <div className="max-w-5xl space-y-4">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-xl font-bold">Change Management Performance</h2>
          <p className="text-sm text-slate-500">
            Track how blueprint and plan execution is progressing against target.
          </p>
        </div>
        <button className="cmt-btn" onClick={() => create.mutate()}>
          Add entry
        </button>
      </div>

      <div className="cmt-card">
        <table className="w-full">
          <thead>
            <tr>
              <th className="cmt-th w-8">#</th>
              <th className="cmt-th w-40">Type</th>
              <th className="cmt-th">Description (Specific Plan or Group)</th>
              <th className="cmt-th w-36">Date Scheduled</th>
              <th className="cmt-th w-36">Date Completed</th>
              <th className="cmt-th w-44">Status</th>
              <th className="cmt-th">Notes</th>
              <th className="cmt-th w-10"></th>
            </tr>
          </thead>
          <tbody>
            {(entries ?? []).map((entry, i) => (
              <tr key={entry.id}>
                <td className="cmt-td text-slate-400">{i + 1}</td>
                <td className="cmt-td">
                  <Select
                    value={entry.type}
                    options={CM_PERF_TYPES}
                    onSave={(v) => update.mutate({ id: entry.id, fields: { type: v } })}
                  />
                </td>
                <td className="cmt-td">
                  <TextArea
                    rows={1}
                    value={entry.description}
                    onSave={(v) => update.mutate({ id: entry.id, fields: { description: v } })}
                  />
                </td>
                <td className="cmt-td">
                  <DateInput
                    value={entry.scheduledDate}
                    onSave={(v) => update.mutate({ id: entry.id, fields: { scheduledDate: v } })}
                  />
                </td>
                <td className="cmt-td">
                  <DateInput
                    value={entry.completedDate}
                    onSave={(v) => update.mutate({ id: entry.id, fields: { completedDate: v } })}
                  />
                </td>
                <td className="cmt-td">
                  <div className="flex items-center gap-1.5">
                    <Select
                      value={entry.status}
                      options={CM_PERF_STATUSES}
                      onSave={(v) => update.mutate({ id: entry.id, fields: { status: v } })}
                    />
                    {entry.status && (
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_COLORS[entry.status] ?? ''}`}>
                        ●
                      </span>
                    )}
                  </div>
                </td>
                <td className="cmt-td">
                  <TextArea
                    rows={1}
                    value={entry.notes}
                    onSave={(v) => update.mutate({ id: entry.id, fields: { notes: v } })}
                  />
                </td>
                <td className="cmt-td">
                  <button
                    className="cmt-btn-danger"
                    onClick={() => {
                      if (confirm('Delete this entry?')) remove.mutate(entry.id);
                    }}
                  >
                    ✕
                  </button>
                </td>
              </tr>
            ))}
            {(entries ?? []).length === 0 && (
              <tr>
                <td colSpan={8} className="cmt-td py-8 text-center text-slate-400">
                  No performance entries yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
