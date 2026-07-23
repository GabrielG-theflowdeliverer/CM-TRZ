import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { adkarItemKey } from '@cmt/domain';
import { api } from '../../lib/api';
import { renderWithClient } from '../../test/harness';
import type { Project, RoleDto } from '../../lib/types';
import { RolesPage } from './RolesPage';

const project: Project = {
  id: 'p1',
  name: 'P',
  projectType: null,
  pmApproach: null,
  status: 'Active',
  watchGroupIds: [],
  createdAt: '2026-07-18T00:00:00.000Z',
  updatedAt: '2026-07-18T00:00:00.000Z',
};

const role = (over: Partial<RoleDto> = {}): RoleDto =>
  ({
    id: 'r1',
    projectId: 'p1',
    roster: 'core',
    position: 0,
    roleName: null,
    personName: null,
    roleDefinition: null,
    support: null,
    influence: null,
    activationTactics: null,
    groupIds: [],
    adkar: {},
    adkarAssessmentId: null,
    computed: { barrierPoint: null },
    ...over,
  }) as RoleDto;

/** Route every GET the roles page makes; unexpected URLs throw. */
function mockGet(roles: RoleDto[] = []) {
  const table: Record<string, unknown> = {
    '/api/projects/p1': project,
    '/api/projects/p1/roles': roles,
    '/api/projects/p1/groups': [],
  };
  return vi.spyOn(api, 'get').mockImplementation((url: string) => {
    if (url in table) return Promise.resolve(table[url]);
    throw new Error(`unexpected GET ${url}`);
  });
}

function renderRoles() {
  return renderWithClient(
    <MemoryRouter initialEntries={['/projects/p1/roles']}>
      <Routes>
        <Route path="/projects/:projectId/roles" element={<RolesPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

afterEach(() => vi.restoreAllMocks());

describe('RolesPage', () => {
  it('renders the three rosters with an empty state and adds a role to Core', async () => {
    mockGet();
    const post = vi.spyOn(api, 'post').mockResolvedValue(role());

    renderRoles();

    expect(await screen.findByRole('heading', { name: 'Role Roster — Core Roles' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Role Roster — Extend Roles' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Role Roster — Sponsor Coalition' })).toBeInTheDocument();
    // Every roster shows the empty row when it has no roles.
    expect(screen.getAllByText('No roles in this roster yet.')).toHaveLength(3);

    // The first "Add role" button belongs to the Core roster.
    await userEvent.click(screen.getAllByRole('button', { name: 'Add role' })[0]!);
    await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    expect(post.mock.calls[0]![0]).toBe('/api/projects/p1/roles');
    expect(post.mock.calls[0]![1]).toEqual({ roster: 'core' });
  });

  it('saves an inline ADKAR score and a role-name edit for an existing role', async () => {
    mockGet([role({ roster: 'core' })]);
    const put = vi.spyOn(api, 'put').mockResolvedValue(role());
    const patch = vi.spyOn(api, 'patch').mockResolvedValue(role());

    renderRoles();

    await screen.findByRole('heading', { name: 'Role Roster — Core Roles' });
    // Wait for the seeded Core role to load (its name field appears) before counting
    // empties — otherwise we race the roles query and see all three rosters empty.
    await screen.findByPlaceholderText('Role name…');
    // The empty-row hint only shows for the other two rosters now.
    expect(screen.getAllByText('No roles in this roster yet.')).toHaveLength(2);

    // Clicking the first ADKAR ScorePicker's "3" saves the Awareness element.
    await userEvent.click(screen.getAllByRole('radio', { name: '3' })[0]!);
    await waitFor(() => expect(put).toHaveBeenCalledTimes(1));
    expect(put.mock.calls[0]![0]).toBe('/api/roles/r1/adkar');
    expect(put.mock.calls[0]![1]).toEqual({ [adkarItemKey('awareness')]: 3 });

    // Naming the role PATCHes just the roleName field (autosave commits on blur).
    await userEvent.type(screen.getByPlaceholderText('Role name…'), 'Primary Sponsor');
    await userEvent.tab();
    await waitFor(() => expect(patch).toHaveBeenCalledTimes(1));
    expect(patch.mock.calls[0]![0]).toBe('/api/roles/r1');
    expect(patch.mock.calls[0]![1]).toEqual({ roleName: 'Primary Sponsor' });
  });

  it('deletes a role only after the confirm is accepted', async () => {
    mockGet([role({ roster: 'core' })]);
    const del = vi.spyOn(api, 'del').mockResolvedValue(undefined);

    renderRoles();
    const removeButton = await screen.findByRole('button', { name: '✕' });

    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    await userEvent.click(removeButton);
    expect(del).not.toHaveBeenCalled();

    confirm.mockReturnValue(true);
    await userEvent.click(removeButton);
    await waitFor(() => expect(del).toHaveBeenCalledWith('/api/roles/r1'));
  });
});
