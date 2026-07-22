import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ASPECT_KEYS, type ReinforcementAction } from '@cmt/domain';
import { api } from '../../lib/api';
import { renderWithClient } from '../../test/harness';
import type { GroupDto } from '../../lib/types';
import { ReinforcementPage } from './ReinforcementPage';

afterEach(() => vi.restoreAllMocks());

const project = {
  id: 'p1', name: 'P', projectType: null, pmApproach: null,
  status: 'Active', watchGroupIds: [], createdAt: 'x', updatedAt: 'x',
};

const group = (id: string, name: string, adkar: Record<string, number>, barrier: string | null): GroupDto => ({
  id, projectId: 'p1', position: 0, name, numPeople: null,
  adoptionUsageDefinition: null, uniqueConsiderations: null, tags: [], orgGroupId: null,
  aspects: ASPECT_KEYS.map((aspectKey) => ({ aspectKey, yesterday: null, tomorrow: null, impact: null })),
  adkar, adkarAssessmentId: null,
  computed: { aspectsImpacted: 0, degreeOfImpact: null, barrierPoint: barrier, risk: null },
});

const action = (over: Partial<ReinforcementAction> = {}): ReinforcementAction => ({
  id: 'a1', projectId: 'p1', groupId: 'g1', mechanism: 'Recognise weekly wins', owner: null, status: null, notes: null, createdAt: 'x',
  ...over,
});

function mockGet(actions: ReinforcementAction[]) {
  const table: Record<string, unknown> = {
    '/api/projects/p1': project,
    '/api/projects/p1/groups': [group('g1', 'Sales', { reinforcement: 2 }, 'Reinforcement')],
    '/api/projects/p1/outcomes': { objectives: [], realization: null },
    '/api/projects/p1/reinforcement-actions': actions,
  };
  return vi.spyOn(api, 'get').mockImplementation((url: string) => {
    if (url in table) return Promise.resolve(table[url]);
    throw new Error(`unexpected GET ${url}`);
  });
}

function renderPage() {
  return renderWithClient(
    <MemoryRouter initialEntries={['/projects/p1/reinforcement']}>
      <Routes>
        <Route path="/projects/:projectId/reinforcement" element={<ReinforcementPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ReinforcementPage', () => {
  it('flags a group that needs reinforcement and lists its actions', async () => {
    mockGet([action()]);
    renderPage();
    await screen.findByText('Sales');
    // R barrier + low R score -> flagged.
    expect(screen.getByText('Needs reinforcement')).toBeInTheDocument();
    expect(screen.getByText('Recognise weekly wins')).toBeInTheDocument();
  });

  it('adds a reinforcement mechanism for a group', async () => {
    mockGet([]);
    const post = vi.spyOn(api, 'post').mockResolvedValue(action());
    renderPage();
    await screen.findByText('Sales');

    const input = screen.getAllByPlaceholderText(/Add a reinforcement mechanism/i)[0]!;
    await userEvent.type(input, 'Peer coaching circle');
    await userEvent.click(screen.getAllByRole('button', { name: 'Add' })[0]!);

    await waitFor(() =>
      expect(post).toHaveBeenCalledWith('/api/projects/p1/reinforcement-actions', {
        groupId: 'g1',
        mechanism: 'Peer coaching circle',
      }),
    );
  });
});
