import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ADKAR_ELEMENTS, ADKAR_LABELS, PCT_ASPECT_KEYS, PCT_ASPECT_LABELS, overallRealization } from '@cmt/domain';
import { api } from '../../lib/api';
import type { DashboardDto, ProjectHealthDto } from '../../lib/types';
import { BandChip, RiskBadge } from '../../ui/scores';
import { MultiSelect } from '../../ui/MultiSelect';
import { SaturationHeatmap } from './SaturationHeatmap';

function Stat(props: { label: string; value: number; alert?: boolean }) {
  return (
    <div className="cmt-card flex-1 text-center">
      <div className={`text-3xl font-bold ${props.alert && props.value > 0 ? 'text-red-600' : 'text-indigo-700'}`}>
        {props.value}
      </div>
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{props.label}</div>
    </div>
  );
}

const pctText = (v: number | null) => (v == null ? '—' : `${Math.round(v)}%`);

function PercentStat(props: { label: string; value: number | null }) {
  return (
    <div className="cmt-card flex-1 text-center">
      <div className="text-3xl font-bold text-indigo-700">{props.value == null ? '—' : `${Math.round(props.value)}%`}</div>
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{props.label}</div>
    </div>
  );
}

/** Baseline→target realization bar reused on each portfolio project card. */
function RealizationBar(props: { pct: number | null }) {
  const width = props.pct == null ? 0 : Math.min(100, Math.max(0, props.pct));
  const band = props.pct == null ? 'bg-slate-300' : props.pct >= 100 ? 'bg-green-500' : props.pct >= 50 ? 'bg-indigo-500' : 'bg-amber-500';
  return (
    <span className="inline-flex items-center gap-1.5 align-middle">
      <span className="inline-block h-2 w-16 overflow-hidden rounded bg-slate-200">
        <span className={`block h-full rounded ${band}`} style={{ width: `${width}%` }} />
      </span>
      <span className="tabular-nums">{props.pct == null ? '—' : `${Math.round(props.pct)}%`}</span>
    </span>
  );
}

function BarrierBar(props: { distribution: Record<string, number> }) {
  const entries = ADKAR_ELEMENTS.map((el) => ({
    label: ADKAR_LABELS[el],
    count: props.distribution[ADKAR_LABELS[el]] ?? 0,
  }));
  const noBarrier = props.distribution['No barrier'] ?? 0;
  const total = entries.reduce((a, b) => a + b.count, 0) + noBarrier;
  if (total === 0) return <span className="text-xs text-slate-400">No ADKAR data</span>;
  return (
    <div className="flex items-center gap-1">
      {entries.map(
        (e) =>
          e.count > 0 && (
            <span
              key={e.label}
              title={`${e.label}: ${e.count} group(s) at barrier`}
              className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-800"
            >
              {e.label.slice(0, 1)} {e.count}
            </span>
          ),
      )}
      {noBarrier > 0 && (
        <span
          title={`No barrier: ${noBarrier} group(s)`}
          className="rounded bg-green-100 px-1.5 py-0.5 text-[10px] font-semibold text-green-800"
        >
          ✓ {noBarrier}
        </span>
      )}
    </div>
  );
}

function ProjectCard({ health }: { health: ProjectHealthDto }) {
  return (
    <div className="cmt-card">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            to={`/projects/${health.projectId}/settings`}
            className="text-base font-semibold text-indigo-700 hover:underline"
          >
            {health.name}
          </Link>
          <p className="text-xs text-slate-500">
            {health.projectType ?? 'No type'} · {health.pmApproach ?? 'No approach'}
          </p>
        </div>
        <RiskBadge quadrant={health.risk?.quadrant} />
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {PCT_ASPECT_KEYS.map((k) => (
          <BandChip key={k} label={PCT_ASPECT_LABELS[k].split('/')[0]!} score={health.pct?.scores[k]} />
        ))}
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs md:grid-cols-3">
        <div>
          <dt className="font-semibold text-slate-500">Impacted groups</dt>
          <dd>
            {health.groupCount} group{health.groupCount === 1 ? '' : 's'} · {health.totalPeople} people
          </dd>
        </div>
        <div>
          <dt className="font-semibold text-slate-500">Avg degree of impact</dt>
          <dd>{health.avgDegreeOfImpact != null ? health.avgDegreeOfImpact.toFixed(1) : '—'} / 5</dd>
        </div>
        <div>
          <dt className="font-semibold text-slate-500">Barrier points</dt>
          <dd>
            <BarrierBar distribution={health.barrierDistribution} />
          </dd>
        </div>
        <div>
          <dt className="font-semibold text-slate-500">Activity progress</dt>
          <dd className="flex items-center gap-2">
            {health.progress.percentComplete != null ? (
              <>
                <span className="inline-block h-2 w-20 overflow-hidden rounded bg-slate-200 align-middle">
                  <span
                    className="block h-full bg-indigo-600"
                    style={{ width: `${health.progress.percentComplete}%` }}
                  />
                </span>
                {health.progress.percentComplete}% ({health.progress.completed}/{health.progress.total})
              </>
            ) : (
              'No activities'
            )}
            {health.overdueCount > 0 && (
              <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-800">
                {health.overdueCount} overdue
              </span>
            )}
          </dd>
        </div>
        <div>
          <dt className="font-semibold text-slate-500">Benefit realized</dt>
          <dd>
            {health.outcomes.metricCount === 0 ? (
              <span className="text-slate-400">No outcome metrics</span>
            ) : (
              <span className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
                <RealizationBar pct={health.outcomes.realization} />
                <span className="text-[11px] text-slate-400">
                  {`adoption ${pctText(health.outcomes.adoption)} · benefit ${pctText(health.outcomes.benefit)}`}
                </span>
              </span>
            )}
          </dd>
        </div>
        <div>
          <dt className="font-semibold text-slate-500">CM performance</dt>
          <dd>{health.latestCmPerfStatus ?? '—'}</dd>
        </div>
        <div>
          <dt className="font-semibold text-slate-500">Next milestone</dt>
          <dd>
            {health.nextMilestone ? `${health.nextMilestone.label} — ${health.nextMilestone.date}` : '—'}
          </dd>
        </div>
      </dl>
    </div>
  );
}

export function DashboardPage() {
  const { data } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api.get<DashboardDto>('/api/dashboard'),
  });
  // Empty = watch all; otherwise scope the whole dashboard to these projects.
  const [selected, setSelected] = useState<string[]>([]);

  if (!data) return null;

  const visible = selected.length === 0 ? data.projects : data.projects.filter((p) => selected.includes(p.projectId));
  const summary = {
    totalProjects: visible.length,
    highRiskCount: visible.filter((p) => p.risk?.quadrant === 'High').length,
    overdueActivities: visible.reduce((a, p) => a + p.overdueCount, 0),
    checksDueSoon: visible.reduce((a, p) => a + p.checksDueSoon, 0),
    avgRealization: overallRealization(visible.map((p) => p.outcomes.realization)),
  };

  return (
    <div className="mx-auto max-w-5xl p-8">
      <header className="mb-4 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold">Portfolio Dashboard</h1>
          <p className="text-sm text-slate-500">Unified health view across active projects.</p>
        </div>
        <Link to="/" className="cmt-btn-secondary">
          ← All projects
        </Link>
      </header>

      <div className="mb-6 flex items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Watching</span>
        <div className="w-80">
          <MultiSelect
            options={data.projects.map((p) => ({ value: p.projectId, label: p.name }))}
            selected={selected}
            placeholder="All projects"
            onChange={setSelected}
          />
        </div>
        {selected.length > 0 && (
          <button className="text-xs font-medium text-indigo-600 hover:underline" onClick={() => setSelected([])}>
            Clear
          </button>
        )}
      </div>

      <div className="mb-6 flex gap-3">
        <Stat label="Projects" value={summary.totalProjects} />
        <Stat label="High-risk projects" value={summary.highRiskCount} alert />
        <Stat label="Overdue activities" value={summary.overdueActivities} alert />
        <Stat label="Checks due in 14 days" value={summary.checksDueSoon} />
        <PercentStat label="Avg benefit realized" value={summary.avgRealization} />
      </div>

      <div className="mb-6">
        <SaturationHeatmap projectIds={selected.length === 0 ? undefined : selected} />
      </div>

      {visible.length === 0 ? (
        <div className="cmt-card py-12 text-center text-sm text-slate-500">
          {data.projects.length === 0 ? (
            <>
              No active projects. <Link to="/" className="text-indigo-600 hover:underline">Create one</Link> to see it here.
            </>
          ) : (
            'No projects match the current filter.'
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {visible.map((p) => (
            <ProjectCard key={p.projectId} health={p} />
          ))}
        </div>
      )}
    </div>
  );
}
