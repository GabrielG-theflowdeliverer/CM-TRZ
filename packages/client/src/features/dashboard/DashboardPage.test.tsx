import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { api } from '../../lib/api';
import { renderWithClient } from '../../test/harness';
import type { DashboardDto, ProjectHealthDto } from '../../lib/types';
import { DashboardPage } from './DashboardPage';

afterEach(() => vi.restoreAllMocks());

const health = (over: Partial<ProjectHealthDto> = {}): ProjectHealthDto => ({
  projectId: 'p1',
  name: 'CRM Rollout',
  projectType: null,
  pmApproach: null,
  pct: null,
  risk: null,
  groupCount: 2,
  totalPeople: 50,
  avgDegreeOfImpact: 3,
  barrierDistribution: {},
  progress: { percentComplete: 50, completed: 1, total: 2, inProgress: 1, notStarted: 0 },
  overdueCount: 0,
  latestCmPerfStatus: null,
  nextMilestone: null,
  outcomes: { realization: 72, adoption: 80, benefit: 64, metricCount: 3, measuredCount: 3 },
  checksDueSoon: 0,
  ...over,
});

const dashboard = (projects: ProjectHealthDto[]): DashboardDto => ({
  summary: { totalProjects: projects.length, highRiskCount: 0, overdueActivities: 0, checksDueSoon: 0, avgRealization: 72 },
  projects,
  correlationPoints: [
    { projectId: 'p1', projectName: 'Alpha Project', group: 'Sales', adkar: 4, adoption: 80, barrier: null },
    { projectId: 'p2', projectName: 'Beta Project', group: 'Ops', adkar: 2, adoption: 30, barrier: 'Desire' },
  ],
  generatedAt: 'x',
});

function mockGet(payload: DashboardDto) {
  const table: Record<string, unknown> = {
    '/api/dashboard': payload,
    '/api/dashboard/saturation': { months: [], rows: [], projects: [], unlinkedGroupCount: 0 },
  };
  return vi.spyOn(api, 'get').mockImplementation((url: string) => {
    if (url in table) return Promise.resolve(table[url]);
    throw new Error(`unexpected GET ${url}`);
  });
}

function renderDashboard() {
  return renderWithClient(
    <MemoryRouter initialEntries={['/dashboard']}>
      <DashboardPage />
    </MemoryRouter>,
  );
}

describe('DashboardPage', () => {
  it('shows the portfolio avg realization and each project card with its benefit-realized bar', async () => {
    // Three projects at different realization levels exercise the band colours.
    const projects = [
      health(), // 72 -> indigo
      health({ projectId: 'p2', name: 'ERP', outcomes: { realization: 100, adoption: 100, benefit: 100, metricCount: 2, measuredCount: 2 } }), // green
      health({ projectId: 'p3', name: 'O365', outcomes: { realization: 40, adoption: 40, benefit: 40, metricCount: 2, measuredCount: 2 } }), // amber
    ];
    mockGet(dashboard(projects));
    renderDashboard();

    // The stats render after the dashboard query resolves.
    await screen.findByText('Avg benefit realized');
    expect(screen.getByText('CRM Rollout')).toBeInTheDocument();
    expect(screen.getAllByText('Benefit realized')).toHaveLength(3);
    expect(screen.getByText(/adoption 80% · benefit 64%/)).toBeInTheDocument();
    // Pooled correlation renders per-project (dots coloured by project): the
    // project name flows through to the table, distinct from the project cards.
    expect(screen.getByRole('columnheader', { name: 'Project' })).toBeInTheDocument();
    expect(screen.getByText('Alpha Project')).toBeInTheDocument();
    expect(screen.getByText('Beta Project')).toBeInTheDocument();
  });

  it('scopes the dashboard to the selected projects', async () => {
    const projects = [health(), health({ projectId: 'p2', name: 'ERP Migration' })];
    mockGet(dashboard(projects));
    renderDashboard();

    await screen.findByText('Avg benefit realized');
    // Both project cards present (cards are links; dropdown options are checkboxes).
    expect(screen.getByRole('link', { name: 'CRM Rollout' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'ERP Migration' })).toBeInTheDocument();

    // Filter to ERP only.
    await userEvent.click(screen.getByRole('button', { name: 'All projects' }));
    await userEvent.click(screen.getByRole('checkbox', { name: 'ERP Migration' }));

    expect(screen.queryByRole('link', { name: 'CRM Rollout' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'ERP Migration' })).toBeInTheDocument();
  });

  it('shows the no-metrics state for a project without outcomes', async () => {
    const p = health({ outcomes: { realization: null, adoption: null, benefit: null, metricCount: 0, measuredCount: 0 } });
    mockGet(dashboard([p]));
    renderDashboard();
    await screen.findByText('CRM Rollout');
    expect(screen.getByText('No outcome metrics')).toBeInTheDocument();
  });
});
