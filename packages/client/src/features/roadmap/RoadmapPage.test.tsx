import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { api } from '../../lib/api';
import { renderWithClient } from '../../test/harness';
import type { Roadmap } from '../../lib/types';
import { RoadmapPage } from './RoadmapPage';

afterEach(() => vi.restoreAllMocks());

const project = (pmApproach: string | null) => ({
  id: 'p1',
  name: 'P',
  projectType: null,
  pmApproach,
  status: 'Active',
  watchGroupIds: [],
  createdAt: 'x',
  updatedAt: 'x',
});

const roadmap: Roadmap = {
  projectId: 'p1',
  mode: 'sequential',
  kickoffDate: '2026-06-01',
  goliveDate: '2026-09-15',
  outcomesDate: '2026-12-01',
  releases: [],
  adkarMilestones: [],
};

function mockGet(pmApproach: string | null, groups: unknown[] = []) {
  const table: Record<string, unknown> = {
    '/api/projects/p1': project(pmApproach),
    '/api/projects/p1/roadmap': roadmap,
    '/api/projects/p1/groups': groups,
  };
  return vi.spyOn(api, 'get').mockImplementation((url: string) => {
    if (url in table) return Promise.resolve(table[url]);
    throw new Error(`unexpected GET ${url}`);
  });
}

function renderPage() {
  return renderWithClient(
    <MemoryRouter initialEntries={['/projects/p1/roadmap']}>
      <Routes>
        <Route path="/projects/:projectId/roadmap" element={<RoadmapPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('RoadmapPage', () => {
  it('renders the sequential roadmap and saves an edited key date', async () => {
    mockGet(null); // no PM approach -> Sequential
    const put = vi.spyOn(api, 'put').mockResolvedValue(roadmap);
    renderPage();

    await screen.findByText('Kickoff');
    expect(screen.getByText(/Showing the/)).toHaveTextContent('Sequential');
    // No groups yet -> the milestone matrix shows its empty state.
    expect(screen.getByText(/No impacted groups yet/i)).toBeInTheDocument();

    // Edit the kickoff date -> PUT the roadmap patch.
    fireEvent.change(screen.getByDisplayValue('2026-06-01'), { target: { value: '2026-07-15' } });
    await waitFor(() =>
      expect(put).toHaveBeenCalledWith('/api/projects/p1/roadmap', { kickoffDate: '2026-07-15' }),
    );
  });

  it('renders the iterative layout when the PM approach is Iterative', async () => {
    mockGet('Iterative');
    renderPage();
    await screen.findByText('Kickoff');
    expect(screen.getByText(/Showing the/)).toHaveTextContent('Iterative');
    expect(screen.getByText(/Release Dates/i)).toBeInTheDocument();
  });
});
