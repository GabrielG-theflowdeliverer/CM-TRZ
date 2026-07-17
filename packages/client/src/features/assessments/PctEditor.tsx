import {
  PCT_ASPECT_KEYS,
  PCT_ASPECT_LABELS,
  PCT_FACTORS,
  PCT_INTERPRETATION,
  PCT_INTRO,
  pctItemKey,
} from '@cmt/domain';
import type { AssessmentDto } from '../../lib/types';
import { BandChip, ScorePicker } from '../../ui/scores';
import { TriangleChart } from '../../ui/TriangleChart';

export function PctEditor(props: { run: AssessmentDto; onScore: (itemKey: string, value: number | null) => void }) {
  const { run, onScore } = props;
  const scores = run.computed.pct!;
  return (
    <div className="space-y-4">
      <div className="cmt-card flex flex-col gap-4 md:flex-row">
        <div className="md:w-1/2">
          <h3 className="mb-2 font-semibold">Prosci Change Triangle (PCT) — Assessment Results</h3>
          <TriangleChart scores={scores} />
        </div>
        <div className="md:w-1/2">
          <h4 className="mb-2 text-sm font-semibold">Score Summary</h4>
          <div className="mb-4 flex flex-col items-start gap-1.5">
            {PCT_ASPECT_KEYS.map((k) => (
              <BandChip key={k} label={PCT_ASPECT_LABELS[k]} score={scores[k]} />
            ))}
          </div>
          <h4 className="mb-1 text-sm font-semibold">Score interpretation:</h4>
          <ul className="space-y-0.5 text-xs text-slate-600">
            {PCT_INTERPRETATION.map((row) => (
              <li key={row.range}>
                <span className="font-semibold">{row.range}</span> — {row.meaning}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[11px] leading-relaxed text-slate-400">{PCT_INTRO}</p>
        </div>
      </div>

      {PCT_ASPECT_KEYS.map((aspect) => (
        <div key={aspect} className="cmt-card">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="font-semibold">{PCT_ASPECT_LABELS[aspect]}</h3>
            <BandChip label="Score" score={scores[aspect]} />
          </div>
          <table className="w-full">
            <thead>
              <tr>
                <th className="cmt-th w-8">#</th>
                <th className="cmt-th">Factor</th>
                <th className="cmt-th w-32">Score (1–3)</th>
              </tr>
            </thead>
            <tbody>
              {PCT_FACTORS[aspect].map((factor, i) => {
                const key = pctItemKey(aspect, i);
                return (
                  <tr key={key}>
                    <td className="cmt-td text-slate-400">{i + 1}</td>
                    <td className="cmt-td">{factor}</td>
                    <td className="cmt-td">
                      <ScorePicker value={run.responses[key]} onChange={(v) => onScore(key, v)} min={1} max={3} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
