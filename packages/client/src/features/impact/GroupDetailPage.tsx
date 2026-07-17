import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ADKAR_ELEMENTS,
  ADKAR_LABELS,
  ASPECTS_OF_CHANGE,
  IMPACT_SCORING_GUIDE,
  adkarItemKey,
} from '@cmt/domain';
import { api } from '../../lib/api';
import type { GroupDto } from '../../lib/types';
import { useProject } from '../../app/ProjectLayout';
import { useGroupMutations } from './useGroups';
import { BarrierBadge, HeatCell, ScorePicker, adkarCellColor, impactCellColor } from '../../ui/scores';
import { TextArea, TextField } from '../../ui/controls';

export function GroupDetailPage() {
  const { projectId } = useProject();
  const { groupId = '' } = useParams();
  const { data: group } = useQuery({
    queryKey: ['groups', projectId, groupId],
    queryFn: () => api.get<GroupDto>(`/api/groups/${groupId}`),
    enabled: groupId !== '',
  });
  const { update, saveAspects, saveAdkar } = useGroupMutations(projectId);
  const [showGuide, setShowGuide] = useState(false);

  if (!group) return null;
  const aspectByKey = new Map(group.aspects.map((a) => [a.aspectKey, a]));

  return (
    <div className="max-w-5xl space-y-4">
      <div>
        <Link to={`/projects/${projectId}/impact`} className="text-xs font-semibold text-indigo-600 hover:underline">
          ← Define Impact
        </Link>
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold">{group.name}</h2>
          <BarrierBadge barrier={group.computed.barrierPoint} />
        </div>
      </div>

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
    </div>
  );
}
