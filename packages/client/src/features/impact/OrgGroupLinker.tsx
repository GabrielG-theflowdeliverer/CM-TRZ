import type { GroupDto } from '../../lib/types';
import { useGroupMutations } from './useGroups';
import { useCreateOrgGroup, useOrgGroups } from './useOrgGroups';

/**
 * Link this project group to the real-world org group it represents, feeding
 * the portfolio saturation heatmap. Manual with a name-match suggestion —
 * never auto-matched, because a wrong merge silently corrupts the heatmap.
 */
export function OrgGroupLinker({ projectId, group }: { projectId: string; group: GroupDto }) {
  const { data: orgGroups } = useOrgGroups();
  const create = useCreateOrgGroup();
  const { update } = useGroupMutations(projectId);

  const link = (orgGroupId: string | null) => update.mutate({ id: group.id, fields: { orgGroupId } });
  const suggestion =
    group.orgGroupId === null
      ? orgGroups?.find((o) => o.name.trim().toLowerCase() === group.name.trim().toLowerCase())
      : undefined;

  return (
    <div>
      <label className="cmt-label">Organization group (for cross-project saturation)</label>
      <div className="flex items-center gap-2">
        <select
          className="cmt-input w-64"
          value={group.orgGroupId ?? ''}
          onChange={(e) => link(e.target.value === '' ? null : e.target.value)}
        >
          <option value="">Not linked</option>
          {(orgGroups ?? []).map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
        {suggestion && (
          <button type="button" className="cmt-btn-secondary" onClick={() => link(suggestion.id)}>
            Link to “{suggestion.name}”
          </button>
        )}
        {group.orgGroupId === null && !suggestion && (
          <button
            type="button"
            className="cmt-btn-secondary"
            disabled={create.isPending}
            onClick={() =>
              create.mutate(group.name, { onSuccess: (created) => link(created.id) })
            }
          >
            Create “{group.name}”
          </button>
        )}
      </div>
    </div>
  );
}
