import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ACTIVITY_STATUSES,
  ADKAR_ELEMENTS,
  ADKAR_LABELS,
  TRACKING_SCHEDULES,
  TRACKING_SCHEDULE_LABELS,
  type TrackingSchedule,
} from '@cmt/domain';
import { api } from '../../lib/api';
import type { Roadmap, TrackingEntry } from '../../lib/types';
import { useProject } from '../../app/ProjectLayout';
import { DateInput, Select, TextArea } from '../../ui/controls';
import { useActivities } from '../activities/useActivities';
import { useAssessments } from '../assessments/useAssessments';
import { useGroups } from '../impact/useGroups';
import { useCmPerfReports } from './CmPerformancePage';
import { TimelineView } from './TimelineView';

export function TrackingPage() {
  const { projectId } = useProject();
  const queryClient = useQueryClient();
  const [view, setView] = useState<'timeline' | 'schedules'>('timeline');
  const { data: activities } = useActivities(projectId);
  const { data: assessments } = useAssessments(projectId);
  const { data: reports } = useCmPerfReports(projectId);
  const { data: groups } = useGroups(projectId);
  const { data: entries } = useQuery({
    queryKey: ['tracking', projectId],
    queryFn: () => api.get<TrackingEntry[]>(`/api/projects/${projectId}/tracking`),
    enabled: projectId !== '',
  });
  const { data: roadmap } = useQuery({
    queryKey: ['roadmap', projectId],
    queryFn: () => api.get<Roadmap>(`/api/projects/${projectId}/roadmap`),
    enabled: projectId !== '',
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['tracking', projectId] });
    void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  };
  const create = useMutation({
    mutationFn: (schedule: TrackingSchedule) =>
      api.post<TrackingEntry>(`/api/projects/${projectId}/tracking`, { schedule }),
    onSuccess: invalidate,
  });
  const update = useMutation({
    mutationFn: (input: { id: string; fields: Record<string, unknown> }) =>
      api.patch<TrackingEntry>(`/api/tracking/${input.id}`, input.fields),
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.del(`/api/tracking/${id}`),
    onSuccess: invalidate,
  });

  const milestone = (element: string) =>
    roadmap?.adkarMilestones.find((m) => m.releaseNo === 0 && m.element === element)?.date ?? '—';

  return (
    <div className="max-w-5xl space-y-4">
      <div>
        <h2 className="text-xl font-bold">Tracking Calendar</h2>
        <p className="text-sm text-slate-500">Phase 2 — Manage Change. Key dates pulled live from the Roadmap.</p>
      </div>

      <div className="flex gap-1">
        {(
          [
            ['timeline', 'Timeline'],
            ['schedules', 'Status Check Schedules'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            className={`rounded-t px-3 py-1.5 text-sm font-medium ${
              view === key ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'
            }`}
            onClick={() => setView(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {view === 'timeline' && (
        <TimelineView
          activities={activities ?? []}
          roadmap={roadmap}
          tracking={entries ?? []}
          assessments={assessments ?? []}
          reports={reports ?? []}
          groups={groups ?? []}
          today={new Date().toISOString().slice(0, 10)}
        />
      )}

      {view === 'schedules' && (
      <>
      <div className="cmt-card">
        <h3 className="mb-2 font-semibold">Key Dates (from Roadmap)</h3>
        <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm md:grid-cols-4">
          <div>
            <span className="cmt-label">Kickoff</span>
            {roadmap?.kickoffDate ?? '—'}
          </div>
          <div>
            <span className="cmt-label">Go Live</span>
            {roadmap?.goliveDate ?? '—'}
          </div>
          <div>
            <span className="cmt-label">Outcomes</span>
            {roadmap?.outcomesDate ?? '—'}
          </div>
          <div />
          {ADKAR_ELEMENTS.map((el) => (
            <div key={el}>
              <span className="cmt-label">{ADKAR_LABELS[el]}</span>
              {milestone(el)}
            </div>
          ))}
        </div>
      </div>

      {TRACKING_SCHEDULES.map((schedule) => {
        const scheduleEntries = (entries ?? []).filter((e) => e.schedule === schedule);
        return (
          <section key={schedule} className="cmt-card">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="font-semibold">{TRACKING_SCHEDULE_LABELS[schedule]}</h3>
              <button className="cmt-btn" onClick={() => create.mutate(schedule)}>
                Add check
              </button>
            </div>
            {scheduleEntries.length === 0 ? (
              <p className="text-sm text-slate-400">No status checks scheduled.</p>
            ) : (
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="cmt-th w-8">#</th>
                    <th className="cmt-th w-36">Date Scheduled</th>
                    <th className="cmt-th w-36">Date Completed</th>
                    <th className="cmt-th">Description</th>
                    <th className="cmt-th w-32">Status</th>
                    <th className="cmt-th">Results</th>
                    <th className="cmt-th">Notes</th>
                    <th className="cmt-th w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {scheduleEntries.map((entry, i) => (
                    <tr key={entry.id}>
                      <td className="cmt-td text-slate-400">{i + 1}</td>
                      <td className="cmt-td">
                        <DateInput
                          value={entry.scheduledDate}
                          onSave={(v) => update.mutate({ id: entry.id, fields: { scheduledDate: v } })}
                        />
                      </td>
                      <td className="cmt-td">
                        <DateInput
                          value={entry.completedDate}
                          onSave={(v) => update.mutate({ id: entry.id, fields: { completedDate: v } })}
                        />
                      </td>
                      <td className="cmt-td">
                        <TextArea
                          rows={1}
                          value={entry.description}
                          onSave={(v) => update.mutate({ id: entry.id, fields: { description: v } })}
                        />
                      </td>
                      <td className="cmt-td">
                        <Select
                          value={entry.status}
                          options={ACTIVITY_STATUSES}
                          onSave={(v) => update.mutate({ id: entry.id, fields: { status: v } })}
                        />
                      </td>
                      <td className="cmt-td">
                        <TextArea
                          rows={1}
                          value={entry.results}
                          onSave={(v) => update.mutate({ id: entry.id, fields: { results: v } })}
                        />
                      </td>
                      <td className="cmt-td">
                        <TextArea
                          rows={1}
                          value={entry.notes}
                          onSave={(v) => update.mutate({ id: entry.id, fields: { notes: v } })}
                        />
                      </td>
                      <td className="cmt-td">
                        <button
                          className="cmt-btn-danger"
                          onClick={() => {
                            if (confirm('Delete this check?')) remove.mutate(entry.id);
                          }}
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        );
      })}
      </>
      )}
    </div>
  );
}
