import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ASPECT_KEYS, type OrgGroup } from '@cmt/domain';
import { api } from '../../lib/api';
import { renderWithClient } from '../../test/harness';
import type { GroupDto } from '../../lib/types';
import { OrgGroupLinker } from './OrgGroupLinker';

/**
 * Linking a project group to an org group is what feeds the cross-project
 * saturation heatmap, and it is deliberately manual: the component may
 * *suggest* a name match but must never apply one on its own, because a wrong
 * merge silently corrupts the heatmap with no error anywhere. These cases pin
 * that — especially that rendering a suggestion sends nothing.
 */

afterEach(() => vi.restoreAllMocks());

const group = (over: Partial<GroupDto> = {}): GroupDto => ({
  id: 'g1',
  projectId: 'p1',
  position: 0,
  name: 'Sales Team',
  numPeople: null,
  adoptionUsageDefinition: null,
  uniqueConsiderations: null,
  tags: [],
  orgGroupId: null,
  aspects: ASPECT_KEYS.map((aspectKey) => ({ aspectKey, yesterday: null, tomorrow: null, impact: null })),
  adkar: {},
  adkarAssessmentId: null,
  computed: { aspectsImpacted: 0, degreeOfImpact: null, barrierPoint: null, risk: null },
  ...over,
});

function mockOrgGroups(orgGroups: OrgGroup[]) {
  return vi.spyOn(api, 'get').mockImplementation((url: string) => {
    if (url === '/api/org-groups') return Promise.resolve(orgGroups);
    throw new Error(`unexpected GET ${url}`);
  });
}

const render = (g: GroupDto) => renderWithClient(<OrgGroupLinker projectId="p1" group={g} />);

describe('OrgGroupLinker', () => {
  it('suggests a name match but does not apply it', async () => {
    // Differing case and padding: the match is normalised, the link is not automatic.
    mockOrgGroups([{ id: 'o1', name: '  sales team ', createdAt: 'x' }]);
    const patch = vi.spyOn(api, 'patch').mockResolvedValue(group());
    render(group());

    await screen.findByRole('button', { name: /Link to/ });
    expect(patch).not.toHaveBeenCalled();
    expect(screen.getByRole('combobox')).toHaveValue('');
  });

  it('links to the suggested org group when the practitioner accepts it', async () => {
    mockOrgGroups([{ id: 'o1', name: 'Sales Team', createdAt: 'x' }]);
    const patch = vi.spyOn(api, 'patch').mockResolvedValue(group({ orgGroupId: 'o1' }));
    render(group());

    await userEvent.click(await screen.findByRole('button', { name: /Link to/ }));
    await waitFor(() => expect(patch).toHaveBeenCalledWith('/api/groups/g1', { orgGroupId: 'o1' }));
  });

  it('offers to create one when nothing matches, and links the new group', async () => {
    mockOrgGroups([{ id: 'o9', name: 'Finance', createdAt: 'x' }]);
    const post = vi.spyOn(api, 'post').mockResolvedValue({ id: 'o2', name: 'Sales Team', createdAt: 'x' });
    const patch = vi.spyOn(api, 'patch').mockResolvedValue(group({ orgGroupId: 'o2' }));
    render(group());

    await userEvent.click(await screen.findByRole('button', { name: /Create/ }));
    await waitFor(() => expect(post).toHaveBeenCalledWith('/api/org-groups', { name: 'Sales Team' }));
    // Creating is only useful if it also links — otherwise the group stays out
    // of the heatmap despite the practitioner having acted.
    await waitFor(() => expect(patch).toHaveBeenCalledWith('/api/groups/g1', { orgGroupId: 'o2' }));
  });

  it('offers neither button once the group is already linked', async () => {
    mockOrgGroups([{ id: 'o1', name: 'Sales Team', createdAt: 'x' }]);
    render(group({ orgGroupId: 'o1' }));

    await waitFor(() => expect(screen.getByRole('combobox')).toHaveValue('o1'));
    expect(screen.queryByRole('button', { name: /Link to/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Create/ })).not.toBeInTheDocument();
  });

  it('links straight from the select', async () => {
    mockOrgGroups([{ id: 'o1', name: 'Finance', createdAt: 'x' }]);
    const patch = vi.spyOn(api, 'patch').mockResolvedValue(group());
    render(group());

    // The select renders before the registry query resolves, so wait for the
    // option itself rather than just the combobox.
    await screen.findByRole('option', { name: 'Finance' });
    await userEvent.selectOptions(screen.getByRole('combobox'), 'o1');
    await waitFor(() => expect(patch).toHaveBeenCalledWith('/api/groups/g1', { orgGroupId: 'o1' }));
  });

  it('unlinks by choosing "Not linked", clearing the org group', async () => {
    mockOrgGroups([{ id: 'o1', name: 'Finance', createdAt: 'x' }]);
    const patch = vi.spyOn(api, 'patch').mockResolvedValue(group());
    render(group({ orgGroupId: 'o1' }));

    const select = await screen.findByRole('combobox');
    await waitFor(() => expect(select).toHaveValue('o1'));
    await userEvent.selectOptions(select, screen.getByRole('option', { name: 'Not linked' }));
    await waitFor(() => expect(patch).toHaveBeenCalledWith('/api/groups/g1', { orgGroupId: null }));
  });
});
