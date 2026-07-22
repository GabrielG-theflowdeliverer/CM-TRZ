import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Activity, Roadmap, TrackingEntry } from '../../lib/types';
import { api } from '../../lib/api';
import { renderWithClient } from '../../test/harness';
import { TrackingPage } from './TrackingPage';

afterEach(() => vi.restoreAllMocks());

const project = {
  id: 'p1', name: 'P', projectType: null, pmApproach: null,
  status: 'Active', watchGroupIds: [], createdAt: 'x', updatedAt: 'x',
};

const roadmap: Roadmap = {
  projectId: 'p1',
  mode: 'sequential',
  kickoffDate: '2026-06-01',
  goliveDate: '2026-09-15',
  outcomesDate: '2026-12-01',
  releases: [],
  adkarMilestones: [{ releaseNo: 0, element: 'awareness', date: '2026-07-01', groupId: null }],
};

const activity: Activity = {
  id: 'act1', projectId: 'p1', position: 0, name: 'Comms Plan',
  methodMechanism: null, rolesRequiredText: null, responsible: null,
  startDate: '2026-07-01', finishDate: '2026-08-01', status: 'In Progress',
  resultFeedback: null, overall: false, adkarOutcomes: [], groupIds: [], planIds: [], blueprintIds: [], roleIds: [],
};

const entry: TrackingEntry = {
  id: 'tr1', projectId: 'p1', schedule: 'pct_check', position: 0,
  scheduledDate: '2026-08-01', completedDate: null, description: null, status: null, results: null, notes: null,
};

function mockGet(over: Record<string, unknown> = {}) {
  const table: Record<string, unknown> = {
    '/api/projects/p1': project,
    '/api/projects/p1/activities': [activity],
    '/api/projects/p1/assessments': [],
    '/api/projects/p1/cm-perf-reports': [],
    '/api/projects/p1/groups': [],
    '/api/projects/p1/tracking': [entry],
    '/api/projects/p1/roadmap': roadmap,
    ...over,
  };
  return vi.spyOn(api, 'get').mockImplementation((url: string) => {
    if (url in table) return Promise.resolve(table[url]);
    throw new Error(`unexpected GET ${url}`);
  });
}

function renderPage() {
  return renderWithClient(
    <MemoryRouter initialEntries={['/projects/p1/tracking']}>
      <Routes>
        <Route path="/projects/:projectId/tracking" element={<TrackingPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('TrackingPage', () => {
  it('plots the timeline from roadmap + activity dates by default', async () => {
    mockGet();
    renderPage();
    // TimelineView plotted the Gantt from the data — the activity bar is
    // labelled (await: it appears once the activities query resolves).
    expect(await screen.findByText('Comms Plan')).toBeInTheDocument();
  });

  it('shows the empty timeline state when there are no dates', async () => {
    mockGet({
      '/api/projects/p1/activities': [],
      '/api/projects/p1/roadmap': { ...roadmap, kickoffDate: null, goliveDate: null, outcomesDate: null, adkarMilestones: [] },
    });
    renderPage();
    await screen.findByText('Tracking Calendar');
    expect(screen.getByText(/Nothing to plot yet/i)).toBeInTheDocument();
  });

  it('switches to schedules and adds a status check', async () => {
    mockGet();
    const post = vi.spyOn(api, 'post').mockResolvedValue(entry);
    renderPage();
    await screen.findByText('Tracking Calendar');

    await userEvent.click(screen.getByRole('button', { name: /Status Check Schedules/i }));
    expect(screen.getByText('Key Dates (from Roadmap)')).toBeInTheDocument();

    await userEvent.click(screen.getAllByRole('button', { name: /Add check/i })[0]!);
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith('/api/projects/p1/tracking', { schedule: 'pct_check' }),
    );
  });
});
