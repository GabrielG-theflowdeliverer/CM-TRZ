import { WHY_CM_PROMPTS } from '@cmt/domain';
import { useProject } from '../../app/ProjectLayout';
import { TextArea } from '../../ui/controls';
import { useDoc } from './useDoc';
import { DocHeader } from './DocHeader';

const COST_RISK_FIELDS = [
  { cost: 'cost_individuals', risk: 'risk_individuals', label: WHY_CM_PROMPTS.costRiskRows[0]! },
  { cost: 'cost_project', risk: 'risk_project', label: WHY_CM_PROMPTS.costRiskRows[1]! },
  { cost: 'cost_organization', risk: 'risk_organization', label: WHY_CM_PROMPTS.costRiskRows[2]! },
  { cost: 'cost_results', risk: 'risk_results', label: WHY_CM_PROMPTS.costRiskRows[3]! },
];

export function WhyCmPage() {
  const { projectId } = useProject();
  const { doc, saveField, complete, toggleComplete } = useDoc(projectId, 'why_cm');
  if (!doc) return null;
  return (
    <div className="max-w-3xl space-y-4">
      <DocHeader title="The Value of CM" subtitle={WHY_CM_PROMPTS.title} complete={complete} onToggle={toggleComplete} />

      <div className="cmt-card space-y-3">
        <h3 className="font-semibold">{WHY_CM_PROMPTS.humanFactorsTitle}</h3>
        {(
          [
            ['speed_of_adoption', WHY_CM_PROMPTS.speedOfAdoption],
            ['ultimate_utilization', WHY_CM_PROMPTS.ultimateUtilization],
            ['proficiency', WHY_CM_PROMPTS.proficiency],
            ['human_factors_notes', 'Notes:'],
          ] as const
        ).map(([field, prompt]) => (
          <div key={field}>
            <p className="mb-1 text-xs text-slate-500">{prompt}</p>
            <TextArea rows={2} value={doc[field]} onSave={(v) => saveField(field, v)} />
          </div>
        ))}
      </div>

      <div className="cmt-card space-y-3">
        <h3 className="font-semibold">{WHY_CM_PROMPTS.peopleDependentRoiTitle}</h3>
        {(
          [
            ['people_dependent_roi', WHY_CM_PROMPTS.peopleDependentRoi],
            ['investment', WHY_CM_PROMPTS.investment],
            ['roi_notes', 'Notes:'],
          ] as const
        ).map(([field, prompt]) => (
          <div key={field}>
            <p className="mb-1 text-xs text-slate-500">{prompt}</p>
            <TextArea rows={2} value={doc[field]} onSave={(v) => saveField(field, v)} />
          </div>
        ))}
      </div>

      <div className="cmt-card">
        <h3 className="mb-2 font-semibold">{WHY_CM_PROMPTS.costsAndRisksTitle}</h3>
        <table className="w-full">
          <thead>
            <tr>
              <th className="cmt-th w-1/3"></th>
              <th className="cmt-th">Costs</th>
              <th className="cmt-th">Risks</th>
            </tr>
          </thead>
          <tbody>
            {COST_RISK_FIELDS.map((row) => (
              <tr key={row.cost}>
                <td className="cmt-td text-xs font-medium text-slate-600">{row.label}</td>
                <td className="cmt-td">
                  <TextArea rows={2} value={doc[row.cost]} onSave={(v) => saveField(row.cost, v)} />
                </td>
                <td className="cmt-td">
                  <TextArea rows={2} value={doc[row.risk]} onSave={(v) => saveField(row.risk, v)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
