import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { api } from '../../lib/api';
import { renderWithClient } from '../../test/harness';
import { SaturationHeatmap } from './SaturationHeatmap';
import type { SaturationDto } from './useSaturation';

afterEach(() => vi.restoreAllMocks());

const payload = (): SaturationDto => ({
  months: ['2026-08', '2026-09'],
  rows: [
    {
      orgGroupId: 'og1',
      orgGroupName: 'Sales',
      cells: [
        { score: 4, band: 'ok', contributions: [{ projectId: 'p1', projectName: 'CRM', load: 4 }] },
        {
          score: 12,
          band: 'overloaded',
          contributions: [
            { projectId: 'p1', projectName: 'CRM', load: 6 },
            { projectId: 'p2', projectName: 'ERP', load: 6 },
          ],
        },
      ],
    },
  ],
  // CRM go-live in Sep drives the Sep cell; moving it out drops that column.
  projects: [
    {
      id: 'p1',
      name: 'CRM',
      startMonth: '2026-06',
      endMonth: '2026-12',
      goliveMonth: '2026-09',
      groups: [{ orgGroupId: 'og1', degree: 4 }],
      roadmap: { kickoffDate: '2026-06-01', goliveDate: '2026-09-15', outcomesDate: '2026-12-01' },
    },
    {
      id: 'p2',
      name: 'ERP',
      startMonth: '2026-09',
      endMonth: '2027-01',
      goliveMonth: '2026-09',
      groups: [{ orgGroupId: 'og1', degree: 4 }],
      roadmap: { kickoffDate: '2026-09-01', goliveDate: '2026-09-20', outcomesDate: '2027-01-15' },
    },
  ],
  unlinkedGroupCount: 2,
});

describe('SaturationHeatmap', () => {
  it('renders unambiguous month labels, banded scores, the coverage nudge, and a breakdown on click', async () => {
    vi.spyOn(api, 'get').mockResolvedValue(payload());
    renderWithClient(<SaturationHeatmap />);

    expect(await screen.findByText('Sales')).toBeInTheDocument();
    // Year is marked with an apostrophe so it can't read as a day-of-month.
    expect(screen.getByText("Aug '26")).toBeInTheDocument();
    expect(screen.getByText("Sep '26")).toBeInTheDocument();
    expect(screen.getByText(/2 impacted groups .* aren.t linked/)).toBeInTheDocument();

    const overloaded = screen.getByRole('button', { name: '12' });
    expect(overloaded.className).toContain('bg-red-200');
    await userEvent.click(overloaded);
    expect(screen.getByText(/CRM \(6\) \+ ERP \(6\)/)).toBeInTheDocument();
  });

  it('recomputes the grid live when a project is re-sequenced (what-if)', async () => {
    vi.spyOn(api, 'get').mockResolvedValue(payload());
    renderWithClient(<SaturationHeatmap />);
    await screen.findByText('Sales');

    // Sep starts overloaded at 12 (CRM 6 + ERP 6, both at their Sep go-live).
    expect(screen.getByRole('button', { name: '12' })).toBeInTheDocument();

    // Push CRM's whole timeline out 4 months: its window clears September, so
    // Sep drops to ERP alone at its go-live (4 × 1.5 = 6).
    const crmSlider = screen.getByLabelText(/shift crm go-live/i);
    fireEvent.change(crmSlider, { target: { value: '4' } });

    expect(screen.queryByRole('button', { name: '12' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '6' })).toBeInTheDocument();
    expect(screen.getByText(/go-live Jan '27/)).toBeInTheDocument();

    // Reset restores the server view.
    await userEvent.click(screen.getByRole('button', { name: /reset/i }));
    expect(screen.getByRole('button', { name: '12' })).toBeInTheDocument();
  });

  it('nudges toward linking when there is nothing to show yet', async () => {
    vi.spyOn(api, 'get').mockResolvedValue({ months: [], rows: [], projects: [], unlinkedGroupCount: 0 });
    renderWithClient(<SaturationHeatmap />);
    expect(await screen.findByText(/link impacted groups to organization groups/i)).toBeInTheDocument();
  });
});
