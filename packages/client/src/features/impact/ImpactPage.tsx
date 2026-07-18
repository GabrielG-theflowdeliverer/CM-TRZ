import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ADKAR_ELEMENTS, ADKAR_SHORT } from '@cmt/domain';
import type { GroupDto } from '../../lib/types';
import { useProject } from '../../app/ProjectLayout';
import { useGroupMutations, useGroups } from './useGroups';
import { BarrierBadge, HeatCell, adkarCellColor, impactCellColor } from '../../ui/scores';
import { NumberField } from '../../ui/controls';

/** Yesterday/Tomorrow status: has the change impact assessment been started/finished? */
function ytStatus(group: GroupDto): { label: string; className: string } {
  const filled = group.aspects.filter((a) => a.impact != null || a.yesterday || a.tomorrow).length;
  if (filled === 0) return { label: 'Not Started', className: 'bg-slate-100 text-slate-500' };
  if (filled >= 10) return { label: 'Complete', className: 'bg-green-100 text-green-800' };
  return { label: 'In Progress', className: 'bg-amber-100 text-amber-800' };
}

export function ImpactPage() {
  const { projectId } = useProject();
  const { data: groups } = useGroups(projectId);
  const { create, update, remove } = useGroupMutations(projectId);
  const [name, setName] = useState('');

  return (
    <div className="max-w-5xl space-y-4">
      <div>
        <h2 className="text-xl font-bold">Define Impact</h2>
        <p className="text-sm text-slate-500">
          Define impacted groups and assess change impact for your project (Phase 1 — Prepare Approach).
        </p>
      </div>

      <form
        className="flex max-w-md gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) create.mutate(name.trim());
          setName('');
        }}
      >
        <input
          className="cmt-input"
          placeholder="Add impacted group…"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button className="cmt-btn" disabled={!name.trim()}>
          Add group
        </button>
      </form>

      <div className="cmt-card overflow-x-auto">
        <table className="w-full min-w-[760px]">
          <thead>
            <tr>
              <th className="cmt-th w-8">#</th>
              <th className="cmt-th">Impacted Group Name</th>
              <th className="cmt-th w-24">People</th>
              <th className="cmt-th w-28">Y/T Status</th>
              <th className="cmt-th w-20">Aspects Impacted</th>
              <th className="cmt-th w-20">Degree of Impact</th>
              {ADKAR_ELEMENTS.map((el) => (
                <th key={el} className="cmt-th w-10 text-center" title={el}>
                  {ADKAR_SHORT[el]}
                </th>
              ))}
              <th className="cmt-th">Barrier Point</th>
              <th className="cmt-th w-14"></th>
            </tr>
          </thead>
          <tbody>
            {(groups ?? []).map((group, i) => (
              <tr key={group.id}>
                <td className="cmt-td text-slate-400">{i + 1}</td>
                <td className="cmt-td">
                  <Link
                    to={`/projects/${projectId}/impact/${group.id}`}
                    className="font-medium text-indigo-700 hover:underline"
                  >
                    {group.name}
                  </Link>
                  {group.tags.length > 0 && (
                    <span className="ml-2 space-x-1">
                      {group.tags.map((t) => (
                        <span key={t} className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600">
                          {t}
                        </span>
                      ))}
                    </span>
                  )}
                </td>
                <td className="cmt-td">
                  <NumberField
                    value={group.numPeople}
                    min={0}
                    onSave={(v) => update.mutate({ id: group.id, fields: { numPeople: v } })}
                  />
                </td>
                <td className="cmt-td">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${ytStatus(group).className}`}>
                    {ytStatus(group).label}
                  </span>
                </td>
                <td className="cmt-td text-center">
                  <HeatCell value={group.computed.aspectsImpacted || null} colorFor={() => 'bg-slate-200 text-slate-700'} />
                </td>
                <td className="cmt-td text-center">
                  <HeatCell value={group.computed.degreeOfImpact} colorFor={impactCellColor} />
                </td>
                {ADKAR_ELEMENTS.map((el) => (
                  <td key={el} className="cmt-td text-center">
                    <HeatCell value={group.adkar[el]} colorFor={adkarCellColor} />
                  </td>
                ))}
                <td className="cmt-td">
                  <BarrierBadge barrier={group.computed.barrierPoint} />
                </td>
                <td className="cmt-td text-right">
                  <button
                    className="cmt-btn-danger"
                    onClick={() => {
                      if (confirm(`Delete group "${group.name}"?`)) remove.mutate(group.id);
                    }}
                  >
                    ✕
                  </button>
                </td>
              </tr>
            ))}
            {(groups ?? []).length === 0 && (
              <tr>
                <td colSpan={13} className="cmt-td py-8 text-center text-slate-400">
                  No impacted groups yet — add the teams, departments or roles affected by this change.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-400">
        Open a group to define adoption & usage, score the 10 Aspects of Change Impact and run its ADKAR assessment.
      </p>
    </div>
  );
}
