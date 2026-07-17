import {
  MANAGER_COMPETENCY_SCALE,
  MANAGER_COMPETENCY_SECTIONS,
  SPONSOR_COMPETENCY_SCALE,
  SPONSOR_COMPETENCY_SECTIONS,
  SPONSOR_INTERPRETATION,
  competencyItemKey,
} from '@cmt/domain';
import type { AssessmentDto } from '../../lib/types';
import { ScorePicker } from '../../ui/scores';

export function CompetencyEditor(props: {
  run: AssessmentDto;
  onScore: (itemKey: string, value: number | null) => void;
}) {
  const { run, onScore } = props;
  const kind = run.type === 'sponsor_competency' ? 'sponsor' : 'manager';
  const sections = kind === 'sponsor' ? SPONSOR_COMPETENCY_SECTIONS : MANAGER_COMPETENCY_SECTIONS;
  const scale = kind === 'sponsor' ? SPONSOR_COMPETENCY_SCALE : MANAGER_COMPETENCY_SCALE;
  const computed = run.computed.competency!;

  return (
    <div className="space-y-4">
      <div className="cmt-card flex items-center justify-between">
        <div>
          <h3 className="font-semibold">Sum of scores (out of 100 total)</h3>
          {kind === 'sponsor' && <p className="text-xs text-slate-500">{SPONSOR_INTERPRETATION}</p>}
          <p className="text-xs text-slate-400">
            Scale: {scale.min} … {scale.max}
          </p>
        </div>
        <div className="text-right">
          <div className="text-3xl font-bold text-indigo-700">{computed.total}</div>
          {computed.interpretation && <div className="text-sm font-medium text-slate-600">{computed.interpretation}</div>}
        </div>
      </div>

      {sections.map((section) => (
        <div key={section.key} className="cmt-card">
          <h3 className="mb-2 font-semibold">{section.title}</h3>
          <table className="w-full">
            <tbody>
              {section.items.map((item, i) => {
                const key = competencyItemKey(kind, section.key, i);
                return (
                  <tr key={key}>
                    <td className="cmt-td">{item}</td>
                    <td className="cmt-td w-44">
                      <ScorePicker value={run.responses[key]} onChange={(v) => onScore(key, v)} min={1} max={5} />
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
