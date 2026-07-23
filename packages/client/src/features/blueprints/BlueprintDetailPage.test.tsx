import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { BlueprintDto, BlueprintSnapshot } from '../../lib/types';
import { api } from '../../lib/api';
import { renderWithClient } from '../../test/harness';
import { BlueprintDetailPage } from './BlueprintDetailPage';

const blueprint = (over: Partial<BlueprintDto> = {}): BlueprintDto => ({
  id: 'b1',
  projectId: 'p1',
  scopeKind: 'group',
  groupId: 'g1',
  name: 'Rollout Blueprint',
  notes: null,
  createdAt: '2026-07-01T00:00:00.000Z',
  updatedAt: '2026-07-18T00:00:00.000Z',
  elements: [],
  activities: [],
  groupName: 'Finance Team',
  computed: { milestones: {} },
  ...over,
});

const snapshot = (over: Partial<BlueprintSnapshot> = {}): BlueprintSnapshot => ({
  id: 's1',
  blueprintId: 'b1',
  label: 'Baseline v1',
  takenAt: '2026-07-20T10:30:00.000Z',
  payload: { activities: [] },
  ...over,
});

function mockGet(over: Record<string, unknown> = {}) {
  const table: Record<string, unknown> = {
    '/api/projects/p1': { id: 'p1', name: 'Project One' },
    '/api/blueprints/b1': blueprint(),
    '/api/blueprints/b1/snapshots': [],
    '/api/projects/p1/groups': [],
    '/api/projects/p1/plans': [],
    '/api/projects/p1/blueprints': [blueprint()],
    '/api/projects/p1/roles': [],
    ...over,
  };
  return vi.spyOn(api, 'get').mockImplementation((url: string) => {
    if (url in table) return Promise.resolve(table[url]);
    throw new Error(`unexpected GET ${url}`);
  });
}

function renderPage() {
  return renderWithClient(
    <MemoryRouter initialEntries={['/projects/p1/blueprints/b1']}>
      <Routes>
        <Route path="/projects/:projectId/blueprints/:blueprintId" element={<BlueprintDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

afterEach(() => vi.restoreAllMocks());

describe('BlueprintDetailPage', () => {
  it('renders the blueprint header and one section per ADKAR element', async () => {
    mockGet();
    renderPage();

    expect(
      await screen.findByRole('heading', { name: /ADKAR Blueprint — Rollout Blueprint/ }),
    ).toBeInTheDocument();
    // The group scope is described in the sub-header.
    expect(screen.getByText(/Group: Finance Team/)).toBeInTheDocument();
    // Five ADKAR section headings.
    for (const name of ['Awareness', 'Desire', 'Knowledge', 'Ability', 'Reinforcement']) {
      expect(screen.getByRole('heading', { name, level: 3 })).toBeInTheDocument();
    }
  });

  it('adds an activity to the first (Awareness) section', async () => {
    mockGet();
    const post = vi.spyOn(api, 'post').mockResolvedValue(blueprint());
    renderPage();

    await screen.findByRole('heading', { name: /ADKAR Blueprint/ });
    const addButtons = screen.getAllByRole('button', { name: 'Add activity' });
    expect(addButtons).toHaveLength(5);
    await userEvent.click(addButtons[0]!);

    await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    expect(post.mock.calls[0]![0]).toBe('/api/blueprints/b1/activities');
    expect(post.mock.calls[0]![1]).toEqual({ element: 'awareness' });
  });

  it('toggles the snapshots panel and lists saved versions', async () => {
    mockGet({ '/api/blueprints/b1/snapshots': [snapshot()] });
    renderPage();

    const toggle = await screen.findByRole('button', { name: 'Snapshots (1)' });
    // Panel is collapsed until opened.
    expect(screen.queryByRole('heading', { name: 'Saved versions' })).not.toBeInTheDocument();

    await userEvent.click(toggle);
    const panelHeading = await screen.findByRole('heading', { name: 'Saved versions' });
    const panel = panelHeading.closest('div')!.parentElement!;
    expect(within(panel).getByText('Baseline v1')).toBeInTheDocument();
  });
});
