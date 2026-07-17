import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useProject } from '../../app/ProjectLayout';
import { useBlueprintMutations, useBlueprints } from './useBlueprints';
import { useGroups } from '../impact/useGroups';

export function BlueprintsPage() {
  const { projectId } = useProject();
  const { data: blueprints } = useBlueprints(projectId);
  const { data: groups } = useGroups(projectId);
  const { create, remove } = useBlueprintMutations(projectId);
  const [name, setName] = useState('');
  const [scope, setScope] = useState<string>('custom');

  const scopeLabel = (b: { scopeKind: string; groupName: string | null }) =>
    b.scopeKind === 'overall' ? 'Overall' : b.scopeKind === 'group' ? `Group: ${b.groupName ?? '(deleted group)'}` : 'Custom';

  return (
    <div className="max-w-4xl space-y-4">
      <div>
        <h2 className="text-xl font-bold">ADKAR Blueprints</h2>
        <p className="text-sm text-slate-500">
          Phase 2 — Manage Change. Create as many blueprints as you need: an overall one, one per impacted group, or
          custom (e.g. per release). Save snapshots to keep versions.
        </p>
      </div>

      <div className="cmt-card">
        <form
          className="flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim()) return;
            const groupId = scope.startsWith('group:') ? scope.slice(6) : null;
            create.mutate({
              scopeKind: groupId ? 'group' : (scope as 'overall' | 'custom'),
              groupId,
              name: name.trim(),
            });
            setName('');
          }}
        >
          <select className="cmt-input w-56" value={scope} onChange={(e) => setScope(e.target.value)}>
            <option value="custom">Custom scope</option>
            <option value="overall">Overall</option>
            {(groups ?? []).map((g) => (
              <option key={g.id} value={`group:${g.id}`}>
                Group: {g.name}
              </option>
            ))}
          </select>
          <input
            className="cmt-input flex-1"
            placeholder="Blueprint name…"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <button className="cmt-btn" disabled={!name.trim() || create.isPending}>
            Create blueprint
          </button>
        </form>
      </div>

      <div className="cmt-card">
        <table className="w-full">
          <thead>
            <tr>
              <th className="cmt-th">Blueprint</th>
              <th className="cmt-th">Scope</th>
              <th className="cmt-th">Activities</th>
              <th className="cmt-th">Updated</th>
              <th className="cmt-th w-14"></th>
            </tr>
          </thead>
          <tbody>
            {(blueprints ?? []).map((b) => (
              <tr key={b.id}>
                <td className="cmt-td">
                  <Link
                    to={`/projects/${projectId}/blueprints/${b.id}`}
                    className="font-medium text-indigo-700 hover:underline"
                  >
                    {b.name}
                  </Link>
                </td>
                <td className="cmt-td text-xs text-slate-500">{scopeLabel(b)}</td>
                <td className="cmt-td text-xs text-slate-500">{b.activities.length}</td>
                <td className="cmt-td text-xs text-slate-500">{b.updatedAt.slice(0, 10)}</td>
                <td className="cmt-td text-right">
                  <button
                    className="cmt-btn-danger"
                    onClick={() => {
                      if (confirm(`Delete blueprint "${b.name}" and its activities/snapshots?`)) remove.mutate(b.id);
                    }}
                  >
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
