import { useState } from 'react';
import type { SaturationBand } from '@cmt/domain';
import { useSaturation, type SaturationCellDto } from './useSaturation';

const BAND_STYLES: Record<SaturationBand, string> = {
  ok: 'bg-emerald-50 text-emerald-800',
  elevated: 'bg-amber-100 text-amber-900',
  overloaded: 'bg-red-200 text-red-900 font-semibold',
};

/** '2026-07' -> 'Jul 26' */
function monthLabel(bucket: string): string {
  const [year, month] = bucket.split('-').map(Number) as [number, number];
  const name = new Date(Date.UTC(year, month - 1, 1)).toLocaleString('en', { month: 'short', timeZone: 'UTC' });
  return `${name} ${String(year).slice(2)}`;
}

/**
 * Change saturation across the portfolio: how much scheduled change each org
 * group absorbs per month, summed over active projects. A planning signal
 * derived from degree of impact and roadmap windows — not a Prosci score and
 * not a measure of experienced strain.
 */
export function SaturationHeatmap() {
  const { data } = useSaturation();
  const [selected, setSelected] = useState<{ group: string; month: string; cell: SaturationCellDto } | null>(null);

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

  return (
    <div className="cmt-card">
      <div className="mb-1 flex items-center justify-between">
        <h3 className="font-semibold">Change Saturation</h3>
        <span className="text-[11px] text-slate-400">
          Scheduled exposure to impact — our analytic, not a Prosci score
        </span>
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
            {data.rows.map((row) => (
              <tr key={row.orgGroupId}>
                <td className="cmt-td font-medium">{row.orgGroupName}</td>
                {row.cells.map((cell, i) => (
                  <td key={data.months[i]} className="cmt-td p-0.5 text-center">
                    {cell.score > 0 ? (
                      <button
                        type="button"
                        className={`h-8 w-full rounded text-xs tabular-nums ${BAND_STYLES[cell.band]}`}
                        title={`${row.orgGroupName} · ${monthLabel(data.months[i]!)}: ${cell.score}`}
                        onClick={() =>
                          setSelected({ group: row.orgGroupName, month: data.months[i]!, cell })
                        }
                      >
                        {Number.isInteger(cell.score) ? cell.score : cell.score.toFixed(1)}
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
          {selected.cell.contributions
            .map((c) => `${c.projectName} (${Number.isInteger(c.load) ? c.load : c.load.toFixed(1)})`)
            .join(' + ')}{' '}
          = {selected.cell.score}
        </div>
      )}
    </div>
  );
}
