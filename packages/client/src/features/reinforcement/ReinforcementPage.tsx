import { useState } from 'react';
import { ACTIVITY_STATUSES, type ReinforcementAction } from '@cmt/domain';
import type { GroupDto } from '../../lib/types';
import { useProject } from '../../app/ProjectLayout';
import { useGroups } from '../impact/useGroups';
import { useOutcomes, type ObjectiveDto } from '../outcomes/useOutcomes';
import { BarrierBadge } from '../../ui/scores';
import { Select, TextField } from '../../ui/controls';
import { useReinforcement, useReinforcementMutations } from './useReinforcement';

/** Mean adoption realization per group, from the outcomes tree. */
function adoptionByGroup(objectives: ObjectiveDto[]): Map<string, number> {
  const buckets = new Map<string, number[]>();
  for (const o of objectives) {
    for (const metric of o.metrics) {
      if (metric.kind === 'adoption' && metric.groupId && metric.computed.pct !== null) {
        (buckets.get(metric.groupId) ?? buckets.set(metric.groupId, []).get(metric.groupId)!).push(metric.computed.pct);
      }
    }
  }
  return new Map([...buckets].map(([id, pcts]) => [id, pcts.reduce((a, b) => a + b, 0) / pcts.length]));
}

type Mutations = ReturnType<typeof useReinforcementMutations>;

export function ReinforcementPage() {
  const { projectId } = useProject();
  const { data: groups } = useGroups(projectId);
  const { data: outcomes } = useOutcomes(projectId);
  const { data: actions } = useReinforcement(projectId);
  const m = useReinforcementMutations(projectId);

  if (!groups || !actions) return null;
  const adoption = adoptionByGroup(outcomes?.objectives ?? []);
  const actionsFor = (groupId: string | null) => actions.filter((a) => a.groupId === groupId);

  return (
    <div className="max-w-4xl space-y-4">
      <div>
        <h2 className="text-xl font-bold">Reinforcement</h2>
        <p className="text-sm text-slate-500">
          Sustain the change (Phase 3): plan reinforcement mechanisms where ADKAR readiness or adoption is weakest.
          Corrective analysis lives in Adapt Actions.
        </p>
      </div>

      {groups.map((group) => (
        <GroupReinforcement
          key={group.id}
          group={group}
          adoption={adoption.get(group.id) ?? null}
          actions={actionsFor(group.id)}
          m={m}
        />
      ))}

      <ActionSection
        title="Project-wide reinforcement"
        subtitle="Sustainment actions that aren’t tied to a single group."
        groupId={null}
        actions={actionsFor(null)}
        m={m}
      />
    </div>
  );
}

function GroupReinforcement({
  group,
  adoption,
  actions,
  m,
}: {
  group: GroupDto;
  adoption: number | null;
  actions: ReinforcementAction[];
  m: Mutations;
}) {
  const reinforcementScore = group.adkar['reinforcement'] ?? null;
  const needs =
    group.computed.barrierPoint === 'Reinforcement' ||
    (reinforcementScore !== null && reinforcementScore <= 3) ||
    (adoption !== null && adoption < 50);

  return (
    <ActionSection
      title={group.name}
      groupId={group.id}
      actions={actions}
      m={m}
      badges={
        <span className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <span>
            Reinforcement (ADKAR R): <strong>{reinforcementScore ?? '—'}</strong>
          </span>
          <BarrierBadge barrier={group.computed.barrierPoint} />
          <span>adoption {adoption === null ? '—' : `${Math.round(adoption)}%`}</span>
          {needs && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 font-semibold text-amber-800">Needs reinforcement</span>
          )}
        </span>
      }
    />
  );
}

function ActionSection({
  title,
  subtitle,
  badges,
  groupId,
  actions,
  m,
}: {
  title: string;
  subtitle?: string;
  badges?: React.ReactNode;
  groupId: string | null;
  actions: ReinforcementAction[];
  m: Mutations;
}) {
  const [mechanism, setMechanism] = useState('');
  return (
    <section className="cmt-card space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-semibold">{title}</h3>
          {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
        </div>
        {badges}
      </div>

      {actions.length > 0 && (
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className="cmt-th text-left">Mechanism</th>
              <th className="cmt-th w-40">Owner</th>
              <th className="cmt-th w-36">Status</th>
              <th className="cmt-th w-10"></th>
            </tr>
          </thead>
          <tbody>
            {actions.map((a) => (
              <tr key={a.id}>
                <td className="cmt-td">{a.mechanism}</td>
                <td className="cmt-td">
                  <TextField value={a.owner} placeholder="Owner" onSave={(v) => m.update.mutate({ id: a.id, fields: { owner: v } })} />
                </td>
                <td className="cmt-td">
                  <Select
                    value={a.status}
                    options={ACTIVITY_STATUSES}
                    onSave={(v) => m.update.mutate({ id: a.id, fields: { status: v } })}
                  />
                </td>
                <td className="cmt-td text-right">
                  <button className="cmt-btn-danger" onClick={() => m.remove.mutate(a.id)}>
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (mechanism.trim()) {
            m.create.mutate({ groupId, mechanism: mechanism.trim() }, { onSuccess: () => setMechanism('') });
          }
        }}
      >
        <input
          className="cmt-input flex-1"
          placeholder="Add a reinforcement mechanism (e.g. recognise wins, coaching, accountability)…"
          value={mechanism}
          onChange={(e) => setMechanism(e.target.value)}
        />
        <button type="submit" className="cmt-btn" disabled={!mechanism.trim() || m.create.isPending}>
          Add
        </button>
      </form>
    </section>
  );
}
