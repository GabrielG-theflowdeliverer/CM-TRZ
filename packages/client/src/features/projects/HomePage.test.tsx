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

  it('generates a demo project and navigates into it', async () => {
    mockGet([]);
    const post = vi.spyOn(api, 'post').mockResolvedValue(proj('d1', 'Demo'));
    renderHome();
    await screen.findByRole('button', { name: 'Generate demo' });

    await userEvent.click(screen.getByRole('button', { name: 'Generate demo' }));
    await waitFor(() => expect(post).toHaveBeenCalledWith('/api/projects/demo'));
    // Landing on the new project is the point of the button.
    expect(await screen.findByText('project view')).toBeInTheDocument();
  });

  it('imports a project from a chosen JSON file', async () => {
    mockGet([]);
    const post = vi.spyOn(api, 'post').mockResolvedValue(proj('i1', 'Imported'));
    const { container } = renderHome();
    await screen.findByRole('button', { name: 'Import JSON' });

    const payload = { format: 'change-management-tool/project', version: 2, project: { name: 'Imported' } };
    const file = new File([JSON.stringify(payload)], 'export.json', { type: 'application/json' });
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    await userEvent.upload(input, file);

    // The file is parsed in the browser and posted as the body, not multipart.
    await waitFor(() => expect(post).toHaveBeenCalledWith('/api/import', payload));
    // The picker resets so the same file can be chosen again.
    expect(input.value).toBe('');
  });

  it('shows PCT band chips and the risk badge for a project with health', async () => {
    vi.spyOn(api, 'get').mockImplementation((url: string) => {
      if (url === '/api/projects') return Promise.resolve([proj('p1', 'CRM Rollout')]);
      if (url === '/api/dashboard')
        return Promise.resolve({
          summary: {},
          generatedAt: 'x',
          projects: [
            {
              projectId: 'p1',
              name: 'CRM Rollout',
              pct: { scores: { success: 8, leadership: 5, project_management: 3, change_management: 9 }, date: null },
              risk: { cc: 50, oa: 50, quadrant: 'High', date: null },
            },
          ],
        });
      throw new Error(`unexpected GET ${url}`);
    });
    renderHome();

    await screen.findByText('CRM Rollout');
    // One chip per PCT aspect, plus the risk quadrant.
    expect(screen.getByText('S')).toBeInTheDocument();
    expect(screen.getByText('L/S')).toBeInTheDocument();
    expect(screen.getByText('PM')).toBeInTheDocument();
    expect(screen.getByText('CM')).toBeInTheDocument();
    expect(screen.getByText(/High/)).toBeInTheDocument();
  });
});
