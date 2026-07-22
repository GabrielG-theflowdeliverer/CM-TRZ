import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ASPECT_KEYS } from '@cmt/domain';
import { api } from '../../lib/api';
import { renderWithClient } from '../../test/harness';
import type { GroupDto } from '../../lib/types';
import { ImpactPage } from './ImpactPage';

afterEach(() => vi.restoreAllMocks());

const project = {
  id: 'p1',
  name: 'P',
  projectType: null,
  pmApproach: null,
  status: 'Active',
  watchGroupIds: [],
  createdAt: 'x',
  updatedAt: 'x',
};

const group: GroupDto = {
  id: 'g1',
  projectId: 'p1',
  position: 0,
  name: 'Sales Team',
  numPeople: 40,
  adoptionUsageDefinition: null,
  uniqueConsiderations: null,
  tags: ['Frontline'],
  orgGroupId: null,
  aspects: ASPECT_KEYS.map((aspectKey) => ({ aspectKey, yesterday: null, tomorrow: null, impact: null })),
  adkar: {},
  adkarAssessmentId: null,
  computed: { aspectsImpacted: 0, degreeOfImpact: null, barrierPoint: null, risk: null },
};

function mockGet(groups: unknown[]) {
  const table: Record<string, unknown> = {
    '/api/projects/p1': project,
    '/api/projects/p1/groups': groups,
  };
  return vi.spyOn(api, 'get').mockImplementation((url: string) => {
    if (url in table) return Promise.resolve(table[url]);
    throw new Error(`unexpected GET ${url}`);
  });
}

function renderPage() {
  return renderWithClient(
    <MemoryRouter initialEntries={['/projects/p1/impact']}>
      <Routes>
        <Route path="/projects/:projectId/impact" element={<ImpactPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ImpactPage', () => {
  it('lists impacted groups with tags and status', async () => {
    mockGet([group]);
    renderPage();
    await screen.findByText('Sales Team');
    expect(screen.getByText('Frontline')).toBeInTheDocument();
    expect(screen.getByText('Not Started')).toBeInTheDocument(); // no aspects filled
  });

  it('adds a group through the form', async () => {
    mockGet([]);
    const post = vi.spyOn(api, 'post').mockResolvedValue(group);
    renderPage();
    await screen.findByText(/No impacted groups yet/i);

    await userEvent.type(screen.getByPlaceholderText(/add impacted group/i), 'Operations');
    await userEvent.click(screen.getByRole('button', { name: /add group/i }));
    await waitFor(() => expect(post).toHaveBeenCalledWith('/api/projects/p1/groups', { name: 'Operations' }));
  });

  it('deletes a group after confirmation', async () => {
    mockGet([group]);
    const del = vi.spyOn(api, 'del').mockResolvedValue(undefined);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderPage();
    await screen.findByText('Sales Team');

    await userEvent.click(screen.getByRole('button', { name: '✕' }));
    await waitFor(() => expect(del).toHaveBeenCalledWith('/api/groups/g1'));
  });
});
