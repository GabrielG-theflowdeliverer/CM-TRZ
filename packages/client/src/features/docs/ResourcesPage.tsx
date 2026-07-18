import { RESOURCES_PROMPTS } from '@cmt/domain';
import { useProject } from '../../app/ProjectLayout';
import { TextArea } from '../../ui/controls';
import { useDoc } from './useDoc';
import { DocHeader } from './DocHeader';

export function ResourcesPage() {
  const { projectId } = useProject();
  const { doc, saveField, complete, toggleComplete } = useDoc(projectId, 'resources');
  if (!doc) return null;
  const field = (key: string, label: string, rows = 2) => (
    <div key={key}>
      <p className="mb-1 text-xs font-medium text-slate-600">{label}</p>
      <TextArea rows={rows} value={doc[key]} onSave={(v) => saveField(key, v)} />
    </div>
  );
  return (
    <div className="max-w-3xl space-y-4">
      <DocHeader
        title="Resources & Governance"
        subtitle="Define Approach — Resources."
        complete={complete}
        onToggle={toggleComplete}
      />
      <div className="cmt-card space-y-3">
        <h3 className="font-semibold">{RESOURCES_PROMPTS.governanceTitle}</h3>
        {field('governance_description', RESOURCES_PROMPTS.governanceDescription, 3)}
        {field('advantages', RESOURCES_PROMPTS.advantages)}
        {field('implications', RESOURCES_PROMPTS.implications)}
        {field('sponsor_access', RESOURCES_PROMPTS.sponsorAccess)}
        {field('action_items', RESOURCES_PROMPTS.actionItems)}
      </div>
      <div className="cmt-card space-y-3">
        <h3 className="font-semibold">{RESOURCES_PROMPTS.budgetTitle}</h3>
        {field('budget_prepare', RESOURCES_PROMPTS.budgetPrepare)}
        {field('budget_manage', RESOURCES_PROMPTS.budgetManage)}
        {field('budget_sustain', RESOURCES_PROMPTS.budgetSustain)}
        {field('budget_source', RESOURCES_PROMPTS.budgetSource)}
        {field('budget_sufficiency', RESOURCES_PROMPTS.budgetSufficiency)}
        {field('notes', 'Notes:')}
      </div>
    </div>
  );
}
