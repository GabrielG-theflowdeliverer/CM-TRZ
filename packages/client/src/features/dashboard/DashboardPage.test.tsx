import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { screen } from '@testing-library/react';
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
  ...over,
});

const dashboard = (projects: ProjectHealthDto[]): DashboardDto => ({
  summary: { totalProjects: projects.length, highRiskCount: 0, overdueActivities: 0, checksDueSoon: 0, avgRealization: 72 },
  projects,
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
  });

  it('shows the no-metrics state for a project without outcomes', async () => {
    const p = health({ outcomes: { realization: null, adoption: null, benefit: null, metricCount: 0, measuredCount: 0 } });
    mockGet(dashboard([p]));
    renderDashboard();
    await screen.findByText('CRM Rollout');
    expect(screen.getByText('No outcome metrics')).toBeInTheDocument();
  });
});
