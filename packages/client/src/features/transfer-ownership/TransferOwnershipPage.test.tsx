import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { TransferItem } from '@cmt/domain';
import { api } from '../../lib/api';
import { renderWithClient } from '../../test/harness';
import { TransferOwnershipPage } from './TransferOwnershipPage';

afterEach(() => vi.restoreAllMocks());

const project = {
  id: 'p1', name: 'P', projectType: null, pmApproach: null,
  status: 'Active', watchGroupIds: [], createdAt: 'x', updatedAt: 'x',
};

const item = (over: Partial<TransferItem> = {}): TransferItem => ({
  id: 'i1', projectId: 'p1', responsibility: 'Monitor adoption and usage of the change',
  newOwner: null, done: false, notes: null, createdAt: 'x', ...over,
});

function mockGet(items: TransferItem[]) {
  const table: Record<string, unknown> = {
    '/api/projects/p1': project,
    '/api/projects/p1/transfer-items': items,
  };
  return vi.spyOn(api, 'get').mockImplementation((url: string) => {
    if (url in table) return Promise.resolve(table[url]);
    throw new Error(`unexpected GET ${url}`);
  });
}

function renderPage() {
  return renderWithClient(
    <MemoryRouter initialEntries={['/projects/p1/transfer-ownership']}>
      <Routes>
        <Route path="/projects/:projectId/transfer-ownership" element={<TransferOwnershipPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('TransferOwnershipPage', () => {
  it('shows progress and a complete badge when every item is transferred', async () => {
    mockGet([item({ done: true })]);
    renderPage();
    await screen.findByText('Monitor adoption and usage of the change');
    // "1 of 1 transferred" — both counts render.
    expect(screen.getAllByText('1')).toHaveLength(2);
    expect(screen.getByText('Handoff complete')).toBeInTheDocument();
  });

  it('toggling the checkbox marks the item transferred', async () => {
    mockGet([item()]);
    const patch = vi.spyOn(api, 'patch').mockResolvedValue(item({ done: true }));
    renderPage();
    await screen.findByText('Monitor adoption and usage of the change');
    expect(screen.queryByText('Handoff complete')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('checkbox', { name: /Transferred:/ }));
    await waitFor(() =>
      expect(patch).toHaveBeenCalledWith('/api/transfer-items/i1', { done: true }),
    );
  });

  it('quick-adds a suggested responsibility not already on the list', async () => {
    mockGet([]);
    const post = vi.spyOn(api, 'post').mockResolvedValue(item());
    renderPage();
    await screen.findByText('Handoff checklist');

    await userEvent.click(screen.getByRole('button', { name: '+ Keep reinforcement mechanisms active' }));
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith('/api/projects/p1/transfer-items', {
        responsibility: 'Keep reinforcement mechanisms active',
      }),
    );
  });
});
