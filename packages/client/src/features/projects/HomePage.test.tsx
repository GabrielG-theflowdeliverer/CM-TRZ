import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { api } from '../../lib/api';
import { renderWithClient } from '../../test/harness';
import { HomePage } from './HomePage';

afterEach(() => vi.restoreAllMocks());

const proj = (id: string, name: string, status = 'Active') => ({
  id,
  name,
  projectType: null,
  pmApproach: null,
  status,
  watchGroupIds: [],
  createdAt: 'x',
  updatedAt: 'x',
});

function mockGet(projects: unknown[]) {
  const table: Record<string, unknown> = {
    '/api/projects': projects,
    '/api/dashboard': { summary: {}, projects: [], generatedAt: 'x' },
  };
  return vi.spyOn(api, 'get').mockImplementation((url: string) => {
    if (url in table) return Promise.resolve(table[url]);
    throw new Error(`unexpected GET ${url}`);
  });
}

function renderHome() {
  return renderWithClient(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/projects/:projectId/dashboard" element={<div>project view</div>} />
        <Route path="/dashboard" element={<div>portfolio</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('HomePage', () => {
  it('lists active projects and filters by status', async () => {
    mockGet([proj('p1', 'CRM Rollout'), proj('p2', 'Legacy Retire', 'Completed')]);
    renderHome();

    // Default 'Active' filter hides the completed one.
    await screen.findByText('CRM Rollout');
    expect(screen.queryByText('Legacy Retire')).not.toBeInTheDocument();

    // 'All' reveals it.
    await userEvent.click(screen.getByRole('button', { name: 'All' }));
    expect(screen.getByText('Legacy Retire')).toBeInTheDocument();
  });

  it('creates a project from the form', async () => {
    mockGet([]);
    const post = vi.spyOn(api, 'post').mockResolvedValue(proj('new', 'Fresh'));
    renderHome();
    await screen.findByText(/No projects yet/i);

    await userEvent.type(screen.getByPlaceholderText(/new project name/i), 'Fresh');
    await userEvent.click(screen.getByRole('button', { name: /create project/i }));
    await waitFor(() => expect(post).toHaveBeenCalledWith('/api/projects', { name: 'Fresh' }));
  });

  it('deletes a project only after confirmation', async () => {
    mockGet([proj('p1', 'CRM Rollout')]);
    const del = vi.spyOn(api, 'del').mockResolvedValue(undefined);
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderHome();
    await screen.findByText('CRM Rollout');

    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(del).not.toHaveBeenCalled();

    confirm.mockReturnValue(true);
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(del).toHaveBeenCalledWith('/api/projects/p1'));
  });
});
