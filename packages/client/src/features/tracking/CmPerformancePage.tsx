import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ACTIVITY_STATUSES, CM_PERF_STATUSES, type CmPerfReport } from '@cmt/domain';
import { api } from '../../lib/api';
import { useProject } from '../../app/ProjectLayout';
import { DateInput, Select, TextArea, TextField } from '../../ui/controls';

const STATUS_COLORS: Record<string, string> = {
  'No Progress': 'bg-slate-200 text-slate-700',
  'Well Behind Target': 'bg-red-100 text-red-800',
  'Behind Target': 'bg-amber-100 text-amber-800',
  'On Target': 'bg-green-100 text-green-800',
  'Ahead of Target': 'bg-emerald-200 text-emerald-900',
};

export function useCmPerfReports(projectId: string) {
  return useQuery({
    queryKey: ['cm-perf-reports', projectId],
    queryFn: () => api.get<CmPerfReport[]>(`/api/projects/${projectId}/cm-perf-reports`),
    enabled: projectId !== '',
  });
}

export function CmPerformancePage() {
  const { projectId } = useProject();
  const queryClient = useQueryClient();
  const { data: reports } = useCmPerfReports(projectId);
  const [name, setName] = useState('');

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['cm-perf-reports', projectId] });
    void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    void queryClient.invalidateQueries({ queryKey: ['project-dashboard', projectId] });
  };
  const create = useMutation({
    mutationFn: (reportName: string) =>
      api.post<CmPerfReport>(`/api/projects/${projectId}/cm-perf-reports`, {
        name: reportName,
        date: new Date().toISOString().slice(0, 10),
      }),
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.del(`/api/cm-perf-reports/${id}`),
    onSuccess: invalidate,
  });

  return (
    <div className="max-w-4xl space-y-4">
      <div>
        <h2 className="text-xl font-bold">CM Performance Reports</h2>
        <p className="text-sm text-slate-500">
          Each report enumerates every ADKAR blueprint and CM plan for a 5-level metric status check.
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
          placeholder="Report name (e.g. Q3 status check)…"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button className="cmt-btn" disabled={!name.trim()}>
          Add report
        </button>
      </form>

      <div className="cmt-card">
        <table className="w-full">
          <thead>
            <tr>
              <th className="cmt-th">Report Name</th>
              <th className="cmt-th w-32">Date</th>
              <th className="cmt-th w-32">Status</th>
              <th className="cmt-th w-28">Items</th>
              <th className="cmt-th w-14"></th>
            </tr>
          </thead>
          <tbody>
            {(reports ?? []).map((report) => (
              <tr key={report.id}>
                <td className="cmt-td">
                  <Link
                    to={`/projects/${projectId}/cm-performance/${report.id}`}
                    className="font-medium text-indigo-700 hover:underline"
                  >
                    {report.name}
                  </Link>
                </td>
                <td className="cmt-td text-xs text-slate-500">{report.date ?? '—'}</td>
                <td className="cmt-td text-xs text-slate-500">{report.status ?? '—'}</td>
                <td className="cmt-td text-xs text-slate-500">
                  {report.items.filter((i) => i.status).length}/{report.items.length} assessed
                </td>
                <td className="cmt-td text-right">
                  <button
                    className="cmt-btn-danger"
                    onClick={() => {
                      if (confirm(`Delete report "${report.name}"?`)) remove.mutate(report.id);
                    }}
                  >
                    ✕
                  </button>
                </td>
              </tr>
            ))}
            {(reports ?? []).length === 0 && (
              <tr>
                <td colSpan={5} className="cmt-td py-8 text-center text-slate-400">
                  No reports yet — add one to take a status snapshot of all blueprints and plans.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function CmPerfReportPage() {
  const { projectId } = useProject();
  const { reportId = '' } = useParams();
  const queryClient = useQueryClient();
  const { data: report } = useQuery({
    queryKey: ['cm-perf-reports', projectId, reportId],
    queryFn: () => api.get<CmPerfReport>(`/api/cm-perf-reports/${reportId}`),
    enabled: reportId !== '',
  });
  const refresh = (data?: CmPerfReport) => {
    if (data) queryClient.setQueryData(['cm-perf-reports', projectId, reportId], data);
    void queryClient.invalidateQueries({ queryKey: ['cm-perf-reports', projectId] });
    void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    void queryClient.invalidateQueries({ queryKey: ['project-dashboard', projectId] });
  };
  const updateReport = useMutation({
    mutationFn: (fields: Record<string, unknown>) =>
      api.patch<CmPerfReport>(`/api/cm-perf-reports/${reportId}`, fields),
    onSuccess: refresh,
  });
  const updateItem = useMutation({
    mutationFn: (input: { id: string; fields: Record<string, unknown> }) =>
      api.patch<CmPerfReport>(`/api/cm-perf-items/${input.id}`, input.fields),
    onSuccess: refresh,
  });

  if (!report) return null;
  const sections = [
    { title: 'ADKAR Blueprints', items: report.items.filter((i) => i.kind === 'blueprint') },
    { title: 'Change Management Plans', items: report.items.filter((i) => i.kind === 'plan') },
    { title: 'Other', items: report.items.filter((i) => i.kind === 'other') },
  ].filter((s) => s.items.length > 0);

  return (
    <div className="max-w-4xl space-y-4">
      <div>
        <Link
          to={`/projects/${projectId}/cm-performance`}
          className="text-xs font-semibold text-indigo-600 hover:underline"
        >
          ← All reports
        </Link>
        <h2 className="text-xl font-bold">CM Performance Report — {report.name}</h2>
      </div>

      <div className="cmt-card grid grid-cols-2 gap-3 md:grid-cols-3">
        <div>
          <label className="cmt-label">Report Name</label>
          <TextField value={report.name} onSave={(v) => v && updateReport.mutate({ name: v })} />
        </div>
        <div>
          <label className="cmt-label">Date</label>
          <DateInput value={report.date} onSave={(v) => updateReport.mutate({ date: v })} />
        </div>
        <div>
          <label className="cmt-label">Report Status</label>
          <Select value={report.status} options={ACTIVITY_STATUSES} onSave={(v) => updateReport.mutate({ status: v })} />
        </div>
      </div>

      {sections.map((section) => (
        <section key={section.title} className="cmt-card">
          <h3 className="mb-2 font-semibold">{section.title}</h3>
          <table className="w-full">
            <thead>
              <tr>
                <th className="cmt-th w-56"></th>
                <th className="cmt-th w-52">Metric Status</th>
                <th className="cmt-th">Description</th>
              </tr>
            </thead>
            <tbody>
              {section.items.map((item) => (
                <tr key={item.id}>
                  <td className="cmt-td font-medium">
                    {item.label ?? '(deleted)'}
                    {item.status && (
                      <span
                        className={`ml-2 rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_COLORS[item.status] ?? ''}`}
                      >
                        {item.status}
                      </span>
                    )}
                  </td>
                  <td className="cmt-td">
                    <Select
                      value={item.status}
                      options={CM_PERF_STATUSES}
                      onSave={(v) => updateItem.mutate({ id: item.id, fields: { status: v } })}
                    />
                  </td>
                  <td className="cmt-td">
                    <TextArea
                      rows={1}
                      value={item.description}
                      onSave={(v) => updateItem.mutate({ id: item.id, fields: { description: v } })}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}
    </div>
  );
}
