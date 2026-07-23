import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ADKAR_ELEMENTS, ADKAR_LABELS, ADKAR_TACTICS, GAUGE_GAPS } from '@cmt/domain';
import { useProject } from '../../app/ProjectLayout';
import { useBlueprint, useBlueprintMutations, useSnapshots } from './useBlueprints';
import { useBlueprints } from './useBlueprints';
import { useRoles } from '../roles/useRoles';
import { useGroups } from '../impact/useGroups';
import { usePlans } from '../plans/usePlans';
import { useActivityMutations } from '../activities/useActivities';
import { ActivityTable, type ActivityTableContext } from '../activities/ActivityTable';
import { DateInput, Select } from '../../ui/controls';

interface SnapshotActivity {
  name: string | null;
  adkarOutcomes?: string[];
  element?: string; // pre-unification snapshots
  startDate: string | null;
  finishDate: string | null;
  status: string | null;
}

export function BlueprintDetailPage() {
  const { projectId } = useProject();
  const { blueprintId = '' } = useParams();
  const { data: blueprint } = useBlueprint(projectId, blueprintId);
  const { data: snapshots } = useSnapshots(blueprintId);
  const { data: groups } = useGroups(projectId);
  const { data: plans } = usePlans(projectId);
  const { data: blueprints } = useBlueprints(projectId);
  const { data: roles } = useRoles(projectId);
  const mutations = useBlueprintMutations(projectId, blueprintId);
  const activityMutations = useActivityMutations(projectId);
  const [tacticsFor, setTacticsFor] = useState<string | null>(null);
  const [snapshotOpen, setSnapshotOpen] = useState(false);
  const [viewSnapshot, setViewSnapshot] = useState<string | null>(null);

  if (!blueprint) return null;
  const elementByKey = new Map(blueprint.elements.map((e) => [e.element, e]));
  const snapshot = (snapshots ?? []).find((s) => s.id === viewSnapshot) as
    | { id: string; label: string; takenAt: string; payload: { activities: SnapshotActivity[] } }
    | undefined;

  const ctx: ActivityTableContext = {
    groups: groups ?? [],
    plans: plans ?? [],
    blueprints: blueprints ?? [],
    roles: roles ?? [],
    onUpdate: (id, fields) => activityMutations.update.mutate({ id, fields }),
    onDelete: (id) => activityMutations.remove.mutate(id),
  };

  const unassigned = blueprint.activities.filter((a) => a.adkarOutcomes.length === 0);

  return (
    <div className="max-w-full space-y-4">
      <div className="flex items-end justify-between">
        <div>
          <Link to={`/projects/${projectId}/blueprints`} className="text-xs font-semibold text-indigo-600 hover:underline">
            ← All blueprints
          </Link>
          <h2 className="text-xl font-bold">ADKAR Blueprint — {blueprint.name}</h2>
          <p className="text-xs text-slate-500">
            {blueprint.scopeKind === 'group'
              ? `Group: ${blueprint.groupName ?? '(deleted group)'}`
              : blueprint.scopeKind === 'overall'
                ? 'Overall'
                : 'Custom scope'}
            {' · '}Milestone target dates default from the Roadmap; override per element as needed.
          </p>
        </div>
        <button className="cmt-btn-secondary" onClick={() => setSnapshotOpen(!snapshotOpen)}>
          Snapshots ({(snapshots ?? []).length})
        </button>
      </div>

      {snapshotOpen && (
        <div className="cmt-card">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="font-semibold">Saved versions</h3>
            <button
              className="cmt-btn"
              onClick={() => {
                const label = prompt('Snapshot label (e.g. "Baseline v1"):');
                if (label?.trim()) mutations.takeSnapshot.mutate({ id: blueprint.id, label: label.trim() });
              }}
            >
              Take snapshot
            </button>
          </div>
          {(snapshots ?? []).length === 0 ? (
            <p className="text-sm text-slate-400">No snapshots yet — take one to freeze the current state.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {(snapshots ?? []).map((s) => (
                <li key={s.id} className="flex items-center justify-between py-1.5 text-sm">
                  <span>
                    <strong>{s.label}</strong>
                    <span className="ml-2 text-xs text-slate-400">{s.takenAt.slice(0, 16).replace('T', ' ')}</span>
                  </span>
                  <span className="flex gap-1.5">
                    <button
                      className="cmt-btn-secondary"
                      onClick={() => setViewSnapshot(viewSnapshot === s.id ? null : s.id)}
                    >
                      {viewSnapshot === s.id ? 'Hide' : 'View'}
                    </button>
                    <button
                      className="cmt-btn-danger"
                      onClick={() => {
                        if (confirm('Delete this snapshot?')) mutations.deleteSnapshot.mutate(s.id);
                      }}
                    >
                      ✕
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}
          {snapshot && (
            <div className="mt-3 rounded border border-slate-200 bg-slate-50 p-3">
              <h4 className="mb-1 text-sm font-semibold">
                Snapshot “{snapshot.label}” — {snapshot.payload.activities.length} activities
              </h4>
              <table className="w-full text-xs">
                <thead>
                  <tr>
                    <th className="cmt-th">ADKAR</th>
                    <th className="cmt-th">Activity</th>
                    <th className="cmt-th">Start</th>
                    <th className="cmt-th">Finish</th>
                    <th className="cmt-th">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {snapshot.payload.activities.map((a, i) => (
                    <tr key={i}>
                      <td className="cmt-td capitalize">{a.element ?? a.adkarOutcomes?.join(', ')}</td>
                      <td className="cmt-td">{a.name}</td>
                      <td className="cmt-td">{a.startDate}</td>
                      <td className="cmt-td">{a.finishDate}</td>
                      <td className="cmt-td">{a.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {ADKAR_ELEMENTS.map((element) => {
        const el = elementByKey.get(element);
        const milestone = blueprint.computed.milestones[element];
        const activities = blueprint.activities.filter((a) => a.adkarOutcomes.includes(element));
        return (
          <section key={element} className="cmt-card">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-lg font-bold text-indigo-800">{ADKAR_LABELS[element]}</h3>
              <div className="flex items-center gap-3 text-sm">
                <label className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold uppercase text-slate-500">Milestone Target:</span>
                  <DateInput
                    value={el?.milestoneOverrideDate ?? milestone?.effectiveDate}
                    onSave={(v) =>
                      mutations.saveElement.mutate({ id: blueprint.id, element, fields: { milestoneOverrideDate: v } })
                    }
                  />
                  {milestone?.fromRoadmap && milestone.effectiveDate && (
                    <span className="text-[10px] text-slate-400">(from Roadmap)</span>
                  )}
                </label>
                <label className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold uppercase text-slate-500">Gauge Gap:</span>
                  <Select
                    value={el?.gaugeGap}
                    options={GAUGE_GAPS}
                    onSave={(v) => mutations.saveElement.mutate({ id: blueprint.id, element, fields: { gaugeGap: v } })}
                  />
                </label>
                <button className="cmt-btn-secondary" onClick={() => setTacticsFor(tacticsFor === element ? null : element)}>
                  Tactics
                </button>
                <button className="cmt-btn" onClick={() => mutations.addActivity.mutate({ id: blueprint.id, element })}>
                  Add activity
                </button>
              </div>
            </div>

            {tacticsFor === element && (
              <div className="mb-3 rounded border border-indigo-100 bg-indigo-50/50 p-3">
                <h4 className="mb-1 text-xs font-bold uppercase text-indigo-700">
                  {ADKAR_LABELS[element]} tactics (Prosci examples)
                </h4>
                <ul className="list-disc space-y-0.5 pl-4 text-xs text-slate-600">
                  {ADKAR_TACTICS[element].map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
              </div>
            )}

            <ActivityTable activities={activities} ctx={ctx} hideColumns={['blueprints', 'method', 'result']} />
          </section>
        );
      })}

      {unassigned.length > 0 && (
        <section className="cmt-card">
          <h3 className="mb-2 text-lg font-bold text-slate-500">No ADKAR outcome yet</h3>
          <ActivityTable activities={unassigned} ctx={ctx} hideColumns={['blueprints', 'method', 'result']} />
        </section>
      )}
    </div>
  );
}
