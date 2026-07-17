import { useMemo } from 'react';
import {
  ADKAR_ELEMENTS,
  ADKAR_LABELS,
  ASSESSMENT_TYPE_LABELS,
  TRACKING_SCHEDULE_LABELS,
  type CmPerfReport,
  type TrackingSchedule,
} from '@cmt/domain';
import type { Activity, AssessmentDto, GroupDto, Roadmap, TrackingEntry } from '../../lib/types';

interface TimelineBar {
  label: string;
  start: string | null;
  finish: string | null;
  status: string | null;
}

interface TimelineGroup {
  title: string;
  bars: TimelineBar[];
}

interface Milestone {
  date: string;
  label: string;
}

const DAY = 86_400_000;

function t(date: string): number {
  return new Date(`${date}T00:00:00Z`).getTime();
}

function statusColor(bar: TimelineBar, today: string): string {
  if (bar.status === 'Completed') return 'bg-green-500';
  const overdue = bar.finish && bar.finish < today;
  if (overdue) return 'bg-red-500';
  if (bar.status === 'In Progress') return 'bg-indigo-500';
  return 'bg-slate-400';
}

function monthTicks(min: number, max: number): Array<{ time: number; label: string }> {
  const ticks: Array<{ time: number; label: string }> = [];
  const d = new Date(min);
  d.setUTCDate(1);
  d.setUTCHours(0, 0, 0, 0);
  while (d.getTime() <= max) {
    if (d.getTime() >= min) {
      ticks.push({
        time: d.getTime(),
        label: d.toLocaleDateString('en', { month: 'short', year: '2-digit', timeZone: 'UTC' }),
      });
    }
    d.setUTCMonth(d.getUTCMonth() + 1);
  }
  return ticks;
}

/** Gantt-like chart: milestones, activities, status checks, and the methodology
 *  tracks (PCT runs = Organizational Performance, ADKAR runs = Individual
 *  Performance, CM performance reports). */
export function TimelineView(props: {
  activities: Activity[];
  roadmap: Roadmap | undefined;
  tracking: TrackingEntry[];
  assessments: AssessmentDto[];
  reports: CmPerfReport[];
  groups: GroupDto[];
  today: string;
}) {
  const { activities, roadmap, tracking, assessments, reports, groups: impactedGroups, today } = props;

  const { groups, milestones, min, max } = useMemo(() => {
    const groups: TimelineGroup[] = [];
    // Unified activities: one row each, sectioned by ADKAR outcome.
    const dated = activities.filter((a) => a.startDate || a.finishDate);
    const seen = new Set<string>();
    for (const element of ADKAR_ELEMENTS) {
      const bars = dated
        .filter((a) => a.adkarOutcomes.includes(element) && !seen.has(a.id))
        .map((a) => {
          seen.add(a.id);
          return { label: a.name || '(unnamed activity)', start: a.startDate, finish: a.finishDate, status: a.status };
        });
      if (bars.length) groups.push({ title: `Activities — ${ADKAR_LABELS[element]}`, bars });
    }
    const other = dated.filter((a) => !seen.has(a.id));
    if (other.length) {
      groups.push({
        title: 'Activities — no ADKAR outcome',
        bars: other.map((a) => ({
          label: a.name || '(unnamed activity)',
          start: a.startDate,
          finish: a.finishDate,
          status: a.status,
        })),
      });
    }
    const checkBars = tracking
      .filter((e) => e.scheduledDate)
      .map((e) => ({
        label: `${TRACKING_SCHEDULE_LABELS[e.schedule as TrackingSchedule]?.split(' - ')[1] ?? 'Check'}: ${e.description || 'Status check'}`,
        start: e.scheduledDate,
        finish: e.completedDate ?? e.scheduledDate,
        status: e.status,
      }));
    if (checkBars.length) groups.push({ title: 'Status Checks', bars: checkBars });

    // Methodology tracks: assessments and reports plotted at their dates.
    const groupName = (a: AssessmentDto) =>
      a.subjectKind === 'project'
        ? 'Overall Change'
        : (impactedGroups.find((g) => g.id === a.subjectId)?.name ?? 'Group');
    const runBar = (a: AssessmentDto, label: string): TimelineBar | null => {
      const date = a.completedDate ?? a.scheduledDate;
      return date ? { label, start: date, finish: date, status: a.status } : null;
    };
    const pctBars = assessments
      .filter((a) => a.type === 'pct')
      .map((a, i) => runBar(a, a.label ?? `PCT run ${i + 1}`))
      .filter((b): b is TimelineBar => !!b);
    if (pctBars.length) groups.push({ title: 'Organizational Performance — PCT', bars: pctBars });
    const adkarBars = assessments
      .filter((a) => a.type === 'adkar' && a.subjectKind !== 'role')
      .map((a) => runBar(a, `${groupName(a)}${a.label ? `: ${a.label}` : ''}`))
      .filter((b): b is TimelineBar => !!b);
    if (adkarBars.length) groups.push({ title: 'Individual Performance — ADKAR', bars: adkarBars });
    const riskBars = assessments
      .filter((a) => a.type === 'risk')
      .map((a) =>
        runBar(a, `${a.subjectKind === 'group' ? groupName(a) : ASSESSMENT_TYPE_LABELS.risk}${a.label ? `: ${a.label}` : ''}`),
      )
      .filter((b): b is TimelineBar => !!b);
    if (riskBars.length) groups.push({ title: 'Risk Assessments', bars: riskBars });
    const reportBars = reports
      .filter((r) => r.date)
      .map((r) => ({ label: r.name, start: r.date, finish: r.date, status: r.status }));
    if (reportBars.length) groups.push({ title: 'CM Performance — Reports', bars: reportBars });

    const milestones: Milestone[] = [];
    if (roadmap) {
      if (roadmap.kickoffDate) milestones.push({ date: roadmap.kickoffDate, label: 'Kickoff' });
      if (roadmap.goliveDate) milestones.push({ date: roadmap.goliveDate, label: 'Go Live' });
      if (roadmap.outcomesDate) milestones.push({ date: roadmap.outcomesDate, label: 'Outcomes' });
      for (const m of roadmap.adkarMilestones) {
        if (!m.date) continue;
        const label = ADKAR_LABELS[m.element as keyof typeof ADKAR_LABELS] ?? m.element;
        milestones.push({ date: m.date, label: m.releaseNo === 0 ? label : `${label} (R${m.releaseNo})` });
      }
      for (const r of roadmap.releases) {
        if (r.date) milestones.push({ date: r.date, label: `Release ${r.releaseNo}` });
      }
    }
    milestones.sort((a, b) => (a.date < b.date ? -1 : 1));

    const dates: string[] = [
      ...groups.flatMap((g) => g.bars.flatMap((b) => [b.start, b.finish]).filter((d): d is string => !!d)),
      ...milestones.map((m) => m.date),
      today,
    ];
    let min = Math.min(...dates.map(t)) - 7 * DAY;
    let max = Math.max(...dates.map(t)) + 7 * DAY;
    if (max - min < 45 * DAY) {
      const mid = (min + max) / 2;
      min = mid - 23 * DAY;
      max = mid + 23 * DAY;
    }
    return { groups, milestones, min, max };
  }, [activities, roadmap, tracking, assessments, reports, impactedGroups, today]);

  const hasContent = groups.length > 0 || milestones.length > 0;
  if (!hasContent) {
    return (
      <div className="cmt-card py-12 text-center text-sm text-slate-400">
        Nothing to plot yet — add dates to roadmap milestones, blueprint activities or plan activities and they will
        appear here.
      </div>
    );
  }

  const pct = (date: string) => ((t(date) - min) / (max - min)) * 100;
  const widthPct = (start: string, finish: string) => Math.max(((t(finish) - t(start) + DAY) / (max - min)) * 100, 0.8);
  const ticks = monthTicks(min, max);
  const todayPct = pct(today);

  const axis = (
    <div className="relative h-6 border-b border-slate-200">
      {ticks.map((tick) => (
        <span
          key={tick.time}
          className="absolute top-0 text-[10px] font-medium text-slate-400"
          style={{ left: `${((tick.time - min) / (max - min)) * 100}%` }}
        >
          {tick.label}
        </span>
      ))}
    </div>
  );

  const gridlines = (
    <>
      {ticks.map((tick) => (
        <span
          key={tick.time}
          className="absolute inset-y-0 w-px bg-slate-100"
          style={{ left: `${((tick.time - min) / (max - min)) * 100}%` }}
        />
      ))}
      <span
        className="absolute inset-y-0 w-px bg-red-400"
        style={{ left: `${todayPct}%` }}
        title={`Today (${today})`}
      />
    </>
  );

  return (
    <div className="cmt-card overflow-x-auto">
      <div className="mb-2 flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
        <span className="flex items-center gap-1"><span className="h-2.5 w-4 rounded bg-green-500" /> Completed</span>
        <span className="flex items-center gap-1"><span className="h-2.5 w-4 rounded bg-indigo-500" /> In progress</span>
        <span className="flex items-center gap-1"><span className="h-2.5 w-4 rounded bg-slate-400" /> Not started</span>
        <span className="flex items-center gap-1"><span className="h-2.5 w-4 rounded bg-red-500" /> Overdue</span>
        <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rotate-45 bg-amber-500" /> Milestone</span>
        <span className="flex items-center gap-1"><span className="inline-block h-3 w-px bg-red-400" /> Today</span>
      </div>
      <div className="min-w-[900px]">
        <div className="flex">
          <div className="w-64 shrink-0" />
          <div className="relative flex-1">{axis}</div>
        </div>

        {milestones.length > 0 && (
          <div className="flex items-stretch border-b border-slate-100">
            <div className="w-64 shrink-0 py-1.5 pr-3 text-right text-xs font-semibold text-slate-600">
              Milestones
            </div>
            <div className="relative min-h-8 flex-1">
              {gridlines}
              {milestones.map((m, i) => (
                <span
                  key={`${m.date}-${m.label}`}
                  className="group absolute top-1.5"
                  style={{ left: `${pct(m.date)}%` }}
                  title={`${m.label} — ${m.date}`}
                >
                  <span className="block h-2.5 w-2.5 -translate-x-1/2 rotate-45 bg-amber-500" />
                  <span
                    className={`absolute left-1 top-3 whitespace-nowrap text-[9px] text-slate-500 ${i % 2 ? 'top-[-12px]' : ''}`}
                  >
                    {m.label}
                  </span>
                </span>
              ))}
            </div>
          </div>
        )}

        {groups.map((group) => (
          <div key={group.title}>
            <div className="flex items-stretch bg-slate-50/60">
              <div className="w-64 shrink-0 truncate py-1 pr-3 text-right text-[11px] font-bold uppercase tracking-wide text-slate-400">
                {group.title}
              </div>
              <div className="relative flex-1">{gridlines}</div>
            </div>
            {group.bars.map((bar, i) => (
              <div key={i} className="flex items-stretch border-b border-slate-50">
                <div className="w-64 shrink-0 truncate py-1.5 pr-3 text-right text-xs text-slate-600" title={bar.label}>
                  {bar.label}
                </div>
                <div className="relative min-h-7 flex-1">
                  {gridlines}
                  {bar.start && bar.finish ? (
                    <span
                      className={`absolute top-1.5 h-4 rounded ${statusColor(bar, today)}`}
                      style={{ left: `${pct(bar.start)}%`, width: `${widthPct(bar.start, bar.finish)}%` }}
                      title={`${bar.label}: ${bar.start} → ${bar.finish}${bar.status ? ` (${bar.status})` : ''}`}
                    />
                  ) : (
                    <span
                      className={`absolute top-2 h-3 w-3 -translate-x-1/2 rounded-full ${statusColor(bar, today)}`}
                      style={{ left: `${pct((bar.start ?? bar.finish)!)}%` }}
                      title={`${bar.label}: ${bar.start ?? bar.finish}${bar.status ? ` (${bar.status})` : ''}`}
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
