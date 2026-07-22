import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { api } from '../../lib/api';
import { renderWithClient } from '../../test/harness';
import type { OutcomesDto } from './useOutcomes';
import { OutcomesPage } from './OutcomesPage';

afterEach(() => vi.restoreAllMocks());

const project = {
  id: 'p1', name: 'P', projectType: null, pmApproach: null,
  status: 'Active', watchGroupIds: [], createdAt: 'x', updatedAt: 'x',
};

const outcomes: OutcomesDto = {
  realization: 50,
  objectives: [
    {
      id: 'o1', projectId: 'p1', level: 'organization', statement: 'Cut handling time', notes: null, createdAt: 'x',
      realization: 50,
      metrics: [
        {
          id: 'm1', projectId: 'p1', objectiveId: 'o1', kind: 'benefit', name: 'Handling time',
          unit: 'min', baseline: 10, target: 5, direction: 'decrease', adoptionMeasure: null, groupId: null, createdAt: 'x',
          measurements: [{ id: 'x1', metricId: 'm1', date: '2026-06-01', value: 9 }, { id: 'x2', metricId: 'm1', date: '2026-08-01', value: 7.5 }],
          computed: { current: 7.5, pct: 50 },
        },
      ],
    },
  ],
};

function mockGet(over: Partial<OutcomesDto> | null = null) {
  const table: Record<string, unknown> = {
    '/api/projects/p1': project,
    '/api/projects/p1/outcomes': over ? { ...outcomes, ...over } : outcomes,
    '/api/projects/p1/groups': [],
  };
  return vi.spyOn(api, 'get').mockImplementation((url: string) => {
    if (url in table) return Promise.resolve(table[url]);
    throw new Error(`unexpected GET ${url}`);
  });
}

function renderPage() {
  return renderWithClient(
    <MemoryRouter initialEntries={['/projects/p1/outcomes']}>
      <Routes>
        <Route path="/projects/:projectId/outcomes" element={<OutcomesPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('OutcomesPage', () => {
  it('shows overall realization, the objective and its metric with current/target', async () => {
    mockGet();
    renderPage();
    await screen.findByText('Cut handling time');
    // Overall realization headline.
    expect(screen.getByText('of success realized')).toBeInTheDocument();
    expect(screen.getAllByText('50%').length).toBeGreaterThan(0);
    // Metric with baseline -> current -> target.
    expect(screen.getByText('Handling time')).toBeInTheDocument();
    expect(screen.getByText(/current/)).toHaveTextContent('7.5');
  });

  it('adds an objective through the form', async () => {
    mockGet({ objectives: [], realization: null });
    const post = vi.spyOn(api, 'post').mockResolvedValue({ id: 'o2' });
    renderPage();
    await screen.findByText(/No success objectives yet/i);

    await userEvent.type(screen.getByPlaceholderText(/Cut average handling time/i), 'Grow NPS');
    await userEvent.click(screen.getByRole('button', { name: /Add objective/i }));
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith('/api/projects/p1/objectives', { level: 'organization', statement: 'Grow NPS' }),
    );
  });

  it('logs a measurement against a metric', async () => {
    mockGet();
    const post = vi.spyOn(api, 'post').mockResolvedValue({ id: 'x3' });
    renderPage();
    await screen.findByText('Handling time');

    // The metric's inline date + value + Log.
    const dateInput = document.querySelector('input[type="date"]') as HTMLInputElement;
    const valueInput = screen.getByPlaceholderText('value');
    await userEvent.type(dateInput, '2026-09-01');
    await userEvent.type(valueInput, '6');
    await userEvent.click(screen.getByRole('button', { name: 'Log' }));

    await waitFor(() =>
      expect(post).toHaveBeenCalledWith('/api/metrics/m1/measurements', { date: '2026-09-01', value: 6 }),
    );
  });
});
