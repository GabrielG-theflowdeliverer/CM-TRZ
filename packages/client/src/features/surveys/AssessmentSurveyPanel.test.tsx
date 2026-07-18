import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { surveyStructure } from '@cmt/domain';
import type { RoleDto } from '../../lib/types';
import type { AssessmentDto, AssessmentSurveyView } from '../../lib/types';
import { api } from '../../lib/api';
import { renderWithClient } from '../../test/harness';
import { AssessmentSurveyPanel } from './AssessmentSurveyPanel';

const run = (over: Partial<AssessmentDto> = {}): AssessmentDto => ({
  id: 'a1',
  projectId: 'p1',
  type: 'sponsor_competency',
  subjectKind: 'person',
  subjectId: null,
  label: null,
  scheduledDate: null,
  completedDate: null,
  status: null,
  notes: null,
  createdAt: '2026-07-18T00:00:00.000Z',
  responses: {},
  computed: {},
  ...over,
});

const role = (id: string, personName: string | null, roleName: string | null): RoleDto =>
  ({
    id,
    projectId: 'p1',
    roster: 'sponsors',
    position: 0,
    roleName,
    personName,
    roleDefinition: null,
    support: null,
    influence: null,
    activationTactics: null,
    groupIds: [],
    adkar: {},
    adkarAssessmentId: null,
    computed: { barrierPoint: null },
  }) as RoleDto;

/** Route api.get by URL so the panel's several queries each resolve. */
function mockGet(over: Record<string, unknown> = {}) {
  const table: Record<string, unknown> = {
    '/api/projects/p1/surveys': [],
    '/api/projects/p1/roles': [role('r1', 'Jane Doe', 'Executive Sponsor'), role('r2', null, 'Vacant')],
    ...over,
  };
  return vi.spyOn(api, 'get').mockImplementation((url: string) => {
    if (url in table) return Promise.resolve(table[url]);
    throw new Error(`unexpected GET ${url}`);
  });
}

afterEach(() => vi.restoreAllMocks());

describe('AssessmentSurveyPanel', () => {
  it('launches a campaign for the selected named role-holders', async () => {
    mockGet();
    const post = vi.spyOn(api, 'post').mockResolvedValue({
      id: 'c1',
      projectId: 'p1',
      assessmentId: 'a1',
      createdAt: 'x',
      recipients: [],
    });

    renderWithClient(<AssessmentSurveyPanel run={run()} projectId="p1" />);

    // Open the multi-select; only the named role-holder is offered (r2 is vacant).
    await userEvent.click(await screen.findByText('Choose role-holders…'));
    expect(screen.getByText('Jane Doe — Executive Sponsor')).toBeInTheDocument();
    expect(screen.queryByText(/Vacant/)).not.toBeInTheDocument();

    await userEvent.click(screen.getByLabelText('Jane Doe — Executive Sponsor'));
    await userEvent.click(screen.getByRole('button', { name: /send as survey/i }));

    await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    expect(post.mock.calls[0]![1]).toEqual({ assessmentId: 'a1', roleIds: ['r1'] });
  });

  it('shows recipients with a copy link and submission progress once a campaign exists', async () => {
    mockGet({
      '/api/projects/p1/surveys': [
        { id: 'c1', assessmentId: 'a1', createdAt: 'x', recipientCount: 2, submittedCount: 1 },
      ],
      '/api/surveys/c1': {
        id: 'c1',
        projectId: 'p1',
        assessmentId: 'a1',
        createdAt: 'x',
        recipients: [
          { id: 'rc1', roleId: 'r1', personName: 'Jane Doe', roleName: 'Sponsor', token: 'tok-1', submittedAt: 'y' },
          { id: 'rc2', roleId: 'r2', personName: 'Al Roe', roleName: 'Manager', token: 'tok-2', submittedAt: null },
        ],
      },
    });

    renderWithClient(<AssessmentSurveyPanel run={run()} projectId="p1" />);

    expect(await screen.findByText('1/2 submitted')).toBeInTheDocument();
    expect(screen.getByText('Jane Doe')).toBeInTheDocument();
    expect(screen.getByText('Submitted')).toBeInTheDocument();
    expect(screen.getByText('Pending')).toBeInTheDocument();
    // No launch control while a campaign is active.
    expect(screen.queryByText('Choose role-holders…')).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /copy link/i })).toHaveLength(2);
  });

  it('renders a per-respondent results matrix (name columns + section totals) only when a roll-up is present', async () => {
    const struct = surveyStructure('sponsor_competency');
    const allItems = struct.groups.flatMap((g) => g.items);
    const answerAll = (v: number) => Object.fromEntries(allItems.map((it) => [it.key, v]));
    const survey: AssessmentSurveyView = {
      respondentCount: 2,
      individuals: [
        { personName: 'Jane Doe', responses: answerAll(4), computed: { competency: { total: 4 * allItems.length, interpretation: null } } },
        { personName: 'Al Roe', responses: answerAll(2), computed: { competency: { total: 2 * allItems.length, interpretation: null } } },
      ],
    };

    // Without a survey: no results matrix.
    const { unmount } = renderWithClient(<AssessmentSurveyPanel run={run()} projectId="p1" />);
    mockGet();
    await screen.findByText('Choose role-holders…');
    expect(screen.queryByText(/respondent/)).not.toBeInTheDocument();
    unmount();
    vi.restoreAllMocks();

    // With a survey: the matrix appears.
    mockGet();
    renderWithClient(<AssessmentSurveyPanel run={run({ survey })} projectId="p1" />);
    expect(await screen.findByText(/2 respondents/)).toBeInTheDocument();

    // Respondent names head their own columns.
    expect(screen.getByText('Jane Doe')).toBeInTheDocument();
    expect(screen.getByText('Al Roe')).toBeInTheDocument();

    // Each respondent's answers fill their column (one cell per item).
    expect(screen.getAllByText('4').length).toBeGreaterThanOrEqual(allItems.length);
    expect(screen.getAllByText('2').length).toBeGreaterThanOrEqual(allItems.length);

    // One "Section total" row per section, with the summed values.
    expect(screen.getAllByText('Section total')).toHaveLength(struct.groups.length);
    const g0 = struct.groups[0]!;
    expect(screen.getAllByText(String(4 * g0.items.length)).length).toBeGreaterThan(0);
    expect(screen.getAllByText(String(2 * g0.items.length)).length).toBeGreaterThan(0);

    // The old "value: count" distribution format is gone.
    expect(screen.queryByText('2: 1')).not.toBeInTheDocument();
  });
});
