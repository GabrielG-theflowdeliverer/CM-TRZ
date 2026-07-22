import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { api } from '../../lib/api';
import { renderWithClient } from '../../test/harness';
import type { AdaptAction } from '../../lib/types';
import { AdaptActionsPage } from './AdaptActionsPage';

afterEach(() => vi.restoreAllMocks());

const project = {
  id: 'p1', name: 'P', projectType: null, pmApproach: null,
  status: 'Active', watchGroupIds: [], createdAt: 'x', updatedAt: 'x',
};

const block: AdaptAction = {
  id: 'b1', projectId: 'p1', position: 0,
  observations: null, implications: null, actionSteps: null,
  assessmentResults: null, strengths: null, opportunities: null, notes: null,
};

function mockGet(blocks: unknown[]) {
  const table: Record<string, unknown> = {
    '/api/projects/p1': project,
    '/api/projects/p1/adapt-actions': blocks,
  };
  return vi.spyOn(api, 'get').mockImplementation((url: string) => {
    if (url in table) return Promise.resolve(table[url]);
    throw new Error(`unexpected GET ${url}`);
  });
}

function renderPage() {
  return renderWithClient(
    <MemoryRouter initialEntries={['/projects/p1/adapt-actions']}>
      <Routes>
        <Route path="/projects/:projectId/adapt-actions" element={<AdaptActionsPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('AdaptActionsPage', () => {
  it('shows the empty state and adds a block', async () => {
    mockGet([]);
    const post = vi.spyOn(api, 'post').mockResolvedValue(block);
    renderPage();
    await screen.findByText(/No adapt-action blocks yet/i);

    await userEvent.click(screen.getByRole('button', { name: /Add block/i }));
    await waitFor(() => expect(post).toHaveBeenCalledWith('/api/projects/p1/adapt-actions', {}));
  });

  it('renders a block and deletes it after confirmation', async () => {
    mockGet([block]);
    const del = vi.spyOn(api, 'del').mockResolvedValue(undefined);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderPage();
    await screen.findByText('Block 1');

    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(del).toHaveBeenCalledWith('/api/adapt-actions/b1'));
  });
});
