import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

  it('renders the results block (distribution + individuals) only when a survey roll-up is present', async () => {
    const survey: AssessmentSurveyView = {
      respondentCount: 2,
      distribution: { sponsor_competency_0_0: { 3: 1, 5: 1 } },
      individuals: [
        { personName: 'Jane Doe', computed: { competency: { total: 40, interpretation: null } } },
        { personName: 'Al Roe', computed: { competency: { total: 22, interpretation: null } } },
      ],
    };

    // Without a survey: no results.
    const { unmount } = renderWithClient(<AssessmentSurveyPanel run={run()} projectId="p1" />);
    mockGet();
    await screen.findByText('Choose role-holders…');
    expect(screen.queryByText(/respondent/)).not.toBeInTheDocument();
    unmount();
    vi.restoreAllMocks();

    // With a survey: results appear.
    mockGet();
    renderWithClient(<AssessmentSurveyPanel run={run({ survey })} projectId="p1" />);
    expect(await screen.findByText(/2 respondents/)).toBeInTheDocument();
    const individuals = screen.getByText('Individual submissions').closest('div')!;
    expect(within(individuals).getByText('Jane Doe')).toBeInTheDocument();
    expect(within(individuals).getByText('Total 40')).toBeInTheDocument();
    expect(within(individuals).getByText('Total 22')).toBeInTheDocument();
    // Distribution chips.
    expect(screen.getByText('3: 1')).toBeInTheDocument();
    expect(screen.getByText('5: 1')).toBeInTheDocument();
  });
});
