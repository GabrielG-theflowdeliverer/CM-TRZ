import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { PlanDto } from '../../lib/types';
import { api } from '../../lib/api';
import { renderWithClient } from '../../test/harness';
import { PlansPage } from './PlansPage';

const plan = (over: Partial<PlanDto> = {}): PlanDto => ({
  id: 'pl1',
  projectId: 'p1',
  kind: 'core',
  name: 'Communications Plan',
  planType: 'Activity Plan',
  sponsor: null,
  practitioner: null,
  lastUpdated: '2026-07-10',
  position: 0,
  activities: [],
  computed: { progress: { total: 0, completed: 0, inProgress: 0, notStarted: 0, percentComplete: null } },
  ...over,
});

function mockGet(over: Record<string, unknown> = {}) {
  const table: Record<string, unknown> = {
    '/api/projects/p1': { id: 'p1', name: 'Project One' },
    '/api/projects/p1/plans': [
      plan(),
      plan({
        id: 'pl2',
        kind: 'extend',
        name: 'Training Plan',
        planType: 'Role Plan',
        computed: { progress: { total: 2, completed: 1, inProgress: 1, notStarted: 0, percentComplete: 50 } },
      }),
    ],
    ...over,
  };
  return vi.spyOn(api, 'get').mockImplementation((url: string) => {
    if (url in table) return Promise.resolve(table[url]);
    throw new Error(`unexpected GET ${url}`);
  });
}

function renderPage() {
  return renderWithClient(
    <MemoryRouter initialEntries={['/projects/p1/plans']}>
      <Routes>
        <Route path="/projects/:projectId/plans" element={<PlansPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

afterEach(() => vi.restoreAllMocks());

describe('PlansPage', () => {
  it('splits plans into Core and Extend sections with progress', async () => {
    mockGet();
    renderPage();

    expect(await screen.findByRole('heading', { name: 'Change Management Plans' })).toBeInTheDocument();

    const coreLink = await screen.findByRole('link', { name: 'Communications Plan' });
    expect(coreLink).toHaveAttribute('href', '/projects/p1/plans/pl1');
    expect(screen.getByRole('link', { name: 'Training Plan' })).toBeInTheDocument();

    // Core plan has no activities -> "No activities"; extend plan shows its percent.
    expect(screen.getByText('No activities')).toBeInTheDocument();
    expect(screen.getByText('50%')).toBeInTheDocument();
  });

  it('creates an extend plan from the form', async () => {
    mockGet();
    const post = vi.spyOn(api, 'post').mockResolvedValue(plan({ id: 'pl3', kind: 'extend', name: 'Coaching Plan' }));

    renderPage();
    await screen.findByRole('heading', { name: 'Change Management Plans' });

    await userEvent.type(screen.getByPlaceholderText(/Plan name/), 'Coaching Plan');
    await userEvent.click(screen.getByRole('button', { name: 'Add plan' }));

    await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    expect(post.mock.calls[0]![0]).toBe('/api/projects/p1/plans');
    expect(post.mock.calls[0]![1]).toEqual({ kind: 'extend', name: 'Coaching Plan' });
  });

  it('only offers delete on extend plans and requires confirmation', async () => {
    mockGet();
    const del = vi.spyOn(api, 'del').mockResolvedValue(undefined);
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);

    renderPage();

    // Core plan row has no delete button; extend plan row does.
    const coreRow = (await screen.findByRole('link', { name: 'Communications Plan' })).closest('tr')!;
    expect(within(coreRow).queryByRole('button', { name: '✕' })).not.toBeInTheDocument();

    const extendRow = screen.getByRole('link', { name: 'Training Plan' }).closest('tr')!;
    await userEvent.click(within(extendRow).getByRole('button', { name: '✕' }));

    await waitFor(() => expect(del).toHaveBeenCalledWith('/api/plans/pl2'));
    expect(confirm).toHaveBeenCalled();
  });
});
