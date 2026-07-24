import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { api, ApiError, isShareView, setShareViewToken } from '../../lib/api';
import { renderWithClient } from '../../test/harness';
import type { ProjectDashboardDto } from '../dashboard/ProjectDashboardView';
import { SharePanel } from './SharePanel';
import { ShareApp } from '../../app/ShareApp';

afterEach(() => {
  setShareViewToken(null);
  vi.restoreAllMocks();
});

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

describe('api share-view mode', () => {
  it('reroutes reads onto the token mirror and refuses writes client-side', async () => {
    setShareViewToken('tok-9');
    expect(isShareView()).toBe(true);
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('[]', { status: 200, headers: { 'Content-Type': 'application/json' } }));

    await api.get('/api/projects/p1/groups');
    expect(fetchSpy).toHaveBeenCalledWith('/api/share/tok-9/projects/p1/groups', expect.anything());

    await expect(api.post('/api/projects/p1/groups', { name: 'X' })).rejects.toMatchObject({
      status: 403,
      message: 'This link is view-only',
    });
    expect(fetchSpy).toHaveBeenCalledTimes(1); // the write never left the client
  });
});

describe('ShareApp', () => {
  it('resolves the token, then renders the real pages read-only under the shared shell', async () => {
    setShareViewToken('tok-9');
    // Entry payload (raw fetch, outside the api helper).
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(dashboard()), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    );
    // Page data via the (mocked) api helper, keyed by the un-rewritten paths.
    vi.spyOn(api, 'get').mockImplementation((url: string) => {
      if (url === '/api/projects/p1') return Promise.resolve(dashboard().project);
      if (url === '/api/projects/p1/dashboard') return Promise.resolve(dashboard());
      return Promise.reject(new ApiError(404, `unexpected GET ${url}`));
    });

    renderWithClient(
      <MemoryRouter initialEntries={['/']}>
        <ShareApp token="tok-9" />
      </MemoryRouter>,
    );

    // Landed on the real dashboard page inside the shared shell.
    expect(await screen.findByText('View only')).toBeInTheDocument();
    await screen.findByText('Project Dashboard');
    // The project name renders from a separate query than the dashboard heading,
    // so wait for it rather than asserting synchronously (was a CI flake).
    expect((await screen.findAllByText('CRM Rollout')).length).toBeGreaterThan(0);
    // Full nav is there — except Settings.
    expect(screen.getByText('Assessments')).toBeInTheDocument();
    expect(screen.getByText('Roadmap')).toBeInTheDocument();
    expect(screen.queryByText('Settings')).not.toBeInTheDocument();
    // The page body sits inside the view-only wrapper that disables controls.
    expect(document.querySelector('[data-view-only]')).not.toBeNull();
  });

  it('shows an invalid-link message for a revoked or unknown token', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{"error":"nope"}', { status: 404 }));
    renderWithClient(
      <MemoryRouter initialEntries={['/']}>
        <ShareApp token="dead" />
      </MemoryRouter>,
    );
    await screen.findByText(/isn.t valid/i);
  });
});
