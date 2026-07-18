import { useState } from 'react';
import { Link } from 'react-router-dom';
import { EXTEND_PLAN_OPTIONS } from '@cmt/domain';
import type { PlanDto } from '../../lib/types';
import { useProject } from '../../app/ProjectLayout';
import { usePlans, usePlanMutations } from './usePlans';

function ProgressBar(props: { percent: number | null }) {
  if (props.percent == null) return <span className="text-xs text-slate-400">No activities</span>;
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-28 overflow-hidden rounded bg-slate-200">
        <div className="h-full bg-indigo-600" style={{ width: `${props.percent}%` }} />
      </div>
      <span className="text-xs text-slate-500">{props.percent}%</span>
    </div>
  );
}

export function PlansPage() {
  const { projectId } = useProject();
  const { data: plans } = usePlans(projectId);
  const [extendName, setExtendName] = useState('');

  const { create, remove } = usePlanMutations(projectId);

  const core = (plans ?? []).filter((p) => p.kind === 'core');
  const extend = (plans ?? []).filter((p) => p.kind === 'extend');

  const planRow = (plan: PlanDto) => (
    <tr key={plan.id}>
      <td className="cmt-td">
        <Link to={`/projects/${projectId}/plans/${plan.id}`} className="font-medium text-indigo-700 hover:underline">
          {plan.name}
        </Link>
      </td>
      <td className="cmt-td text-xs text-slate-500">{plan.planType ?? '—'}</td>
      <td className="cmt-td text-xs text-slate-500">{plan.activities.length}</td>
      <td className="cmt-td">
        <ProgressBar percent={plan.computed.progress.percentComplete} />
      </td>
      <td className="cmt-td text-xs text-slate-500">{plan.lastUpdated ?? '—'}</td>
      <td className="cmt-td text-right">
        {plan.kind === 'extend' && (
          <button
            className="cmt-btn-danger"
            onClick={() => {
              if (confirm(`Delete plan "${plan.name}"?`)) remove.mutate(plan.id);
            }}
          >
            ✕
          </button>
        )}
      </td>
    </tr>
  );

  const header = (
    <tr>
      <th className="cmt-th">Plan</th>
      <th className="cmt-th w-28">Type</th>
      <th className="cmt-th w-20">Activities</th>
      <th className="cmt-th w-44">Progress</th>
      <th className="cmt-th w-28">Last updated</th>
      <th className="cmt-th w-10"></th>
    </tr>
  );

  return (
    <div className="max-w-4xl space-y-4">
      <div>
        <h2 className="text-xl font-bold">Change Management Plans</h2>
        <p className="text-sm text-slate-500">
          Phase 2 — Manage Change. Core plans are always present; add extend plans as your strategy requires.
        </p>
      </div>

      <div className="cmt-card">
        <h3 className="mb-2 font-semibold">Core Plans</h3>
        <table className="w-full">
          <thead>{header}</thead>
          <tbody>{core.map(planRow)}</tbody>
        </table>
      </div>

      <div className="cmt-card">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="font-semibold">Extend Plans</h3>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (extendName.trim()) create.mutate(extendName.trim());
              setExtendName('');
            }}
          >
            <input
              className="cmt-input w-64"
              list="extend-plan-options"
              placeholder="Plan name (pick or type your own)…"
              value={extendName}
              onChange={(e) => setExtendName(e.target.value)}
            />
            <datalist id="extend-plan-options">
              {EXTEND_PLAN_OPTIONS.map((o) => (
                <option key={o} value={o} />
              ))}
            </datalist>
            <button className="cmt-btn" disabled={!extendName.trim()}>
              Add plan
            </button>
          </form>
        </div>
        {extend.length === 0 ? (
          <p className="text-sm text-slate-400">
            No extend plans yet. Common choices: {EXTEND_PLAN_OPTIONS.join(', ')}.
          </p>
        ) : (
          <table className="w-full">
            <thead>{header}</thead>
            <tbody>{extend.map(planRow)}</tbody>
          </table>
        )}
      </div>
    </div>
  );
}
