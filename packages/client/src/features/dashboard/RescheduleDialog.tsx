import { useMemo, useState } from 'react';
import { shiftDateByMonths } from '@cmt/domain';
import { DateInput } from '../../ui/controls';
import { Modal } from '../../ui/Modal';
import type { SaturationProjectDto } from './useSaturation';
import { useApplyReschedule, type RescheduleChange } from './useApplyReschedule';

interface Row {
  projectId: string;
  name: string;
  include: boolean;
  current: { kickoffDate: string | null; goliveDate: string | null; outcomesDate: string | null };
  proposed: { kickoffDate: string | null; goliveDate: string | null; outcomesDate: string | null };
}

const shift = (date: string | null, by: number) => (date === null ? null : shiftDateByMonths(date, by));

/**
 * Review & apply a what-if re-sequencing. One row per shifted project, each with
 * a checkbox (apply all or some) and editable proposed dates (defaulting to the
 * month-shifted roadmap dates). Applying rewrites the roadmap — and reschedules
 * that project's PCT assessments — for the checked rows only.
 */
export function RescheduleDialog({
  projects,
  shifts,
  onClose,
  onApplied,
}: {
  projects: SaturationProjectDto[];
  shifts: Record<string, number>;
  onClose: () => void;
  onApplied: (appliedProjectIds: string[]) => void;
}) {
  const apply = useApplyReschedule();

  // Projects with a real shift, split into applyable (have roadmap dates) and not.
  const shifted = projects.filter((p) => (shifts[p.id] ?? 0) !== 0);
  const hasRoadmapDate = (p: SaturationProjectDto) =>
    p.roadmap.kickoffDate !== null || p.roadmap.goliveDate !== null || p.roadmap.outcomesDate !== null;
  const applyable = shifted.filter(hasRoadmapDate);
  const blocked = shifted.filter((p) => !hasRoadmapDate(p));

  const [rows, setRows] = useState<Row[]>(() =>
    applyable.map((p) => {
      const by = shifts[p.id] ?? 0;
      return {
        projectId: p.id,
        name: p.name,
        include: true,
        current: p.roadmap,
        proposed: {
          kickoffDate: shift(p.roadmap.kickoffDate, by),
          goliveDate: shift(p.roadmap.goliveDate, by),
          outcomesDate: shift(p.roadmap.outcomesDate, by),
        },
      };
    }),
  );

  const selectedCount = rows.filter((r) => r.include).length;

  const setRow = (id: string, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r) => (r.projectId === id ? { ...r, ...patch } : r)));
  const setProposed = (id: string, field: keyof Row['proposed'], value: string | null) =>
    setRows((rs) =>
      rs.map((r) => (r.projectId === id ? { ...r, proposed: { ...r.proposed, [field]: value } } : r)),
    );

  const onApply = () => {
    const changes: RescheduleChange[] = rows
      .filter((r) => r.include)
      .map((r) => ({ projectId: r.projectId, ...r.proposed }));
    if (changes.length === 0) return;
    apply.mutate(changes, { onSuccess: () => onApplied(changes.map((c) => c.projectId)) });
  };

  const dateFields = useMemo(
    () => [
      { key: 'kickoffDate', label: 'Kickoff' },
      { key: 'goliveDate', label: 'Go-live' },
      { key: 'outcomesDate', label: 'Outcomes' },
    ] as const,
    [],
  );

  return (
    <Modal
      title="Review & apply re-sequencing"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="cmt-btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="cmt-btn"
            disabled={selectedCount === 0 || apply.isPending}
            onClick={onApply}
          >
            {apply.isPending ? 'Applying…' : `Apply selected (${selectedCount})`}
          </button>
        </>
      }
    >
      <p className="mb-3 rounded bg-amber-50 px-3 py-2 text-xs text-amber-800">
        Applying rewrites each selected project’s roadmap dates and <strong>reschedules its PCT
        assessments</strong> (Kickoff / Go-Live / Outcomes runs) to match.
      </p>

      {rows.length === 0 && blocked.length === 0 && (
        <p className="text-sm text-slate-500">No changes to apply.</p>
      )}

      <div className="space-y-3">
        {rows.map((row) => (
          <div key={row.projectId} className="rounded border border-slate-200 p-3">
            <label className="flex items-center gap-2 font-medium">
              <input
                type="checkbox"
                checked={row.include}
                onChange={(e) => setRow(row.projectId, { include: e.target.checked })}
                aria-label={`Apply ${row.name}`}
              />
              {row.name}
            </label>
            <div className="mt-2 grid grid-cols-3 gap-3">
              {dateFields.map((f) => (
                <div key={f.key}>
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{f.label}</div>
                  <div className="mb-0.5 text-[11px] text-slate-400">
                    was {row.current[f.key] ?? '—'}
                  </div>
                  <DateInput
                    value={row.proposed[f.key]}
                    onSave={(v) => setProposed(row.projectId, f.key, v)}
                  />
                </div>
              ))}
            </div>
          </div>
        ))}

        {blocked.map((p) => (
          <div key={p.id} className="rounded border border-slate-200 bg-slate-50 p-3 text-sm text-slate-500">
            <span className="font-medium text-slate-600">{p.name}</span> — no roadmap dates to move. Set its
            Kickoff / Go-live / Outcomes on the Roadmap page first.
          </div>
        ))}
      </div>
    </Modal>
  );
}
