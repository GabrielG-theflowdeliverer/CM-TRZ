import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ACTIVITY_GROUP_BY,
  ACTIVITY_GROUP_BY_LABELS,
  ACTIVITY_STATUSES,
  ADKAR_ELEMENTS,
  ADKAR_LABELS,
  type ActivityGroupBy,
} from '@cmt/domain';
import { api } from '../../lib/api';
import type { Activity, BlueprintDto, PlanDto, RoleDto } from '../../lib/types';
import { useProject } from '../../app/ProjectLayout';
import { useGroups } from '../impact/useGroups';
import { usePlans } from '../plans/usePlans';
import { useBlueprints } from '../blueprints/useBlueprints';
import { ActivityTable, roleLabel, type ActivityTableContext } from './ActivityTable';
import { useActivities, useActivityMutations } from './useActivities';

interface Section {
  key: string;
  title: string;
  activities: Activity[];
  /** Defaults applied when adding an activity inside this section. */
  defaults: Record<string, unknown>;
}

export function buildSections(
  groupBy: ActivityGroupBy,
  activities: Activity[],
  ctx: { plans: PlanDto[]; groups: { id: string; name: string }[]; roles: RoleDto[]; blueprints: BlueprintDto[] },
): Section[] {
  switch (groupBy) {
    case 'adkar': {
      const sections: Section[] = ADKAR_ELEMENTS.map((el) => ({
        key: el,
        title: ADKAR_LABELS[el],
        activities: activities.filter((a) => a.adkarOutcomes.includes(el)),
        defaults: { adkarOutcomes: [el] },
      }));
      const none = activities.filter((a) => a.adkarOutcomes.length === 0);
      if (none.length) sections.push({ key: '_none', title: 'No ADKAR outcome yet', activities: none, defaults: {} });
      return sections;
    }
    case 'plan': {
      const sections: Section[] = ctx.plans.map((p) => ({
        key: p.id,
        title: p.name,
        activities: activities.filter((a) => a.planIds.includes(p.id)),
        defaults: { planIds: [p.id] },
      }));
      const none = activities.filter((a) => a.planIds.length === 0);
      if (none.length) sections.push({ key: '_none', title: 'Not in any plan', activities: none, defaults: {} });
      return sections;
    }
    case 'group': {
      const sections: Section[] = [
        {
          key: '_overall',
          title: 'Overall Change',
          activities: activities.filter((a) => a.overall),
          defaults: { overall: true },
        },
        ...ctx.groups.map((g) => ({
          key: g.id,
          title: g.name,
          activities: activities.filter((a) => a.groupIds.includes(g.id)),
          defaults: { groupIds: [g.id], overall: false },
        })),
      ];
      return sections;
    }
    case 'role': {
      const sections: Section[] = ctx.roles.map((r) => ({
        key: r.id,
        title: roleLabel(r),
        activities: activities.filter((a) => a.roleIds.includes(r.id)),
        defaults: { roleIds: [r.id] },
      }));
      const none = activities.filter((a) => a.roleIds.length === 0);
      if (none.length) sections.push({ key: '_none', title: 'No role assigned', activities: none, defaults: {} });
      return sections.filter((s) => s.key === '_none' || true);
    }
    case 'status':
      return ACTIVITY_STATUSES.map((status) => ({
        key: status,
        title: status,
        activities: activities.filter((a) => (a.status ?? 'Not Started') === status),
        defaults: { status },
      }));
  }
}

export function ActivitiesWorkbenchPage() {
  const { projectId } = useProject();
  const [groupBy, setGroupBy] = useState<ActivityGroupBy>('adkar');
  const { data: activities } = useActivities(projectId);
  const { data: groups } = useGroups(projectId);
  const { data: plans } = usePlans(projectId);
  const { data: blueprints } = useBlueprints(projectId);
  const { data: roles } = useQuery({
    queryKey: ['roles', projectId],
    queryFn: () => api.get<RoleDto[]>(`/api/projects/${projectId}/roles`),
    enabled: projectId !== '',
  });
  const mutations = useActivityMutations(projectId);

  const sections = useMemo(
    () =>
      buildSections(groupBy, activities ?? [], {
        plans: plans ?? [],
        groups: groups ?? [],
        roles: roles ?? [],
        blueprints: blueprints ?? [],
      }),
    [groupBy, activities, plans, groups, roles, blueprints],
  );

  const ctx: ActivityTableContext = {
    groups: groups ?? [],
    plans: plans ?? [],
    blueprints: blueprints ?? [],
    roles: roles ?? [],
    onUpdate: (id, fields) => mutations.update.mutate({ id, fields }),
    onDelete: (id) => mutations.remove.mutate(id),
  };

  return (
    <div className="max-w-full space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">Blueprints & Plans — Activities</h2>
          <p className="text-sm text-slate-500">
            One interconnected activity list: view it from the ADKAR blueprint perspective, the plan perspective, or by
            group, role and status.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold uppercase text-slate-500">Group by</label>
          <select className="cmt-input w-44" value={groupBy} onChange={(e) => setGroupBy(e.target.value as ActivityGroupBy)}>
            {ACTIVITY_GROUP_BY.map((g) => (
              <option key={g} value={g}>
                {ACTIVITY_GROUP_BY_LABELS[g]}
              </option>
            ))}
          </select>
          <button className="cmt-btn" onClick={() => mutations.create.mutate({ name: null })}>
            Add activity
          </button>
        </div>
      </div>

      {sections.map((section) => (
        <section key={section.key} className="cmt-card">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="font-bold text-indigo-800">
              {section.title} <span className="text-xs font-normal text-slate-400">({section.activities.length})</span>
            </h3>
            {!section.key.startsWith('_none') && (
              <button className="cmt-btn-secondary" onClick={() => mutations.create.mutate(section.defaults)}>
                Add activity
              </button>
            )}
          </div>
          <ActivityTable activities={section.activities} ctx={ctx} />
        </section>
      ))}
    </div>
  );
}
