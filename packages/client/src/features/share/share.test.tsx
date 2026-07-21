import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { api, ApiError } from '../../lib/api';
import { renderWithClient } from '../../test/harness';
import type { ProjectDashboardDto } from '../dashboard/ProjectDashboardView';
import { SharePanel } from './SharePanel';
import { SharedDashboardPage } from './SharedDashboardPage';

afterEach(() => vi.restoreAllMocks());

const dashboard = (): ProjectDashboardDto => ({
  project: {
    id: 'p1',
    name: 'CRM Rollout',
    projectType: null,
    pmApproach: null,
    status: 'Active',
    watchGroupIds: ['g1'],
    createdAt: 'x',
    updatedAt: 'x',
  },
  pct: null,
  risk: null,
  groupRisks: [{ groupId: 'g1', groupName: 'Sales Team', cc: 3, oa: 2, quadrant: null }],
  aspectsImpactedHistogram: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  degreeOfImpactHistogram: [0, 0, 0, 0, 0],
  barrierCounts: {},
  groups: [
    {
      id: 'g1',
      name: 'Sales Team',
      numPeople: 40,
      aspectsImpacted: 2,
      degreeOfImpact: 4,
      barrierPoint: null,
      riskQuadrant: null,
    },
  ],
  latestCmPerf: null,
});

describe('SharePanel', () => {
  it('enables sharing and shows the copyable link', async () => {
    vi.spyOn(api, 'get').mockResolvedValue({ token: null });
    const post = vi.spyOn(api, 'post').mockResolvedValue({ token: 'share-tok-123' });

    renderWithClient(<SharePanel projectId="p1" />);
    await userEvent.click(await screen.findByRole('button', { name: /enable view-only link/i }));

    await waitFor(() => expect(post).toHaveBeenCalledWith('/api/projects/p1/share'));
    const field = (await screen.findByDisplayValue(/\/view\/share-tok-123$/)) as HTMLInputElement;
    expect(field.readOnly).toBe(true);
  });

  it('rotates and disables only after confirmation', async () => {
    vi.spyOn(api, 'get').mockResolvedValue({ token: 'old-tok' });
    const post = vi.spyOn(api, 'post').mockResolvedValue({ token: 'new-tok' });
    const del = vi.spyOn(api, 'del').mockResolvedValue(undefined);
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);

    renderWithClient(<SharePanel projectId="p1" />);
    await userEvent.click(await screen.findByRole('button', { name: /rotate link/i }));
    await userEvent.click(screen.getByRole('button', { name: /turn off sharing/i }));
    expect(post).not.toHaveBeenCalled();
    expect(del).not.toHaveBeenCalled();

    confirm.mockReturnValue(true);
    await userEvent.click(screen.getByRole('button', { name: /rotate link/i }));
    await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    await userEvent.click(screen.getByRole('button', { name: /turn off sharing/i }));
    await waitFor(() => expect(del).toHaveBeenCalledWith('/api/projects/p1/share'));
  });
});

function renderSharedAt(token = 'tok') {
  return renderWithClient(
    <MemoryRouter initialEntries={[`/view/${token}`]}>
      <Routes>
        <Route path="/view/:token" element={<SharedDashboardPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('SharedDashboardPage', () => {
  it('renders the dashboard read-only: content visible, nothing navigable or editable', async () => {
    vi.spyOn(api, 'get').mockResolvedValue(dashboard());
    renderSharedAt();

    await screen.findByText('CRM Rollout');
    expect(screen.getByText('View only')).toBeInTheDocument();
    // Watched group's data shows...
    expect(screen.getAllByText('Sales Team').length).toBeGreaterThan(0);
    // ...but there are no in-app links and no watch-list editor.
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.queryByText(/watch list/i)).not.toBeInTheDocument();
  });

  it('shows an invalid-link message for a revoked or unknown token', async () => {
    vi.spyOn(api, 'get').mockRejectedValue(new ApiError(404, 'Shared view not found'));
    renderSharedAt('dead');
    await screen.findByText(/isn.t valid/i);
  });
});
