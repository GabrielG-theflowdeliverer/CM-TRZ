import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { api } from '../../lib/api';
import type { AssessmentDto, GroupDto } from '../../lib/types';
import { renderWithClient } from '../../test/harness';
import { AssessmentsHubPage } from './AssessmentsHubPage';

// Recharts' ResponsiveContainer needs ResizeObserver, which jsdom lacks. Stub it
// so the PCT trend chart can render (its container reports 0×0 and draws nothing,
// but the surrounding card + heading still mount).
beforeAll(() => {
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  globalThis.ResizeObserver = ResizeObserverStub as never;
});

const base = {
  projectId: 'p1',
  subjectKind: 'project' as const,
  subjectId: null,
  label: null,
  scheduledDate: null,
  completedDate: null,
  status: null,
  notes: null,
  createdAt: '2026-07-18T00:00:00.000Z',
  responses: {} as Record<string, number | null>,
};

const runs: AssessmentDto[] = [
  {
    ...base,
    id: 'pct1',
    type: 'pct',
    computed: { pct: { success: 22, leadership: 20, project_management: 18, change_management: 24 } },
  },
  {
    ...base,
    id: 'pct2',
    type: 'pct',
    completedDate: '2026-07-19',
    computed: { pct: { success: 25, leadership: 21, project_management: 20, change_management: 26 } },
  },
  { ...base, id: 'risk1', type: 'risk', computed: { risk: { cc: 3, oa: 2, quadrant: 'High' } } },
  {
    ...base,
    id: 'sponsor1',
    type: 'sponsor_competency',
    subjectKind: 'person',
    computed: { competency: { total: 72, interpretation: 'Good' } },
  },
  { ...base, id: 'adkar1', type: 'adkar', computed: { adkar: { scores: {}, barrierPoint: 'Knowledge' } } },
];

const groups = [{ id: 'g1', name: 'Group A' }] as unknown as GroupDto[];

function mockGet(over: Record<string, unknown> = {}) {
  const table: Record<string, unknown> = {
    '/api/projects/p1': { id: 'p1', name: 'P' },
    '/api/projects/p1/assessments': runs,
    '/api/projects/p1/groups': groups,
    ...over,
  };
  return vi.spyOn(api, 'get').mockImplementation((url: string) => {
    if (url in table) return Promise.resolve(table[url]);
    throw new Error(`unexpected GET ${url}`);
  });
}

function renderHub() {
  return renderWithClient(
    <MemoryRouter initialEntries={['/projects/p1/assessments']}>
      <Routes>
        <Route path="/projects/:projectId/assessments" element={<AssessmentsHubPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

/** Find the <section> card whose <h3> matches, so New-run clicks stay scoped. */
async function sectionByHeading(name: string): Promise<HTMLElement> {
  const heading = await screen.findByRole('heading', { name, level: 3 });
  return heading.closest('section') as HTMLElement;
}

afterEach(() => vi.restoreAllMocks());

describe('AssessmentsHubPage', () => {
  it('renders every assessment section, the PCT trend, and existing runs', async () => {
    mockGet();
    renderHub();

    // Page title (h2) is distinct from the per-type section titles (h3).
    expect(await screen.findByRole('heading', { name: 'Assessments', level: 2 })).toBeInTheDocument();

    // Two PCT runs with scores => the Organizational Performance trend renders
    // once the assessments query resolves (findBy waits for it).
    expect(
      await screen.findByRole('heading', { name: /Organizational Performance/, level: 3 }),
    ).toBeInTheDocument();

    // All five type sections are present.
    for (const label of [
      'PCT Assessment',
      'ADKAR Assessment',
      'Risk Assessment',
      'Sponsor Competency Assessment',
      'Manager Competency Assessment',
    ]) {
      expect(screen.getByRole('heading', { name: label, level: 3 })).toBeInTheDocument();
    }

    // The PCT section lists its two runs by their default labels.
    const pct = await sectionByHeading('PCT Assessment');
    expect(within(pct).getByRole('link', { name: 'Run 1' })).toBeInTheDocument();
    expect(within(pct).getByRole('link', { name: 'Run 2' })).toBeInTheDocument();

    // Manager competency has no runs -> empty state.
    const manager = await sectionByHeading('Manager Competency Assessment');
    expect(within(manager).getByText('No runs yet.')).toBeInTheDocument();
  });

  it('creates a project-subject run from the PCT section', async () => {
    mockGet();
    const post = vi.spyOn(api, 'post').mockResolvedValue(runs[0]);
    renderHub();

    const pct = await sectionByHeading('PCT Assessment');
    await userEvent.click(within(pct).getByRole('button', { name: 'New run' }));

    await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    expect(post.mock.calls[0]![0]).toBe('/api/projects/p1/assessments');
    expect(post.mock.calls[0]![1]).toEqual({ type: 'pct', subjectKind: 'project' });
  });

  it('creates a person-subject run from a competency section', async () => {
    mockGet();
    const post = vi.spyOn(api, 'post').mockResolvedValue(runs[3]);
    renderHub();

    const sponsor = await sectionByHeading('Sponsor Competency Assessment');
    await userEvent.click(within(sponsor).getByRole('button', { name: 'New run' }));

    await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    expect(post.mock.calls[0]![1]).toEqual({ type: 'sponsor_competency', subjectKind: 'person' });
  });

  it('targets a selected group when creating an ADKAR run', async () => {
    mockGet();
    const post = vi.spyOn(api, 'post').mockResolvedValue(runs[4]);
    renderHub();

    const adkar = await sectionByHeading('ADKAR Assessment');
    // Default target is "Overall Change"; wait for the group option to load (groups
    // query), then switch to it before creating.
    await within(adkar).findByRole('option', { name: 'Group A' });
    await userEvent.selectOptions(within(adkar).getByRole('combobox'), 'g1');
    await userEvent.click(within(adkar).getByRole('button', { name: 'New run' }));

    await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    expect(post.mock.calls[0]![1]).toEqual({ type: 'adkar', subjectKind: 'group', subjectId: 'g1' });
  });
});
