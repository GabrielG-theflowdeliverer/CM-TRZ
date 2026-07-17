import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import type { ResistanceItem } from '../../lib/types';
import { useProject } from '../../app/ProjectLayout';
import { useGroups } from '../impact/useGroups';
import { Select, TextArea } from '../../ui/controls';

export function ResistancePage() {
  const { projectId } = useProject();
  const queryClient = useQueryClient();
  const { data: items } = useQuery({
    queryKey: ['resistance', projectId],
    queryFn: () => api.get<ResistanceItem[]>(`/api/projects/${projectId}/resistance`),
    enabled: projectId !== '',
  });
  const { data: groups } = useGroups(projectId);
  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ['resistance', projectId] });

  const create = useMutation({
    mutationFn: () => api.post<ResistanceItem>(`/api/projects/${projectId}/resistance`, {}),
    onSuccess: invalidate,
  });
  const update = useMutation({
    mutationFn: (input: { id: string; fields: Record<string, unknown> }) =>
      api.patch<ResistanceItem>(`/api/resistance/${input.id}`, input.fields),
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.del(`/api/resistance/${id}`),
    onSuccess: invalidate,
  });

  const groupOptions = (groups ?? []).map((g) => g.name);

  return (
    <div className="max-w-4xl space-y-4">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-xl font-bold">Resistance and Special Tactics</h2>
          <p className="text-sm text-slate-500">Define Approach — anticipated resistance by impacted group.</p>
        </div>
        <button className="cmt-btn" onClick={() => create.mutate()}>
          Add row
        </button>
      </div>
      <div className="cmt-card">
        <table className="w-full">
          <thead>
            <tr>
              <th className="cmt-th w-8">#</th>
              <th className="cmt-th w-52">Impacted Group</th>
              <th className="cmt-th">Anticipated Resistance</th>
              <th className="cmt-th">Special Tactics to Address Resistance</th>
              <th className="cmt-th w-10"></th>
            </tr>
          </thead>
          <tbody>
            {(items ?? []).map((item, i) => {
              const selectedGroup = (groups ?? []).find((g) => g.id === item.groupId);
              return (
                <tr key={item.id}>
                  <td className="cmt-td text-slate-400">{i + 1}</td>
                  <td className="cmt-td">
                    <Select
                      value={selectedGroup?.name ?? item.groupLabel}
                      options={groupOptions}
                      placeholder="Group…"
                      onSave={(name) => {
                        const group = (groups ?? []).find((g) => g.name === name);
                        update.mutate({
                          id: item.id,
                          fields: group ? { groupId: group.id, groupLabel: null } : { groupId: null, groupLabel: name },
                        });
                      }}
                    />
                  </td>
                  <td className="cmt-td">
                    <TextArea
                      rows={2}
                      value={item.anticipatedResistance}
                      onSave={(v) => update.mutate({ id: item.id, fields: { anticipatedResistance: v } })}
                    />
                  </td>
                  <td className="cmt-td">
                    <TextArea
                      rows={2}
                      value={item.specialTactics}
                      onSave={(v) => update.mutate({ id: item.id, fields: { specialTactics: v } })}
                    />
                  </td>
                  <td className="cmt-td">
                    <button
                      className="cmt-btn-danger"
                      onClick={() => {
                        if (confirm('Delete this row?')) remove.mutate(item.id);
                      }}
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              );
            })}
            {(items ?? []).length === 0 && (
              <tr>
                <td colSpan={5} className="cmt-td py-8 text-center text-slate-400">
                  No resistance rows yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
