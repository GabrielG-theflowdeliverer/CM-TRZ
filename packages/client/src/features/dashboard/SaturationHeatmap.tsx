import { useMemo, useState } from 'react';
import { buildSaturationRows, shiftMonth, type SaturationBand } from '@cmt/domain';
import { useSaturation, type SaturationCellDto } from './useSaturation';
import { RescheduleDialog } from './RescheduleDialog';

const BAND_STYLES: Record<SaturationBand, string> = {
  ok: 'bg-emerald-50 text-emerald-800',
  elevated: 'bg-amber-100 text-amber-900',
  overloaded: 'bg-red-200 text-red-900 font-semibold',
};

/** '2026-07' -> "Jul '26" (apostrophe marks the year, so it doesn't read as a day). */
function monthLabel(bucket: string): string {
  const [year, month] = bucket.split('-').map(Number) as [number, number];
  const name = new Date(Date.UTC(year, month - 1, 1)).toLocaleString('en', { month: 'short', timeZone: 'UTC' });
  return `${name} '${String(year).slice(2)}`;
}

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

/**
 * Change saturation across the portfolio: how much scheduled change each org
 * group absorbs per month, summed over active projects, with a what-if that
 * re-sequences a project's go-live and recomputes the grid live (nothing saved).
 */
export function SaturationHeatmap() {
  const { data } = useSaturation();
  const [shifts, setShifts] = useState<Record<string, number>>({});
  const [selected, setSelected] = useState<{ group: string; month: string; cell: SaturationCellDto } | null>(null);
  const [reviewing, setReviewing] = useState(false);

  const anyShift = Object.values(shifts).some((v) => v !== 0);
  const rows = useMemo(() => {
    if (!data) return [];
    if (!anyShift) return data.rows;
    const orgGroups = data.rows.map((r) => ({ id: r.orgGroupId, name: r.orgGroupName }));
    return buildSaturationRows(data.months, orgGroups, data.projects, shifts);
  }, [data, shifts, anyShift]);

  if (!data || data.rows.length === 0) {
    return (
      <div className="cmt-card">
        <h3 className="font-semibold">Change Saturation</h3>
        <p className="py-4 text-center text-sm text-slate-400">
          Link impacted groups to organization groups (on each group’s page) to see how much change every
          real-world group is absorbing across projects.
        </p>
      </div>
    );
  }

  const reschedulable = data.projects.filter((p) => p.startMonth !== null);

  return (
    <div className="cmt-card">
      <div className="mb-1 flex items-center justify-between">
        <h3 className="font-semibold">Change Saturation</h3>
        <span className="text-[11px] text-slate-400">Scheduled change load per group across active projects</span>
      </div>
      {data.unlinkedGroupCount > 0 && (
        <p className="mb-2 text-xs text-amber-700">
          {data.unlinkedGroupCount} impacted group{data.unlinkedGroupCount === 1 ? '' : 's'} in active projects
          aren’t linked to an organization group — link them to complete this view.
        </p>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className="cmt-th text-left">Org group</th>
              {data.months.map((m) => (
                <th key={m} className="cmt-th w-16 text-center">
                  {monthLabel(m)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.orgGroupId}>
                <td className="cmt-td font-medium">{row.orgGroupName}</td>
                {row.cells.map((cell, i) => (
                  <td key={data.months[i]} className="cmt-td p-0.5 text-center">
                    {cell.score > 0 ? (
                      <button
                        type="button"
                        className={`h-8 w-full rounded text-xs tabular-nums ${BAND_STYLES[cell.band]}`}
                        title={`${row.orgGroupName} · ${monthLabel(data.months[i]!)}: ${fmt(cell.score)}`}
                        onClick={() => setSelected({ group: row.orgGroupName, month: data.months[i]!, cell })}
                      >
                        {fmt(cell.score)}
                      </button>
                    ) : (
                      <div className="h-8 w-full rounded bg-slate-50" />
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selected && (
        <div className="mt-2 rounded border border-slate-200 bg-slate-50 p-2 text-xs">
          <span className="font-semibold">
            {selected.group} · {monthLabel(selected.month)}:
          </span>{' '}
          {selected.cell.contributions.map((c) => `${c.projectName} (${fmt(c.load)})`).join(' + ')} ={' '}
          {fmt(selected.cell.score)}
        </div>
      )}

      {reschedulable.length > 0 && (
        <div className="mt-3 border-t border-slate-100 pt-3">
          <div className="mb-1 flex items-center justify-between">
            <h4 className="text-sm font-semibold">Re-sequencing (what-if)</h4>
            {anyShift && (
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  className="text-xs font-medium text-indigo-600 hover:underline"
                  onClick={() => setReviewing(true)}
                >
                  Review &amp; save…
                </button>
                <button
                  type="button"
                  className="text-xs font-medium text-slate-500 hover:underline"
                  onClick={() => setShifts({})}
                >
                  Reset
                </button>
              </div>
            )}
          </div>
          <p className="mb-2 text-xs text-slate-500">
            Slide a project’s go-live to see the heatmap recompute. Planning only — nothing is saved.
          </p>
          <div className="space-y-1.5">
            {reschedulable.map((p) => {
              const by = shifts[p.id] ?? 0;
              return (
                <div key={p.id} className="flex items-center gap-2 text-sm">
                  <span className="w-40 shrink-0 truncate" title={p.name}>
                    {p.name}
                  </span>
                  <input
                    type="range"
                    min={-6}
                    max={9}
                    value={by}
                    aria-label={`Shift ${p.name} go-live by months`}
                    onChange={(e) => setShifts((s) => ({ ...s, [p.id]: Number(e.target.value) }))}
                    className="flex-1"
                  />
                  <span className="w-32 shrink-0 text-right text-xs text-slate-500 tabular-nums">
                    {p.goliveMonth ? `go-live ${monthLabel(shiftMonth(p.goliveMonth, by))}` : `${by >= 0 ? '+' : ''}${by} mo`}
                    {by !== 0 && ` (${by > 0 ? '+' : ''}${by})`}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {reviewing && (
        <RescheduleDialog
          projects={data.projects}
          shifts={shifts}
          onClose={() => setReviewing(false)}
          onApplied={(appliedIds) => {
            // Drop the applied shifts (now real); keep any unapplied what-ifs.
            setShifts((s) => {
              const next = { ...s };
              for (const id of appliedIds) delete next[id];
              return next;
            });
            setReviewing(false);
          }}
        />
      )}
    </div>
  );
}
