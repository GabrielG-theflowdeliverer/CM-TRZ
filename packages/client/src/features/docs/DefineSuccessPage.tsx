import { DEFINE_SUCCESS_PROMPTS } from '@cmt/domain';
import { useProject } from '../../app/ProjectLayout';
import { TextArea } from '../../ui/controls';
import { useDoc } from './useDoc';

const FOUR_PS: Array<{ field: string; title: string; prompt: string }> = [
  { field: 'project', title: 'Project', prompt: DEFINE_SUCCESS_PROMPTS.project },
  { field: 'purpose', title: 'Purpose', prompt: DEFINE_SUCCESS_PROMPTS.purpose },
  { field: 'particulars', title: 'Particulars', prompt: DEFINE_SUCCESS_PROMPTS.particulars },
  { field: 'people', title: 'People', prompt: DEFINE_SUCCESS_PROMPTS.people },
];

export function DefineSuccessPage() {
  const { projectId } = useProject();
  const { doc, saveField } = useDoc(projectId, 'define_success');
  if (!doc) return null;
  return (
    <div className="max-w-3xl space-y-4">
      <div>
        <h2 className="text-xl font-bold">4 P’s to Define Success</h2>
        <p className="text-sm text-slate-500">Phase 1 — Prepare Approach.</p>
      </div>
      {FOUR_PS.map((p) => (
        <div key={p.field} className="cmt-card">
          <h3 className="font-semibold">{p.title}</h3>
          <p className="mb-2 text-xs text-slate-500">{p.prompt}</p>
          <TextArea rows={3} value={doc[p.field]} onSave={(v) => saveField(p.field, v)} />
        </div>
      ))}
      <div className="cmt-card border-indigo-200 bg-indigo-50/40">
        <h3 className="font-semibold">{DEFINE_SUCCESS_PROMPTS.keyQuestionTitle}</h3>
        <p className="mb-2 text-xs text-slate-500">{DEFINE_SUCCESS_PROMPTS.keyQuestion}</p>
        <TextArea rows={2} value={doc.adoption_percentage} onSave={(v) => saveField('adoption_percentage', v)} />
      </div>
    </div>
  );
}
