import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ADKAR_ELEMENTS,
  ADKAR_SHORT,
  ROLE_COLUMN_HELP,
  ROLE_INFLUENCE_LEVELS,
  ROLE_ROSTERS,
  ROLE_SUPPORT_LEVELS,
  ROSTER_HINTS,
  ROSTER_LABELS,
  adkarItemKey,
  type RoleRoster,
} from '@cmt/domain';
import { api } from '../../lib/api';
import type { GroupDto, RoleDto } from '../../lib/types';
import { useProject } from '../../app/ProjectLayout';
import { useGroups } from '../impact/useGroups';
import { BarrierBadge, ScorePicker, adkarCellColor } from '../../ui/scores';
import { Select, TextArea, TextField } from '../../ui/controls';

function GroupMultiSelect(props: {
  groups: GroupDto[];
  selected: string[];
  onChange: (groupIds: string[]) => void;
}) {
  const names = props.groups.filter((g) => props.selected.includes(g.id)).map((g) => g.name);
  return (
    <details className="relative">
      <summary className="cmt-input cursor-pointer list-none truncate" title={names.join(', ')}>
        {names.length ? names.join(', ') : <span className="text-slate-400">Select groups…</span>}
      </summary>
      <div className="absolute z-10 mt-1 max-h-48 w-56 overflow-auto rounded border border-slate-200 bg-white p-2 shadow-lg">
        {props.groups.length === 0 && <p className="text-xs text-slate-400">No impacted groups defined yet.</p>}
        {props.groups.map((g) => (
          <label key={g.id} className="flex items-center gap-2 py-0.5 text-sm">
            <input
              type="checkbox"
              checked={props.selected.includes(g.id)}
              onChange={(e) =>
                props.onChange(
                  e.target.checked ? [...props.selected, g.id] : props.selected.filter((id) => id !== g.id),
                )
              }
            />
            {g.name}
          </label>
        ))}
      </div>
    </details>
  );
}

export function RolesPage() {
  const { projectId } = useProject();
  const queryClient = useQueryClient();
  const { data: roles } = useQuery({
    queryKey: ['roles', projectId],
    queryFn: () => api.get<RoleDto[]>(`/api/projects/${projectId}/roles`),
    enabled: projectId !== '',
  });
  const { data: groups } = useGroups(projectId);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['roles', projectId] });
    void queryClient.invalidateQueries({ queryKey: ['assessments', projectId] });
  };
  const create = useMutation({
    mutationFn: (roster: RoleRoster) => api.post<RoleDto>(`/api/projects/${projectId}/roles`, { roster }),
    onSuccess: invalidate,
  });
  const update = useMutation({
    mutationFn: (input: { id: string; fields: Record<string, unknown> }) =>
      api.patch<RoleDto>(`/api/roles/${input.id}`, input.fields),
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.del(`/api/roles/${id}`),
    onSuccess: invalidate,
  });
  const saveAdkar = useMutation({
    mutationFn: (input: { id: string; responses: Record<string, number | null> }) =>
      api.put<RoleDto>(`/api/roles/${input.id}/adkar`, input.responses),
    onSuccess: invalidate,
  });

  return (
    <div className="max-w-full space-y-6">
      <div>
        <h2 className="text-xl font-bold">Roles</h2>
        <p className="text-sm text-slate-500">Define Approach — role rosters with ADKAR and activation tactics.</p>
      </div>

      {ROLE_ROSTERS.map((roster) => {
        const rosterRoles = (roles ?? []).filter((r) => r.roster === roster);
        return (
          <section key={roster} className="cmt-card">
            <div className="mb-1 flex items-center justify-between">
              <h3 className="font-semibold">Role Roster — {ROSTER_LABELS[roster]}</h3>
              <button className="cmt-btn" onClick={() => create.mutate(roster)}>
                Add role
              </button>
            </div>
            <p className="mb-3 text-xs text-slate-500">{ROSTER_HINTS[roster]}</p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1900px]">
                <thead>
                  <tr>
                    <th className="cmt-th min-w-48">Role Name</th>
                    <th className="cmt-th min-w-36">Initials or Full Name</th>
                    <th className="cmt-th min-w-48">Impacted Group(s)</th>
                    <th className="cmt-th min-w-60" title={ROLE_COLUMN_HELP.roleDefinition}>
                      Role Definition (I __ by __)
                    </th>
                    <th className="cmt-th min-w-28">Support</th>
                    <th className="cmt-th min-w-28">Influence</th>
                    {ADKAR_ELEMENTS.map((el) => (
                      <th key={el} className="cmt-th w-40 text-center" title={el}>
                        {ADKAR_SHORT[el]}
                      </th>
                    ))}
                    <th className="cmt-th min-w-28">Barrier</th>
                    <th className="cmt-th min-w-60" title={ROLE_COLUMN_HELP.activationTactics}>
                      Activation Tactics
                    </th>
                    <th className="cmt-th w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {rosterRoles.map((role) => (
                    <tr key={role.id}>
                      <td className="cmt-td">
                        <TextField
                          value={role.roleName}
                          onSave={(v) => update.mutate({ id: role.id, fields: { roleName: v } })}
                        />
                      </td>
                      <td className="cmt-td">
                        <TextField
                          value={role.personName}
                          onSave={(v) => update.mutate({ id: role.id, fields: { personName: v } })}
                        />
                      </td>
                      <td className="cmt-td">
                        <GroupMultiSelect
                          groups={groups ?? []}
                          selected={role.groupIds}
                          onChange={(groupIds) => update.mutate({ id: role.id, fields: { groupIds } })}
                        />
                      </td>
                      <td className="cmt-td">
                        <TextArea
                          rows={1}
                          value={role.roleDefinition}
                          onSave={(v) => update.mutate({ id: role.id, fields: { roleDefinition: v } })}
                        />
                      </td>
                      <td className="cmt-td">
                        <Select
                          value={role.support}
                          options={ROLE_SUPPORT_LEVELS}
                          onSave={(v) => update.mutate({ id: role.id, fields: { support: v } })}
                        />
                      </td>
                      <td className="cmt-td">
                        <Select
                          value={role.influence}
                          options={ROLE_INFLUENCE_LEVELS}
                          onSave={(v) => update.mutate({ id: role.id, fields: { influence: v } })}
                        />
                      </td>
                      {ADKAR_ELEMENTS.map((el) => (
                        <td key={el} className="cmt-td">
                          <ScorePicker
                            value={role.adkar[el]}
                            min={1}
                            max={5}
                            colorFor={adkarCellColor}
                            onChange={(v) => saveAdkar.mutate({ id: role.id, responses: { [adkarItemKey(el)]: v } })}
                          />
                        </td>
                      ))}
                      <td className="cmt-td">
                        <BarrierBadge barrier={role.computed.barrierPoint} />
                      </td>
                      <td className="cmt-td">
                        <TextArea
                          rows={1}
                          value={role.activationTactics}
                          onSave={(v) => update.mutate({ id: role.id, fields: { activationTactics: v } })}
                        />
                      </td>
                      <td className="cmt-td">
                        <button
                          className="cmt-btn-danger"
                          onClick={() => {
                            if (confirm('Delete this role?')) remove.mutate(role.id);
                          }}
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                  {rosterRoles.length === 0 && (
                    <tr>
                      <td colSpan={14} className="cmt-td py-6 text-center text-slate-400">
                        No roles in this roster yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}
    </div>
  );
}
