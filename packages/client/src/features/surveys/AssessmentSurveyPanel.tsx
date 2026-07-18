import { useMemo, useState } from 'react';
import { type AssessmentType, surveyStructure } from '@cmt/domain';
import type { SurveyCampaign, SurveyCampaignSummary } from '@cmt/domain';
import type { AssessmentComputed, AssessmentDto, AssessmentSurveyView } from '../../lib/types';
import { MultiSelect } from '../../ui/MultiSelect';
import { useRoles } from '../roles/useRoles';
import { useCampaign, useCampaigns, useCreateCampaign } from './useCampaigns';

/**
 * Practitioner-side survey facilitation for one assessment run: launch a
 * campaign to named role-holders, hand out their tokened links, watch responses
 * arrive, and read the rolled-up result. All assessment types are surveyable.
 * The roll-up itself (superseding hand-entered scores) is applied server-side
 * and already reflected in the editor above — this panel only distributes and
 * reports.
 */
export function AssessmentSurveyPanel({ run, projectId }: { run: AssessmentDto; projectId: string }) {
  const { data: campaigns } = useCampaigns(projectId);
  const summary = campaigns?.find((c) => c.assessmentId === run.id);
  const { data: campaign } = useCampaign(summary?.id ?? '');

  return (
    <section className="cmt-card space-y-4">
      <div>
        <h3 className="font-semibold">Survey campaign</h3>
        <p className="text-sm text-slate-500">
          Send this assessment to named role-holders and let them self-score. Submitted responses
          supersede the hand-entered scores above; the hand-entered values return if the campaign is
          removed.
        </p>
      </div>

      {!summary && <LaunchControl assessmentId={run.id} projectId={projectId} />}
      {campaign && summary && <RecipientList campaign={campaign} summary={summary} />}
      {run.survey && <Results survey={run.survey} type={run.type} />}
    </section>
  );
}

function LaunchControl({ assessmentId, projectId }: { assessmentId: string; projectId: string }) {
  const { data: roles } = useRoles(projectId);
  const create = useCreateCampaign(projectId, assessmentId);
  const [selected, setSelected] = useState<string[]>([]);

  // Only confirmed role-holders (a named person) can be surveyed.
  const options = (roles ?? [])
    .filter((r) => r.personName)
    .map((r) => ({ value: r.id, label: r.roleName ? `${r.personName} — ${r.roleName}` : r.personName! }));

  return (
    <div className="flex items-end gap-2">
      <div className="flex-1">
        <label className="cmt-label">Send as survey to</label>
        <MultiSelect
          options={options}
          selected={selected}
          onChange={setSelected}
          placeholder="Choose role-holders…"
          emptyHint="No named role-holders in this project yet — add people on the Roles page first."
        />
      </div>
      <button
        type="button"
        className="cmt-btn"
        disabled={selected.length === 0 || create.isPending}
        onClick={() => create.mutate(selected, { onSuccess: () => setSelected([]) })}
      >
        {create.isPending ? 'Sending…' : 'Send as survey'}
      </button>
    </div>
  );
}

function RecipientList({ campaign, summary }: { campaign: SurveyCampaign; summary: SurveyCampaignSummary }) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h4 className="text-sm font-semibold">Recipients</h4>
        <span className="text-xs font-medium text-slate-500">
          {summary.submittedCount}/{summary.recipientCount} submitted
        </span>
      </div>
      <table className="w-full">
        <tbody>
          {campaign.recipients.map((r) => (
            <tr key={r.id}>
              <td className="cmt-td">
                {r.personName}
                {r.roleName && <span className="text-slate-400"> — {r.roleName}</span>}
              </td>
              <td className="cmt-td w-28">
                {r.submittedAt ? (
                  <span className="text-xs font-medium text-green-700">Submitted</span>
                ) : (
                  <span className="text-xs text-slate-400">Pending</span>
                )}
              </td>
              <td className="cmt-td w-28 text-right">
                <CopyLinkButton token={r.token} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CopyLinkButton({ token }: { token: string }) {
  const [copied, setCopied] = useState(false);
  const link = `${window.location.origin}/s/${token}`;
  return (
    <button
      type="button"
      className="cmt-btn-secondary"
      title={link}
      onClick={() => {
        void navigator.clipboard?.writeText(link).then(
          () => {
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1500);
          },
          () => {
            /* clipboard blocked — the link stays available via the button title */
          },
        );
      }}
    >
      {copied ? 'Copied' : 'Copy link'}
    </button>
  );
}

function Results({ survey, type }: { survey: AssessmentSurveyView; type: AssessmentType }) {
  const labelByKey = useMemo(() => {
    const map = new Map<string, string>();
    for (const group of surveyStructure(type).groups) {
      for (const item of group.items) map.set(item.key, item.label);
    }
    return map;
  }, [type]);

  return (
    <div className="space-y-3 border-t border-slate-100 pt-3">
      <h4 className="text-sm font-semibold">
        Results — {survey.respondentCount} respondent{survey.respondentCount === 1 ? '' : 's'}
      </h4>

      <div className="space-y-1">
        {Object.entries(survey.distribution).map(([key, dist]) => (
          <div key={key} className="flex items-start gap-2 text-xs">
            <span className="w-56 shrink-0 truncate text-slate-600" title={labelByKey.get(key) ?? key}>
              {labelByKey.get(key) ?? key}
            </span>
            <div className="flex flex-wrap gap-1">
              {Object.entries(dist)
                .sort(([a], [b]) => Number(a) - Number(b))
                .map(([value, count]) => (
                  <span key={value} className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-700">
                    {value}: {count}
                  </span>
                ))}
            </div>
          </div>
        ))}
      </div>

      <div>
        <h5 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Individual submissions
        </h5>
        <ul className="space-y-0.5 text-sm">
          {survey.individuals.map((ind, i) => (
            <li key={i} className="flex justify-between gap-4">
              <span>{ind.personName}</span>
              <span className="text-slate-500">{computedSummary(type, ind.computed)}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/** One-line score summary of a single respondent's computed block, by type. */
function computedSummary(type: AssessmentType, c: AssessmentComputed): string {
  const n = (v: number | null | undefined) => (v == null ? '–' : String(v));
  switch (type) {
    case 'pct': {
      const s = c.pct;
      return s
        ? `S ${n(s.success)} · L ${n(s.leadership)} · PM ${n(s.project_management)} · CM ${n(s.change_management)}`
        : '—';
    }
    case 'risk':
      return c.risk?.quadrant ?? '—';
    case 'adkar':
      return c.adkar?.barrierPoint ? `Barrier: ${c.adkar.barrierPoint}` : 'No barrier';
    case 'sponsor_competency':
    case 'manager_competency':
      return c.competency ? `Total ${c.competency.total}` : '—';
  }
}
