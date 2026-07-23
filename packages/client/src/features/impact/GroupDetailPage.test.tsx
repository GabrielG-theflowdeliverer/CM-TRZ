import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ASPECT_KEYS } from '@cmt/domain';
import { api } from '../../lib/api';
import { renderWithClient } from '../../test/harness';
import type { AssessmentDto, GroupDto } from '../../lib/types';
import { GroupDetailPage } from './GroupDetailPage';

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

const group: GroupDto = {
  id: 'g1',
  projectId: 'p1',
  position: 0,
  name: 'Sales Team',
  numPeople: 40,
  adoptionUsageDefinition: null,
  uniqueConsiderations: null,
  tags: ['Frontline'],
  orgGroupId: null,
  aspects: ASPECT_KEYS.map((aspectKey) => ({ aspectKey, yesterday: null, tomorrow: null, impact: null })),
  adkar: {},
  adkarAssessmentId: null,
  computed: { aspectsImpacted: 0, degreeOfImpact: null, barrierPoint: null, risk: null },
};

const adkarRun: AssessmentDto = {
  id: 'ar1',
  projectId: 'p1',
  type: 'adkar',
  subjectKind: 'group',
  subjectId: 'g1',
  label: 'Q3 ADKAR',
  scheduledDate: null,
  completedDate: null,
  status: null,
  notes: null,
  createdAt: 'x',
  responses: {},
  computed: { adkar: { scores: {}, barrierPoint: 'Desire' } },
};

function mockGet(over: Record<string, unknown> = {}) {
  const table: Record<string, unknown> = {
    '/api/projects/p1': project,
    '/api/groups/g1': group,
    '/api/projects/p1/assessments?type=adkar': [adkarRun],
    '/api/projects/p1/assessments?type=risk': [],
    '/api/projects/p1/roles': [],
    '/api/projects/p1/resistance': [],
    '/api/projects/p1/roadmap': { mode: 'sequential', kickoffDate: null, goliveDate: null, outcomesDate: null, releases: [], adkarMilestones: [] },
    '/api/org-groups': [],
    ...over,
  };
  return vi.spyOn(api, 'get').mockImplementation((url: string) => {
    if (url in table) return Promise.resolve(table[url]);
    throw new Error(`unexpected GET ${url}`);
  });
}

function renderPage() {
  return renderWithClient(
    <MemoryRouter initialEntries={['/projects/p1/impact/g1']}>
      <Routes>
        <Route path="/projects/:projectId/impact/:groupId" element={<GroupDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('GroupDetailPage', () => {
  it('shows a loading panel until the group resolves (no blank screen)', () => {
    vi.spyOn(api, 'get').mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(screen.getByText(/Loading group/)).toBeInTheDocument();
  });

  it('shows the group and its Overview, with the ADKAR tab reflecting run count', async () => {
    mockGet();
    renderPage();

    await screen.findByRole('heading', { name: 'Sales Team' });
    // Overview tab (default) shows the org-group linker and headcount.
    expect(screen.getByText(/Organization group/i)).toBeInTheDocument();
    expect(screen.getByText('40')).toBeInTheDocument();
    // The ADKAR tab is badged with the one group run.
    expect(screen.getByRole('button', { name: /ADKAR Assessments \(1\)/ })).toBeInTheDocument();
  });

  it('switches tabs to the aspects editor and the ADKAR run history', async () => {
    mockGet();
    renderPage();
    await screen.findByRole('heading', { name: 'Sales Team' });

    await userEvent.click(screen.getByRole('button', { name: 'Change Impact' }));
    expect(screen.getByText(/10 Aspects of Change Impact/i)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /ADKAR Assessments/ }));
    expect(screen.getByText('Q3 ADKAR')).toBeInTheDocument();
  });

  it('renders the empty state when a group has no risk runs', async () => {
    mockGet();
    renderPage();
    await screen.findByRole('heading', { name: 'Sales Team' });

    await userEvent.click(screen.getByRole('button', { name: /Risk Assessment/ }));
    expect(screen.getByText(/No runs yet for this group/i)).toBeInTheDocument();
  });
});
