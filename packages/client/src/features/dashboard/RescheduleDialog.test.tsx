import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { api } from '../../lib/api';
import { renderWithClient } from '../../test/harness';
import { RescheduleDialog } from './RescheduleDialog';
import type { SaturationProjectDto } from './useSaturation';

afterEach(() => vi.restoreAllMocks());

const project = (over: Partial<SaturationProjectDto> = {}): SaturationProjectDto => ({
  id: 'p1',
  name: 'CRM',
  startMonth: '2026-06',
  endMonth: '2026-12',
  goliveMonth: '2026-09',
  groups: [{ orgGroupId: 'og1', degree: 4 }],
  roadmap: { kickoffDate: '2026-06-01', goliveDate: '2026-09-15', outcomesDate: '2026-12-01' },
  ...over,
});

function render(projects: SaturationProjectDto[], shifts: Record<string, number>) {
  const onApplied = vi.fn();
  const onClose = vi.fn();
  renderWithClient(
    <RescheduleDialog projects={projects} shifts={shifts} onClose={onClose} onApplied={onApplied} />,
  );
  return { onApplied, onClose };
}

describe('RescheduleDialog', () => {
  it('lists only shifted projects with month-shifted proposed dates and applies checked rows', async () => {
    const put = vi.spyOn(api, 'put').mockResolvedValue({});
    const crm = project(); // shifted +3
    const erp = project({ id: 'p2', name: 'ERP' }); // not shifted -> excluded
    const { onApplied } = render([crm, erp], { p1: 3 });

    // Only CRM is listed (ERP has no shift).
    expect(screen.getByText('CRM')).toBeInTheDocument();
    expect(screen.queryByText('ERP')).not.toBeInTheDocument();

    // Proposed dates are the roadmap dates shifted +3 months.
    expect(screen.getByDisplayValue('2026-09-01')).toBeInTheDocument(); // kickoff Jun -> Sep
    expect(screen.getByDisplayValue('2026-12-15')).toBeInTheDocument(); // go-live Sep -> Dec
    expect(screen.getByDisplayValue('2027-03-01')).toBeInTheDocument(); // outcomes Dec -> Mar

    await userEvent.click(screen.getByRole('button', { name: /apply selected \(1\)/i }));

    await waitFor(() => expect(put).toHaveBeenCalledTimes(1));
    expect(put).toHaveBeenCalledWith('/api/projects/p1/roadmap', {
      kickoffDate: '2026-09-01',
      goliveDate: '2026-12-15',
      outcomesDate: '2027-03-01',
    });
    expect(onApplied).toHaveBeenCalledWith(['p1']);
  });

  it('excludes an unchecked project and honours a manually edited date', async () => {
    const put = vi.spyOn(api, 'put').mockResolvedValue({});
    const erp = project({
      id: 'p2',
      name: 'ERP',
      roadmap: { kickoffDate: '2026-07-01', goliveDate: '2026-10-10', outcomesDate: '2027-01-01' },
    });
    render([project(), erp], { p1: 1, p2: 1 });

    // Uncheck ERP; edit CRM's go-live (Sep 15 +1 = Oct 15) by hand.
    await userEvent.click(screen.getByLabelText('Apply ERP'));
    fireEvent.change(screen.getByDisplayValue('2026-10-15'), { target: { value: '2026-11-30' } });

    await userEvent.click(screen.getByRole('button', { name: /apply selected \(1\)/i }));

    await waitFor(() => expect(put).toHaveBeenCalledTimes(1)); // only CRM
    expect(put).toHaveBeenCalledWith(
      '/api/projects/p1/roadmap',
      expect.objectContaining({ goliveDate: '2026-11-30' }),
    );
  });

  it('blocks a shifted project that has no roadmap dates to move', () => {
    const noDates = project({
      id: 'p3',
      name: 'Skunkworks',
      roadmap: { kickoffDate: null, goliveDate: null, outcomesDate: null },
    });
    render([noDates], { p3: 2 });
    expect(screen.getByText(/no roadmap dates to move/i)).toBeInTheDocument();
    // Nothing to apply.
    expect(screen.getByRole('button', { name: /apply selected \(0\)/i })).toBeDisabled();
  });
});
