import {
  RISK_FACTORS,
  RISK_INTERPRETATION_NOTES,
  RISK_SECTION_KEYS,
  RISK_SECTION_LABELS,
  riskItemKey,
} from '@cmt/domain';
import type { AssessmentDto } from '../../lib/types';
import { RiskBadge, ScorePicker } from '../../ui/scores';
import { QuadrantChart } from '../../ui/QuadrantChart';

export function RiskEditor(props: { run: AssessmentDto; onScore: (itemKey: string, value: number | null) => void }) {
  const { run, onScore } = props;
  const risk = run.computed.risk!;
  return (
    <div className="space-y-4">
      <div className="cmt-card flex flex-col gap-6 md:flex-row">
        <div className="md:w-1/2">
          <h3 className="mb-2 font-semibold">Risk Assessment Analysis</h3>
          <dl className="space-y-1 text-sm">
            <div className="flex justify-between border-b border-slate-100 py-1">
              <dt>Change Characteristics score</dt>
              <dd className="font-semibold">{risk.cc ?? 'NA'}</dd>
            </div>
            <div className="flex justify-between border-b border-slate-100 py-1">
              <dt>Organizational Attributes score</dt>
              <dd className="font-semibold">{risk.oa ?? 'NA'}</dd>
            </div>
            <div className="flex items-center justify-between py-1">
              <dt>Risk Quadrant</dt>
              <dd>
                <RiskBadge quadrant={risk.quadrant} />
              </dd>
            </div>
          </dl>
          <ul className="mt-4 space-y-0.5 text-xs text-slate-500">
            {RISK_INTERPRETATION_NOTES.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </div>
        <div className="md:w-1/2">
          {risk.cc != null && risk.oa != null ? (
            <QuadrantChart points={[{ cc: risk.cc, oa: risk.oa, current: true }]} />
          ) : (
            <p className="py-10 text-center text-sm text-slate-400">
              Answer all 14 factors in both sections to plot the risk quadrant.
            </p>
          )}
        </div>
      </div>

      {RISK_SECTION_KEYS.map((section) => {
        const answered = RISK_FACTORS[section].filter((_, i) => run.responses[riskItemKey(section, i)] != null).length;
        const total = RISK_FACTORS[section].length;
        const sum = section === 'cc' ? risk.cc : risk.oa;
        return (
        <div key={section} className="cmt-card">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="font-semibold">{RISK_SECTION_LABELS[section]}</h3>
            <span className="text-sm text-slate-500">
              Sum: <strong>{sum ?? 'NA'}</strong> / 70
              {sum == null && (
                <span className={`ml-2 rounded-full px-2 py-0.5 text-xs font-semibold ${answered > 0 ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-500'}`}>
                  {answered}/{total} answered — the sum appears once every factor is scored
                </span>
              )}
            </span>
          </div>
          <table className="w-full">
            <thead>
              <tr>
                <th className="cmt-th w-8">#</th>
                <th className="cmt-th">Factor</th>
                <th className="cmt-th">Min (1)</th>
                <th className="cmt-th w-44">Score (1–5)</th>
                <th className="cmt-th">Max (5)</th>
              </tr>
            </thead>
            <tbody>
              {RISK_FACTORS[section].map((factor, i) => {
                const key = riskItemKey(section, i);
                const missing = answered > 0 && run.responses[key] == null;
                return (
                  <tr key={key} className={missing ? 'bg-amber-50' : ''}>
                    <td className="cmt-td text-slate-400">{i + 1}</td>
                    <td className="cmt-td font-medium">{factor.factor}</td>
                    <td className="cmt-td text-xs text-slate-500">{factor.min}</td>
                    <td className="cmt-td">
                      <ScorePicker value={run.responses[key]} onChange={(v) => onScore(key, v)} min={1} max={5} />
                    </td>
                    <td className="cmt-td text-xs text-slate-500">{factor.max}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        );
      })}
    </div>
  );
}
