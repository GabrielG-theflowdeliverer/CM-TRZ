import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ADAPT_ACTIONS_PROMPTS } from '@cmt/domain';
import { api } from '../../lib/api';
import type { AdaptAction } from '../../lib/types';
import { useProject } from '../../app/ProjectLayout';
import { TextArea } from '../../ui/controls';

export function AdaptActionsPage() {
  const { projectId } = useProject();
  const queryClient = useQueryClient();
  const { data: blocks } = useQuery({
    queryKey: ['adapt', projectId],
    queryFn: () => api.get<AdaptAction[]>(`/api/projects/${projectId}/adapt-actions`),
    enabled: projectId !== '',
  });
  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ['adapt', projectId] });
  const create = useMutation({
    mutationFn: () => api.post<AdaptAction>(`/api/projects/${projectId}/adapt-actions`, {}),
    onSuccess: invalidate,
  });
  const update = useMutation({
    mutationFn: (input: { id: string; fields: Record<string, unknown> }) =>
      api.patch<AdaptAction>(`/api/adapt-actions/${input.id}`, input.fields),
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.del(`/api/adapt-actions/${id}`),
    onSuccess: invalidate,
  });

  return (
    <div className="max-w-4xl space-y-4">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-xl font-bold">Adapt Actions</h2>
          <p className="text-sm text-slate-500">
            What → So What → Now What: turn assessment results into corrective action.
          </p>
        </div>
        <button className="cmt-btn" onClick={() => create.mutate()}>
          Add block
        </button>
      </div>

      {(blocks ?? []).length === 0 && (
        <div className="cmt-card py-10 text-center text-sm text-slate-400">No adapt-action blocks yet.</div>
      )}

      {(blocks ?? []).map((block, i) => (
        <section key={block.id} className="cmt-card">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="font-semibold">Block {i + 1}</h3>
            <button
              className="cmt-btn-danger"
              onClick={() => {
                if (confirm('Delete this block?')) remove.mutate(block.id);
              }}
            >
              Delete
            </button>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <div>
              <h4 className="mb-1 text-sm font-bold text-indigo-700">{ADAPT_ACTIONS_PROMPTS.what}</h4>
              <label className="cmt-label">{ADAPT_ACTIONS_PROMPTS.observations}</label>
              <TextArea
                rows={4}
                value={block.observations}
                onSave={(v) => update.mutate({ id: block.id, fields: { observations: v } })}
              />
            </div>
            <div>
              <h4 className="mb-1 text-sm font-bold text-indigo-700">{ADAPT_ACTIONS_PROMPTS.soWhat}</h4>
              <label className="cmt-label">{ADAPT_ACTIONS_PROMPTS.implications}</label>
              <TextArea
                rows={4}
                value={block.implications}
                onSave={(v) => update.mutate({ id: block.id, fields: { implications: v } })}
              />
            </div>
            <div>
              <h4 className="mb-1 text-sm font-bold text-indigo-700">{ADAPT_ACTIONS_PROMPTS.nowWhat}</h4>
              <label className="cmt-label">{ADAPT_ACTIONS_PROMPTS.actionSteps}</label>
              <TextArea
                rows={4}
                value={block.actionSteps}
                onSave={(v) => update.mutate({ id: block.id, fields: { actionSteps: v } })}
              />
            </div>
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-4">
            {(
              [
                ['assessmentResults', ADAPT_ACTIONS_PROMPTS.assessmentResults],
                ['strengths', ADAPT_ACTIONS_PROMPTS.strengths],
                ['opportunities', ADAPT_ACTIONS_PROMPTS.opportunities],
                ['notes', 'Notes:'],
              ] as const
            ).map(([field, label]) => (
              <div key={field}>
                <label className="cmt-label">{label}</label>
                <TextArea
                  rows={2}
                  value={block[field]}
                  onSave={(v) => update.mutate({ id: block.id, fields: { [field]: v } })}
                />
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
