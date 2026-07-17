import { describe, expect, it } from 'vitest';
import type { Activity } from '../../lib/types';
import { buildSections } from './ActivitiesWorkbenchPage';

function activity(partial: Partial<Activity>): Activity {
  return {
    id: partial.id ?? 'a1',
    projectId: 'p',
    position: 0,
    name: partial.name ?? 'Activity',
    methodMechanism: null,
    rolesRequiredText: null,
    responsible: null,
    startDate: null,
    finishDate: null,
    status: partial.status ?? null,
    resultFeedback: null,
    overall: partial.overall ?? false,
    adkarOutcomes: partial.adkarOutcomes ?? [],
    groupIds: partial.groupIds ?? [],
    planIds: partial.planIds ?? [],
    blueprintIds: partial.blueprintIds ?? [],
    roleIds: partial.roleIds ?? [],
  };
}

const ctx = {
  plans: [{ id: 'plan1', name: 'Comms' }, { id: 'plan2', name: 'Training' }] as never,
  groups: [{ id: 'g1', name: 'Sales' }],
  roles: [] as never,
  blueprints: [] as never,
};

describe('buildSections (group-by switcher)', () => {
  const shared = activity({ id: 'x', adkarOutcomes: ['awareness', 'desire'], planIds: ['plan1', 'plan2'], groupIds: ['g1'] });
  const orphan = activity({ id: 'y', name: 'Orphan' });

  it('shows a multi-linked activity under every matching ADKAR section', () => {
    const sections = buildSections('adkar', [shared, orphan], ctx);
    const bySection = Object.fromEntries(sections.map((s) => [s.key, s.activities.map((a) => a.id)]));
    expect(bySection.awareness).toEqual(['x']);
    expect(bySection.desire).toEqual(['x']);
    expect(bySection.knowledge).toEqual([]);
    expect(bySection._none).toEqual(['y']); // unassigned bucket
  });

  it('shows a multi-plan activity under each of its plans', () => {
    const sections = buildSections('plan', [shared, orphan], ctx);
    const bySection = Object.fromEntries(sections.map((s) => [s.key, s.activities.map((a) => a.id)]));
    expect(bySection.plan1).toEqual(['x']);
    expect(bySection.plan2).toEqual(['x']);
    expect(bySection._none).toEqual(['y']);
  });

  it('separates Overall Change from specific groups', () => {
    const overallActivity = activity({ id: 'o', overall: true });
    const sections = buildSections('group', [shared, overallActivity], ctx);
    const bySection = Object.fromEntries(sections.map((s) => [s.key, s.activities.map((a) => a.id)]));
    expect(bySection._overall).toEqual(['o']);
    expect(bySection.g1).toEqual(['x']);
  });

  it('treats missing status as Not Started', () => {
    const sections = buildSections('status', [activity({ id: 'n', status: null })], ctx);
    const notStarted = sections.find((s) => s.key === 'Not Started');
    expect(notStarted?.activities.map((a) => a.id)).toEqual(['n']);
  });
});
