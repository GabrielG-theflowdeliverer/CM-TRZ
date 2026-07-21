import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
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
  unlinkedGroupCount: 2,
});

describe('SaturationHeatmap', () => {
  it('renders months, banded scores, the coverage nudge, and a contribution breakdown on click', async () => {
    vi.spyOn(api, 'get').mockResolvedValue(payload());
    renderWithClient(<SaturationHeatmap />);

    expect(await screen.findByText('Sales')).toBeInTheDocument();
    expect(screen.getByText('Aug 26')).toBeInTheDocument();
    expect(screen.getByText('Sep 26')).toBeInTheDocument();
    expect(screen.getByText(/2 impacted groups .* aren.t linked/)).toBeInTheDocument();
    // Honest-limits label, per spec.
    expect(screen.getByText(/not a Prosci score/i)).toBeInTheDocument();

    const overloaded = screen.getByRole('button', { name: '12' });
    expect(overloaded.className).toContain('bg-red-200');
    await userEvent.click(overloaded);
    expect(screen.getByText(/CRM \(6\) \+ ERP \(6\)/)).toBeInTheDocument();
  });

  it('nudges toward linking when there is nothing to show yet', async () => {
    vi.spyOn(api, 'get').mockResolvedValue({ months: [], rows: [], unlinkedGroupCount: 0 });
    renderWithClient(<SaturationHeatmap />);
    expect(await screen.findByText(/link impacted groups to organization groups/i)).toBeInTheDocument();
  });
});
