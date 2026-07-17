import { pctBand, type ScoreBand } from '@cmt/domain';

export const BAND_COLORS: Record<ScoreBand, string> = {
  strength: 'bg-green-600',
  alert: 'bg-amber-500',
  risk: 'bg-red-600',
};

export const BAND_TEXT: Record<ScoreBand, string> = {
  strength: 'text-green-700',
  alert: 'text-amber-600',
  risk: 'text-red-700',
};

/** Colored chip for a PCT aspect score (10-30 with Excel bands). */
export function BandChip(props: { label: string; score: number | null | undefined }) {
  const score = props.score;
  if (score == null) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-500">
        {props.label} <span className="font-bold">—</span>
      </span>
    );
  }
  const band = pctBand(score);
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium text-white ${BAND_COLORS[band]}`}
    >
      {props.label} <span className="font-bold">{score}</span>
    </span>
  );
}

/** Row of clickable score buttons (e.g. 1-3 for PCT, 1-5 for risk, 0-5 for impact). */
export function ScorePicker(props: {
  value: number | null | undefined;
  onChange: (value: number | null) => void;
  min: number;
  max: number;
  colorFor?: (value: number) => string;
}) {
  const values: number[] = [];
  for (let v = props.min; v <= props.max; v++) values.push(v);
  return (
    <div className="flex gap-0.5" role="radiogroup">
      {values.map((v) => {
        const selected = props.value === v;
        const activeColor = props.colorFor?.(v) ?? 'bg-indigo-600 text-white';
        return (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={selected}
            className={`h-7 w-7 rounded text-xs font-semibold transition-colors ${
              selected ? activeColor : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
            }`}
            onClick={() => props.onChange(selected ? null : v)}
            title={selected ? 'Click to clear' : String(v)}
          >
            {v}
          </button>
        );
      })}
    </div>
  );
}

/** Red -> green scale for 1-5 scores where higher is better (ADKAR). */
export function adkarCellColor(value: number): string {
  if (value <= 1) return 'bg-red-600 text-white';
  if (value === 2) return 'bg-orange-500 text-white';
  if (value === 3) return 'bg-amber-400 text-slate-900';
  if (value === 4) return 'bg-lime-500 text-slate-900';
  return 'bg-green-600 text-white';
}

/** White -> deep amber scale for 0-5 impact scores where higher = heavier impact. */
export function impactCellColor(value: number): string {
  const scale = [
    'bg-slate-100 text-slate-500',
    'bg-amber-100 text-slate-800',
    'bg-amber-200 text-slate-800',
    'bg-amber-300 text-slate-900',
    'bg-orange-400 text-white',
    'bg-orange-600 text-white',
  ];
  return scale[Math.max(0, Math.min(5, Math.round(value)))]!;
}

export function HeatCell(props: { value: number | null | undefined; colorFor: (v: number) => string; title?: string }) {
  if (props.value == null) return <span className="inline-block h-6 w-8 rounded bg-slate-50 text-center text-xs leading-6 text-slate-300">—</span>;
  return (
    <span
      title={props.title}
      className={`inline-block h-6 w-8 rounded text-center text-xs font-semibold leading-6 ${props.colorFor(props.value)}`}
    >
      {Number.isInteger(props.value) ? props.value : props.value.toFixed(1)}
    </span>
  );
}

export function BarrierBadge(props: { barrier: string | null | undefined }) {
  if (!props.barrier) return <span className="text-xs text-slate-300">—</span>;
  const isClear = props.barrier === 'No barrier';
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
        isClear ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
      }`}
    >
      {props.barrier}
    </span>
  );
}

export function RiskBadge(props: { quadrant: string | null | undefined }) {
  if (!props.quadrant) return <span className="text-xs text-slate-400">Not assessed</span>;
  const colors: Record<string, string> = {
    Low: 'bg-green-100 text-green-800',
    Medium: 'bg-amber-100 text-amber-800',
    High: 'bg-red-100 text-red-800',
  };
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${colors[props.quadrant] ?? ''}`}>
      {props.quadrant} risk
    </span>
  );
}
