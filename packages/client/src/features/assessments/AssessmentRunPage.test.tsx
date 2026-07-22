import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { pctItemKey } from '@cmt/domain';
import { api } from '../../lib/api';
import { renderWithClient } from '../../test/harness';
import type { AssessmentDto } from '../../lib/types';
import { AssessmentRunPage } from './AssessmentRunPage';

afterEach(() => vi.restoreAllMocks());

const project = {
  id: 'p1',
  name: 'P',
  projectType: null,
  pmApproach: null,
  status: 'Active',
  watchGroupIds: [],
  createdAt: 'x',
  updatedAt: 'x',
};

const pctRun: AssessmentDto = {
  id: 'a1',
  projectId: 'p1',
  type: 'pct',
  subjectKind: 'project',
  subjectId: null,
  label: null,
  scheduledDate: null,
  completedDate: null,
  status: null,
  notes: null,
  createdAt: 'x',
  responses: {},
  computed: { pct: { success: null, leadership: null, project_management: null, change_management: null } },
};

function mockGet() {
  const table: Record<string, unknown> = {
    '/api/projects/p1': project,
    '/api/assessments/a1': pctRun,
    '/api/projects/p1/surveys': [],
    '/api/projects/p1/roles': [],
  };
  return vi.spyOn(api, 'get').mockImplementation((url: string) => {
    if (url in table) return Promise.resolve(table[url]);
    throw new Error(`unexpected GET ${url}`);
  });
}

describe('AssessmentRunPage', () => {
  it('renders the editor for the run type and saves a scored factor', async () => {
    mockGet();
    const put = vi.spyOn(api, 'put').mockResolvedValue(pctRun);

    renderWithClient(
      <MemoryRouter initialEntries={['/projects/p1/assessments/a1']}>
        <Routes>
          <Route path="/projects/:projectId/assessments/:assessmentId" element={<AssessmentRunPage />} />
        </Routes>
      </MemoryRouter>,
    );

    // PCT run -> the PCT editor mounts (heading appears more than once).
    expect((await screen.findAllByText(/Prosci Change Triangle/i)).length).toBeGreaterThan(0);

    // Score the first factor -> save PUTs the responses patch.
    await userEvent.click(screen.getAllByRole('radio', { name: '3' })[0]!);
    await waitFor(() => expect(put).toHaveBeenCalledWith('/api/assessments/a1/responses', { [pctItemKey('success', 0)]: 3 }));
  });
});
