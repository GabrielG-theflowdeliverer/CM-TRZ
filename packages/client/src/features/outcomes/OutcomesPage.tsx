import { useState } from 'react';
import { Line, LineChart, ResponsiveContainer, Tooltip } from 'recharts';
import {
  ADOPTION_MEASURES,
  ADOPTION_MEASURE_LABELS,
  METRIC_DIRECTIONS,
  OBJECTIVE_LEVELS,
  type AdoptionMeasure,
} from '@cmt/domain';
import type { GroupDto } from '../../lib/types';
import { useProject } from '../../app/ProjectLayout';
import { useGroups } from '../impact/useGroups';
import { useOutcomeMutations, useOutcomes, type MetricDto, type ObjectiveDto } from './useOutcomes';
import { CorrelationPanel } from './CorrelationPanel';

const LEVEL_LABELS: Record<string, string> = {
  organization: 'Organizational',
  initiative: 'Initiative',
  individual: 'Individual',
};

function pctLabel(pct: number | null): string {
  return pct === null ? '—' : `${Math.round(pct)}%`;
}
function bandClass(pct: number | null): string {
  if (pct === null) return 'bg-slate-300';
  if (pct >= 100) return 'bg-green-500';
  if (pct >= 50) return 'bg-indigo-500';
  return 'bg-amber-500';
}

function RealizationBar({ pct }: { pct: number | null }) {
  const width = pct === null ? 0 : Math.min(100, Math.max(0, pct));
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-32 overflow-hidden rounded bg-slate-200">
        <div className={`h-full rounded ${bandClass(pct)}`} style={{ width: `${width}%` }} />
      </div>
      <span className="w-10 text-xs font-semibold tabular-nums text-slate-600">{pctLabel(pct)}</span>
    </div>
  );
}

export function OutcomesPage() {
  const { projectId } = useProject();
  const { data } = useOutcomes(projectId);
  const { data: groups } = useGroups(projectId);
  const m = useOutcomeMutations(projectId);
  const [level, setLevel] = useState<string>('organization');
  const [statement, setStatement] = useState('');

  if (!data) return null;

  return (
    <div className="max-w-4xl space-y-4">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-xl font-bold">Outcomes</h2>
          <p className="text-sm text-slate-500">
            Define success, attach adoption & benefit metrics, and log measurements — realization is recomputed
            from your readings.
          </p>
        </div>
        <div className="text-right">
          <div className="text-3xl font-bold text-indigo-700">{pctLabel(data.realization)}</div>
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">of success realized</div>
        </div>
      </div>

      <form
        className="cmt-card flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (statement.trim()) {
            m.createObjective.mutate({ level, statement: statement.trim() }, { onSuccess: () => setStatement('') });
          }
        }}
      >
        <div>
          <label className="cmt-label">Level</label>
          <select className="cmt-input w-40" value={level} onChange={(e) => setLevel(e.target.value)}>
            {OBJECTIVE_LEVELS.map((l) => (
              <option key={l} value={l}>
                {LEVEL_LABELS[l]}
              </option>
            ))}
          </select>
        </div>
        <div className="flex-1">
          <label className="cmt-label">Success objective</label>
          <input
            className="cmt-input w-full"
            placeholder="e.g. Cut average handling time by 30%"
            value={statement}
            onChange={(e) => setStatement(e.target.value)}
          />
        </div>
        <button type="submit" className="cmt-btn" disabled={!statement.trim() || m.createObjective.isPending}>
          Add objective
        </button>
      </form>

      {data.objectives.length === 0 && (
        <div className="cmt-card py-10 text-center text-sm text-slate-400">
          No success objectives yet — define what success looks like, then attach measurable metrics.
        </div>
      )}

      {data.objectives.map((objective) => (
        <ObjectiveCard key={objective.id} objective={objective} groups={groups ?? []} m={m} />
      ))}

      {data.objectives.length > 0 && <CorrelationPanel objectives={data.objectives} groups={groups ?? []} />}
    </div>
  );
}

function ObjectiveCard({
  objective,
  groups,
  m,
}: {
  objective: ObjectiveDto;
  groups: GroupDto[];
  m: ReturnType<typeof useOutcomeMutations>;
}) {
  const [adding, setAdding] = useState(false);
  return (
    <section className="cmt-card space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-slate-500">
            {LEVEL_LABELS[objective.level]}
          </span>
          <h3 className="mt-1 font-semibold">{objective.statement}</h3>
        </div>
        <div className="flex items-center gap-3">
          <RealizationBar pct={objective.realization} />
          <button
            className="cmt-btn-danger text-xs"
            onClick={() => {
              if (confirm('Delete this objective and its metrics?')) m.deleteObjective.mutate(objective.id);
            }}
          >
            ✕
          </button>
        </div>
      </div>

      {objective.metrics.length === 0 ? (
        <p className="text-sm text-slate-400">No metrics yet.</p>
      ) : (
        <div className="space-y-2">
          {objective.metrics.map((metric) => (
            <MetricRow key={metric.id} metric={metric} m={m} />
          ))}
        </div>
      )}

      {adding ? (
        <AddMetricForm
          objectiveId={objective.id}
          groups={groups}
          onDone={() => setAdding(false)}
          m={m}
        />
      ) : (
        <button className="cmt-btn-secondary text-xs" onClick={() => setAdding(true)}>
          + Add metric
        </button>
      )}
    </section>
  );
}

function MetricRow({ metric, m }: { metric: MetricDto; m: ReturnType<typeof useOutcomeMutations> }) {
  const [date, setDate] = useState('');
  const [value, setValue] = useState('');
  const trend = metric.measurements.map((x) => ({ date: x.date, value: x.value }));

  return (
    <div className="rounded border border-slate-100 p-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
              metric.kind === 'adoption' ? 'bg-sky-100 text-sky-800' : 'bg-emerald-100 text-emerald-800'
            }`}
          >
            {metric.kind}
          </span>
          <span className="text-sm font-medium">{metric.name}</span>
          {metric.adoptionMeasure && (
            <span className="text-xs text-slate-400">{ADOPTION_MEASURE_LABELS[metric.adoptionMeasure]}</span>
          )}
        </div>
        <RealizationBar pct={metric.computed.pct} />
      </div>

      <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-slate-500">
        <span>
          baseline {metric.baseline ?? '—'} → current <strong>{metric.computed.current ?? '—'}</strong> → target{' '}
          {metric.target ?? '—'} {metric.unit ?? ''}
        </span>
        {trend.length >= 2 && (
          <div className="h-8 w-28">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend}>
                <Tooltip formatter={(v: number) => [v, 'value']} labelFormatter={(l) => String(l)} />
                <Line type="monotone" dataKey="value" stroke="#4f46e5" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
        <form
          className="ml-auto flex items-center gap-1"
          onSubmit={(e) => {
            e.preventDefault();
            if (date && value !== '') {
              m.addMeasurement.mutate(
                { metricId: metric.id, date, value: Number(value) },
                { onSuccess: () => { setDate(''); setValue(''); } },
              );
            }
          }}
        >
          <input type="date" className="cmt-input py-0.5 text-xs" value={date} onChange={(e) => setDate(e.target.value)} />
          <input
            type="number"
            step="any"
            className="cmt-input w-20 py-0.5 text-xs"
            placeholder="value"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
          <button type="submit" className="cmt-btn-secondary text-xs" disabled={!date || value === ''}>
            Log
          </button>
          <button type="button" className="cmt-btn-danger text-xs" onClick={() => m.deleteMetric.mutate(metric.id)}>
            ✕
          </button>
        </form>
      </div>
    </div>
  );
}

function AddMetricForm({
  objectiveId,
  groups,
  onDone,
  m,
}: {
  objectiveId: string;
  groups: GroupDto[];
  onDone: () => void;
  m: ReturnType<typeof useOutcomeMutations>;
}) {
  const [kind, setKind] = useState<'adoption' | 'benefit'>('benefit');
  const [name, setName] = useState('');
  const [unit, setUnit] = useState('');
  const [baseline, setBaseline] = useState('');
  const [target, setTarget] = useState('');
  const [direction, setDirection] = useState<'increase' | 'decrease'>('increase');
  const [adoptionMeasure, setAdoptionMeasure] = useState<AdoptionMeasure>('utilization');
  const [groupId, setGroupId] = useState('');

  const num = (s: string) => (s === '' ? null : Number(s));

  return (
    <form
      className="grid gap-2 rounded border border-slate-200 bg-slate-50 p-3 md:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim()) return;
        m.createMetric.mutate(
          {
            objectiveId,
            kind,
            name: name.trim(),
            unit: unit || null,
            baseline: num(baseline),
            target: num(target),
            direction,
            ...(kind === 'adoption' ? { adoptionMeasure, groupId: groupId || null } : {}),
          },
          { onSuccess: onDone },
        );
      }}
    >
      <select className="cmt-input" value={kind} onChange={(e) => setKind(e.target.value as 'adoption' | 'benefit')}>
        <option value="benefit">Benefit metric</option>
        <option value="adoption">Adoption metric</option>
      </select>
      <input className="cmt-input" placeholder="Metric name" value={name} onChange={(e) => setName(e.target.value)} />
      <input className="cmt-input" placeholder="Unit (e.g. min, %)" value={unit} onChange={(e) => setUnit(e.target.value)} />
      <select className="cmt-input" value={direction} onChange={(e) => setDirection(e.target.value as 'increase' | 'decrease')}>
        {METRIC_DIRECTIONS.map((d) => (
          <option key={d} value={d}>
            {d === 'increase' ? 'Higher is better' : 'Lower is better'}
          </option>
        ))}
      </select>
      <input className="cmt-input" type="number" step="any" placeholder="Baseline" value={baseline} onChange={(e) => setBaseline(e.target.value)} />
      <input className="cmt-input" type="number" step="any" placeholder="Target" value={target} onChange={(e) => setTarget(e.target.value)} />
      {kind === 'adoption' && (
        <>
          <select className="cmt-input" value={adoptionMeasure} onChange={(e) => setAdoptionMeasure(e.target.value as AdoptionMeasure)}>
            {ADOPTION_MEASURES.map((a) => (
              <option key={a} value={a}>
                {ADOPTION_MEASURE_LABELS[a]}
              </option>
            ))}
          </select>
          <select className="cmt-input" value={groupId} onChange={(e) => setGroupId(e.target.value)}>
            <option value="">All / no group</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </>
      )}
      <div className="flex gap-2 md:col-span-2">
        <button type="submit" className="cmt-btn" disabled={!name.trim() || m.createMetric.isPending}>
          Add metric
        </button>
        <button type="button" className="cmt-btn-secondary" onClick={onDone}>
          Cancel
        </button>
      </div>
    </form>
  );
}
