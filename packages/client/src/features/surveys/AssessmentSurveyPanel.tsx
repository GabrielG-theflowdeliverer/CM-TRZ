import { Fragment, useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { type AssessmentType, surveyStructure } from '@cmt/domain';
import type { SurveyCampaign, SurveyCampaignSummary } from '@cmt/domain';
import type { AssessmentDto, AssessmentSurveyView } from '../../lib/types';
import { MultiSelect } from '../../ui/MultiSelect';
import { useRoles } from '../roles/useRoles';
import { useCampaign, useCampaigns, useCreateCampaign, useDeleteCampaign } from './useCampaigns';

/**
 * Practitioner-side survey facilitation for one assessment run: launch a
 * campaign to named role-holders, hand out their tokened links, watch responses
 * arrive, and read the rolled-up result. All assessment types are surveyable.
 * The roll-up itself (superseding hand-entered scores) is applied server-side
 * and already reflected in the editor above — this panel only distributes and
 * reports.
 */
export function AssessmentSurveyPanel({ run, projectId }: { run: AssessmentDto; projectId: string }) {
  const queryClient = useQueryClient();
  const { data: campaigns } = useCampaigns(projectId);
  const summary = campaigns?.find((c) => c.assessmentId === run.id);
  const { data: campaign } = useCampaign(summary?.id ?? '');

  // The roll-up lives on the assessment (`run.survey`), which this panel
  // receives as a prop. When polling shows the submitted count has moved,
  // refresh the assessment so the results matrix and computed scores keep up.
  const submittedCount = summary?.submittedCount;
  useEffect(() => {
    if (submittedCount !== undefined) {
      void queryClient.invalidateQueries({ queryKey: ['assessment', run.id] });
    }
  }, [submittedCount, run.id, queryClient]);

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
      {campaign && summary && (
        <RecipientList campaign={campaign} summary={summary} projectId={projectId} assessmentId={run.id} />
      )}
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

function RecipientList({
  campaign,
  summary,
  projectId,
  assessmentId,
}: {
  campaign: SurveyCampaign;
  summary: SurveyCampaignSummary;
  projectId: string;
  assessmentId: string;
}) {
  const remove = useDeleteCampaign(projectId, assessmentId);
  const onRemove = () => {
    // Destructive: submitted responses go with the campaign; scoring reverts
    // to the hand-entered values. Make the practitioner say so explicitly.
    if (
      window.confirm(
        `Remove this campaign? ${summary.submittedCount} submitted response${
          summary.submittedCount === 1 ? '' : 's'
        } will be deleted and scoring reverts to the hand-entered values. A new campaign can then be launched.`,
      )
    ) {
      remove.mutate(campaign.id);
    }
  };

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h4 className="text-sm font-semibold">Recipients</h4>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-slate-500">
            {summary.submittedCount}/{summary.recipientCount} submitted
          </span>
          <button
            type="button"
            className="cmt-btn-secondary text-xs"
            disabled={remove.isPending}
            onClick={onRemove}
          >
            {remove.isPending ? 'Removing…' : 'Remove campaign'}
          </button>
        </div>
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

/**
 * Distinct colour per respondent column so a person's answers and section
 * totals are easy to track across the matrix and compare side by side. Static
 * class strings (not interpolated) so Tailwind keeps them.
 */
const RESPONDENT_COLORS = [
  { head: 'bg-indigo-100 text-indigo-900', cell: 'bg-indigo-50', total: 'bg-indigo-200 text-indigo-900' },
  { head: 'bg-emerald-100 text-emerald-900', cell: 'bg-emerald-50', total: 'bg-emerald-200 text-emerald-900' },
  { head: 'bg-amber-100 text-amber-900', cell: 'bg-amber-50', total: 'bg-amber-200 text-amber-900' },
  { head: 'bg-rose-100 text-rose-900', cell: 'bg-rose-50', total: 'bg-rose-200 text-rose-900' },
  { head: 'bg-sky-100 text-sky-900', cell: 'bg-sky-50', total: 'bg-sky-200 text-sky-900' },
  { head: 'bg-violet-100 text-violet-900', cell: 'bg-violet-50', total: 'bg-violet-200 text-violet-900' },
] as const;

/**
 * Section total = sum of a respondent's answers for the section, but only once
 * every item is answered. This matches the domain scoring rule (e.g. a PCT
 * aspect scores null until all its factors are in), so the matrix never shows a
 * partial sum that disagrees with the assessment's official score.
 */
function sectionTotal(responses: Record<string, number | null>, items: { key: string }[]): number | null {
  let sum = 0;
  for (const item of items) {
    const v = responses[item.key];
    if (v == null) return null; // incomplete section — no total yet
    sum += v;
  }
  return items.length === 0 ? null : sum;
}

/**
 * Side-by-side results matrix: one colour-coded column per respondent (name on
 * top), each factor's answer in their column, and a per-section total row — so
 * differences between people are easy to spot and discuss.
 */
function Results({ survey, type }: { survey: AssessmentSurveyView; type: AssessmentType }) {
  const groups = surveyStructure(type).groups;
  const people = survey.individuals;
  const colorOf = (i: number) => RESPONDENT_COLORS[i % RESPONDENT_COLORS.length]!;

  return (
    <div className="space-y-2 border-t border-slate-100 pt-3">
      <h4 className="text-sm font-semibold">
        Results — {survey.respondentCount} respondent{survey.respondentCount === 1 ? '' : 's'}
      </h4>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className="cmt-th text-left">Factor</th>
              {people.map((p, i) => (
                <th key={i} className={`cmt-th w-16 text-center ${colorOf(i).head}`} title={p.personName}>
                  {p.personName}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {groups.map((group) => (
              <Fragment key={group.title}>
                <tr>
                  <td
                    colSpan={people.length + 1}
                    className="bg-slate-50 px-2 py-1 text-xs font-semibold uppercase tracking-wide text-slate-500"
                  >
                    {group.title}
                  </td>
                </tr>
                {group.items.map((item) => (
                  <tr key={item.key}>
                    <td className="cmt-td text-slate-600" title={item.label}>
                      {item.label}
                    </td>
                    {people.map((p, i) => (
                      <td key={i} className={`cmt-td text-center tabular-nums ${colorOf(i).cell}`}>
                        {p.responses[item.key] ?? '–'}
                      </td>
                    ))}
                  </tr>
                ))}
                <tr>
                  <td className="cmt-td text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Section total
                  </td>
                  {people.map((p, i) => (
                    <td
                      key={i}
                      className={`cmt-td text-center font-semibold tabular-nums ${colorOf(i).total}`}
                    >
                      {sectionTotal(p.responses, group.items) ?? '–'}
                    </td>
                  ))}
                </tr>
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
