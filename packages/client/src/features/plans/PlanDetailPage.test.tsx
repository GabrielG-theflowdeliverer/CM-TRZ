import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { PlanDto } from '../../lib/types';
import { api } from '../../lib/api';
import { renderWithClient } from '../../test/harness';
import { PlanDetailPage } from './PlanDetailPage';

const plan = (over: Partial<PlanDto> = {}): PlanDto => ({
  id: 'pl1',
  projectId: 'p1',
  kind: 'core',
  name: 'Communications Plan',
  planType: 'Activity Plan',
  sponsor: 'Dana Sponsor',
  practitioner: 'Pat Practitioner',
  lastUpdated: '2026-07-10',
  position: 0,
  activities: [],
  computed: { progress: { total: 4, completed: 1, inProgress: 1, notStarted: 2, percentComplete: 25 } },
  ...over,
});

function mockGet(over: Record<string, unknown> = {}) {
  const table: Record<string, unknown> = {
    '/api/projects/p1': { id: 'p1', name: 'Project One' },
    '/api/plans/pl1': plan(),
    '/api/projects/p1/plans': [plan()],
    '/api/projects/p1/groups': [],
    '/api/projects/p1/blueprints': [],
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
    <MemoryRouter initialEntries={['/projects/p1/plans/pl1']}>
      <Routes>
        <Route path="/projects/:projectId/plans/:planId" element={<PlanDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

afterEach(() => vi.restoreAllMocks());

describe('PlanDetailPage', () => {
  it('renders the plan header, progress summary and metadata fields', async () => {
    mockGet();
    renderPage();

    expect(await screen.findByRole('heading', { name: 'Communications Plan' })).toBeInTheDocument();
    // Progress line pulls project name and the computed progress block.
    expect(screen.getByText(/Project: Project One/)).toBeInTheDocument();
    expect(screen.getByText(/1\/4 activities completed \(25%\)/)).toBeInTheDocument();
    // Metadata field labels are present.
    expect(screen.getByText('Plan Type')).toBeInTheDocument();
    expect(screen.getByText('Change Practitioner')).toBeInTheDocument();
    // No activities yet -> the empty-state row.
    expect(screen.getByText('No activities here yet.')).toBeInTheDocument();
  });

  it('adds an activity via the header button', async () => {
    mockGet();
    const post = vi.spyOn(api, 'post').mockResolvedValue(plan());
    renderPage();

    await screen.findByRole('heading', { name: 'Communications Plan' });
    await userEvent.click(screen.getByRole('button', { name: 'Add activity' }));

    await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    expect(post.mock.calls[0]![0]).toBe('/api/plans/pl1/activities');
    expect(post.mock.calls[0]![1]).toEqual({});
  });
});
