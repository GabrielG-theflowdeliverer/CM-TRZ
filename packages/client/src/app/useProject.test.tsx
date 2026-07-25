import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { api } from '../lib/api';
import { renderWithClient } from '../test/harness';
import { useProject } from './useProject';

function Harness() {
  const { projectId, project } = useProject();
  return (
    <div>
      id:{projectId || '(none)'} name:{project?.name ?? '(unloaded)'}
    </div>
  );
}

/** Mount the hook under a route so `:projectId` resolves the way the app does. */
function renderAt(path: string, route: string) {
  return renderWithClient(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path={route} element={<Harness />} />
      </Routes>
    </MemoryRouter>,
  );
}

afterEach(() => vi.restoreAllMocks());

describe('useProject', () => {
  it('reads the id from the route and loads that project', async () => {
    const get = vi.spyOn(api, 'get').mockResolvedValue({ id: 'p1', name: 'CRM Rollout' } as never);
    renderAt('/projects/p1/dashboard', '/projects/:projectId/dashboard');

    expect(screen.getByText(/id:p1/)).toBeInTheDocument();
    await screen.findByText(/name:CRM Rollout/);
    expect(get).toHaveBeenCalledWith('/api/projects/p1');
  });

  it('never fetches when the route carries no project id', () => {
    const get = vi.spyOn(api, 'get').mockResolvedValue({} as never);
    renderAt('/', '/');

    expect(screen.getByText(/id:\(none\)/)).toBeInTheDocument();
    expect(get).not.toHaveBeenCalled();
  });

  it('gives callers the id before the project has loaded', () => {
    // Pages key their own queries off projectId, so it must be usable on the
    // first render rather than only once the project request resolves.
    vi.spyOn(api, 'get').mockReturnValue(new Promise(() => {}) as never);
    renderAt('/projects/p2/roles', '/projects/:projectId/roles');

    expect(screen.getByText(/id:p2/)).toBeInTheDocument();
    expect(screen.getByText(/name:\(unloaded\)/)).toBeInTheDocument();
  });
});
