import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  ADKAR_ELEMENTS,
  ADKAR_LABELS,
  ASPECTS_OF_CHANGE,
  IMPACT_SCORING_GUIDE,
  adkarItemKey,
} from '@cmt/domain';
import { api } from '../../lib/api';
import type { AssessmentDto, GroupDto } from '../../lib/types';
import { useProject } from '../../app/ProjectLayout';
import { useGroupMutations } from './useGroups';
import { useAssessments, useInvalidateAssessments } from '../assessments/useAssessments';
import { BarrierBadge, HeatCell, RiskBadge, ScorePicker, adkarCellColor, impactCellColor } from '../../ui/scores';
import { TextArea, TextField } from '../../ui/controls';

const TABS = ['Change Impact', 'ADKAR Assessments', 'Risk Assessment'] as const;
type GroupTab = (typeof TABS)[number];

/** Assessment runs list scoped to this group (ADKAR history / group risk). */
function GroupRunsTab(props: {
  projectId: string;
  groupId: string;
  type: 'adkar' | 'risk';
  runs: AssessmentDto[];
}) {
  const invalidate = useInvalidateAssessments(props.projectId);
  const create = useMutation({
    mutationFn: (input: { copyFromLatest?: boolean }) =>
      api.post<AssessmentDto>(`/api/projects/${props.projectId}/assessments`, {
        type: props.type,
        subjectKind: 'group',
        subjectId: props.groupId,
        copyFromLatest: input.copyFromLatest,
      }),
    onSuccess: () => invalidate(),
  });
  const deleteRun = useMutation({
    mutationFn: (id: string) => api.del(`/api/assessments/${id}`),
    onSuccess: () => invalidate(),
  });

  return (
    <div className="cmt-card">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="font-semibold">
          {props.type === 'adkar' ? 'ADKAR assessment history for this group' : 'Risk assessments for this group'}
        </h3>
        <div className="flex gap-1.5">
          {props.runs.length > 0 && (
            <button className="cmt-btn-secondary" onClick={() => create.mutate({ copyFromLatest: true })}>
              Add (copy latest)
            </button>
          )}
          <button className="cmt-btn" onClick={() => create.mutate({})}>
            Add assessment
          </button>
        </div>
      </div>
      {props.runs.length === 0 ? (
        <p className="text-sm text-slate-400">No runs yet for this group.</p>
      ) : (
        <table className="w-full">
          <thead>
            <tr>
              <th className="cmt-th">Run</th>
              <th className="cmt-th w-32">Scheduled</th>
              <th className="cmt-th w-32">Completed</th>
              <th className="cmt-th w-28">Status</th>
              <th className="cmt-th w-44">Result</th>
              <th className="cmt-th w-14"></th>
            </tr>
          </thead>
          <tbody>
            {props.runs.map((run, i) => (
              <tr key={run.id}>
                <td className="cmt-td">
                  <Link
                    to={`/projects/${props.projectId}/assessments/${run.id}`}
                    className="font-medium text-indigo-700 hover:underline"
                  >
                    {run.label ?? `Run ${i + 1}`}
                  </Link>
                </td>
                <td className="cmt-td text-xs text-slate-500">{run.scheduledDate ?? '—'}</td>
                <td className="cmt-td text-xs text-slate-500">{run.completedDate ?? '—'}</td>
                <td className="cmt-td text-xs text-slate-500">{run.status ?? '—'}</td>
                <td className="cmt-td">
                  {props.type === 'adkar' ? (
                    <BarrierBadge barrier={run.computed.adkar?.barrierPoint} />
                  ) : (
                    <span className="flex items-center gap-1.5 text-xs text-slate-600">
                      CC: {run.computed.risk?.cc ?? 'NA'} · OA: {run.computed.risk?.oa ?? 'NA'}{' '}
                      <RiskBadge quadrant={run.computed.risk?.quadrant} />
                    </span>
                  )}
                </td>
                <td className="cmt-td text-right">
                  <button
                    className="cmt-btn-danger"
                    onClick={() => {
                      if (confirm('Delete this run?')) deleteRun.mutate(run.id);
                    }}
                  >
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export function GroupDetailPage() {
  const { projectId } = useProject();
  const { groupId = '' } = useParams();
  const { data: group } = useQuery({
    queryKey: ['groups', projectId, groupId],
    queryFn: () => api.get<GroupDto>(`/api/groups/${groupId}`),
    enabled: groupId !== '',
  });
  const { update, saveAspects, saveAdkar } = useGroupMutations(projectId);
  const { data: allAdkar } = useAssessments(projectId, 'adkar');
  const { data: allRisk } = useAssessments(projectId, 'risk');
  const [showGuide, setShowGuide] = useState(false);
  const [tab, setTab] = useState<GroupTab>('Change Impact');

  if (!group) return null;
  const aspectByKey = new Map(group.aspects.map((a) => [a.aspectKey, a]));
  const groupAdkarRuns = (allAdkar ?? []).filter((r) => r.subjectKind === 'group' && r.subjectId === group.id);
  const groupRiskRuns = (allRisk ?? []).filter((r) => r.subjectKind === 'group' && r.subjectId === group.id);

  return (
    <div className="max-w-5xl space-y-4">
      <div>
        <Link to={`/projects/${projectId}/impact`} className="text-xs font-semibold text-indigo-600 hover:underline">
          ← Define Impact
        </Link>
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold">{group.name}</h2>
          <BarrierBadge barrier={group.computed.barrierPoint} />
          {group.computed.risk && <RiskBadge quadrant={group.computed.risk.quadrant} />}
        </div>
      </div>

      <div className="flex gap-1">
        {TABS.map((t) => (
          <button
            key={t}
            className={`rounded-t px-3 py-1.5 text-sm font-medium ${
              tab === t ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'
            }`}
            onClick={() => setTab(t)}
          >
            {t}
            {t === 'ADKAR Assessments' && groupAdkarRuns.length > 0 && ` (${groupAdkarRuns.length})`}
            {t === 'Risk Assessment' && groupRiskRuns.length > 0 && ` (${groupRiskRuns.length})`}
          </button>
        ))}
      </div>

      {tab === 'ADKAR Assessments' && (
        <GroupRunsTab projectId={projectId} groupId={group.id} type="adkar" runs={groupAdkarRuns} />
      )}
      {tab === 'Risk Assessment' && (
        <GroupRunsTab projectId={projectId} groupId={group.id} type="risk" runs={groupRiskRuns} />
      )}

      {tab !== 'Change Impact' ? null : (
      <>


      <div className="cmt-card grid gap-3 md:grid-cols-2">
        <div>
          <label className="cmt-label">Impacted Group Name</label>
          <TextField
            value={group.name}
            onSave={(v) => v && update.mutate({ id: group.id, fields: { name: v } })}
          />
        </div>
        <div>
          <label className="cmt-label">Definition of Adoption and Usage for the Group</label>
          <TextArea
            value={group.adoptionUsageDefinition}
            onSave={(v) => update.mutate({ id: group.id, fields: { adoptionUsageDefinition: v } })}
          />
        </div>
      </div>

      <div className="cmt-card">
        <div className="mb-1 flex items-center justify-between">
          <h3 className="font-semibold">
            Define and Assess the Degree of Impact Using the 10 Aspects of Change Impact
          </h3>
          <div className="flex items-center gap-4 text-sm">
            <span>
              Aspects impacted: <strong>{group.computed.aspectsImpacted}</strong>
            </span>
            <span className="flex items-center gap-1.5">
              Degree of impact: <HeatCell value={group.computed.degreeOfImpact} colorFor={impactCellColor} />
            </span>
          </div>
        </div>
        <button className="mb-2 text-xs font-medium text-indigo-600 hover:underline" onClick={() => setShowGuide(!showGuide)}>
          {showGuide ? 'Hide scoring guide' : 'Show scoring guide'}
        </button>
        {showGuide && <p className="mb-3 rounded bg-indigo-50 p-3 text-xs leading-relaxed text-slate-600">{IMPACT_SCORING_GUIDE}</p>}
        <table className="w-full">
          <thead>
            <tr>
              <th className="cmt-th w-44">Aspect</th>
              <th className="cmt-th">Yesterday (before the change)</th>
              <th className="cmt-th">Tomorrow (after the change)</th>
              <th className="cmt-th w-52">Degree of Impact (0–5)</th>
            </tr>
          </thead>
          <tbody>
            {ASPECTS_OF_CHANGE.map((aspect) => {
              const row = aspectByKey.get(aspect.key);
              return (
                <tr key={aspect.key}>
                  <td className="cmt-td font-medium" title={aspect.definition}>
                    {aspect.label}
                  </td>
                  <td className="cmt-td">
                    <TextArea
                      rows={1}
                      value={row?.yesterday}
                      onSave={(v) => saveAspects.mutate({ id: group.id, aspects: [{ aspectKey: aspect.key, yesterday: v }] })}
                    />
                  </td>
                  <td className="cmt-td">
                    <TextArea
                      rows={1}
                      value={row?.tomorrow}
                      onSave={(v) => saveAspects.mutate({ id: group.id, aspects: [{ aspectKey: aspect.key, tomorrow: v }] })}
                    />
                  </td>
                  <td className="cmt-td">
                    <ScorePicker
                      value={row?.impact}
                      min={0}
                      max={5}
                      colorFor={impactCellColor}
                      onChange={(v) => saveAspects.mutate({ id: group.id, aspects: [{ aspectKey: aspect.key, impact: v }] })}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="cmt-card">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="font-semibold">ADKAR Assessment and Barrier Point for the group</h3>
          <BarrierBadge barrier={group.computed.barrierPoint} />
        </div>
        <table className="w-full max-w-md">
          <tbody>
            {ADKAR_ELEMENTS.map((el) => (
              <tr key={el}>
                <td className="cmt-td w-36 font-medium">{ADKAR_LABELS[el]}</td>
                <td className="cmt-td">
                  <ScorePicker
                    value={group.adkar[el]}
                    min={1}
                    max={5}
                    colorFor={adkarCellColor}
                    onChange={(v) => saveAdkar.mutate({ id: group.id, responses: { [adkarItemKey(el)]: v } })}
                  />
                </td>
                <td className="cmt-td text-center">
                  <HeatCell value={group.adkar[el]} colorFor={adkarCellColor} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 text-xs text-slate-400">
          Score 1–5. The barrier point is the first ADKAR element scoring 3 or below.
        </p>
      </div>

      <div className="cmt-card">
        <label className="cmt-label">Unique Group Considerations</label>
        <TextArea
          rows={3}
          value={group.uniqueConsiderations}
          onSave={(v) => update.mutate({ id: group.id, fields: { uniqueConsiderations: v } })}
        />
      </div>
      </>
      )}
    </div>
  );
}
