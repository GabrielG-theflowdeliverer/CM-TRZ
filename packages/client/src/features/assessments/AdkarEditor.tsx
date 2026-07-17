import { ADKAR_ASSESSMENT_INTRO, ADKAR_ELEMENTS, ADKAR_STATEMENTS, adkarItemKey } from '@cmt/domain';
import type { AssessmentDto } from '../../lib/types';
import { BarrierBadge, HeatCell, ScorePicker, adkarCellColor } from '../../ui/scores';

export function AdkarEditor(props: { run: AssessmentDto; onScore: (itemKey: string, value: number | null) => void }) {
  const { run, onScore } = props;
  const adkar = run.computed.adkar!;
  return (
    <div className="cmt-card space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">ADKAR Assessment</h3>
        <span className="flex items-center gap-2 text-sm">
          Barrier Point: <BarrierBadge barrier={adkar.barrierPoint} />
        </span>
      </div>
      <p className="text-xs leading-relaxed text-slate-500">{ADKAR_ASSESSMENT_INTRO}</p>
      <table className="w-full max-w-2xl">
        <thead>
          <tr>
            <th className="cmt-th">Statement</th>
            <th className="cmt-th w-48">Score (1–5)</th>
            <th className="cmt-th w-12"></th>
          </tr>
        </thead>
        <tbody>
          {ADKAR_ELEMENTS.map((el) => {
            const key = adkarItemKey(el);
            return (
              <tr key={el}>
                <td className="cmt-td">{ADKAR_STATEMENTS[el]}</td>
                <td className="cmt-td">
                  <ScorePicker
                    value={run.responses[key]}
                    min={1}
                    max={5}
                    colorFor={adkarCellColor}
                    onChange={(v) => onScore(key, v)}
                  />
                </td>
                <td className="cmt-td text-center">
                  <HeatCell value={run.responses[key]} colorFor={adkarCellColor} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="text-xs text-slate-400">The barrier point is the first ADKAR element scoring 3 or below.</p>
    </div>
  );
}
