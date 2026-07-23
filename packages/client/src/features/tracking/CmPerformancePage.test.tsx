import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { CmPerfReport } from '../../lib/types';
import { api } from '../../lib/api';
import { renderWithClient } from '../../test/harness';
import { CmPerformancePage, CmPerfReportPage } from './CmPerformancePage';

const item = (over: Partial<CmPerfReport['items'][number]>): CmPerfReport['items'][number] => ({
  id: 'it1',
  reportId: 'rep1',
  position: 0,
  kind: 'blueprint',
  refId: null,
  label: 'Awareness Blueprint',
  status: null,
  description: null,
  ...over,
});

const report = (over: Partial<CmPerfReport> = {}): CmPerfReport => ({
  id: 'rep1',
  projectId: 'p1',
  name: 'Q3 status check',
  date: '2026-07-01',
  status: 'On Target',
  createdAt: '2026-07-01T00:00:00.000Z',
  items: [item({ id: 'it1', status: 'On Target' }), item({ id: 'it2', status: null })],
  ...over,
});

/** api.get router for the report-list page (useProject + useCmPerfReports). */
function mockList(reports: CmPerfReport[]) {
  return vi.spyOn(api, 'get').mockImplementation((url: string) => {
    if (url === '/api/projects/p1') return Promise.resolve({ id: 'p1', name: 'P' });
    if (url === '/api/projects/p1/cm-perf-reports') return Promise.resolve(reports);
    throw new Error(`unexpected GET ${url}`);
  });
}

/** api.get router for the report-detail page (useProject + useCmPerfReport). */
function mockDetail(r: CmPerfReport) {
  return vi.spyOn(api, 'get').mockImplementation((url: string) => {
    if (url === '/api/projects/p1') return Promise.resolve({ id: 'p1', name: 'P' });
    if (url === `/api/cm-perf-reports/${r.id}`) return Promise.resolve(r);
    throw new Error(`unexpected GET ${url}`);
  });
}

function renderList() {
  return renderWithClient(
    <MemoryRouter initialEntries={['/projects/p1/cm-performance']}>
      <Routes>
        <Route path="/projects/:projectId/cm-performance" element={<CmPerformancePage />} />
      </Routes>
    </MemoryRouter>,
  );
}

function renderDetail() {
  return renderWithClient(
    <MemoryRouter initialEntries={['/projects/p1/cm-performance/rep1']}>
      <Routes>
        <Route path="/projects/:projectId/cm-performance/:reportId" element={<CmPerfReportPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

afterEach(() => vi.restoreAllMocks());

describe('CmPerformancePage (report list)', () => {
  it('lists reports with a detail link and the assessed-items count', async () => {
    mockList([report()]);
    renderList();

    expect(await screen.findByRole('heading', { name: 'CM Performance Reports' })).toBeInTheDocument();
    const link = await screen.findByRole('link', { name: 'Q3 status check' });
    expect(link).toHaveAttribute('href', '/projects/p1/cm-performance/rep1');
    // One of two items has a status set.
    expect(screen.getByText('1/2 assessed')).toBeInTheDocument();
  });

  it('shows the empty state when no reports exist', async () => {
    mockList([]);
    renderList();

    expect(await screen.findByText(/No reports yet/)).toBeInTheDocument();
  });

  it('creates a report from the add form', async () => {
    mockList([]);
    const post = vi.spyOn(api, 'post').mockResolvedValue(report());
    renderList();

    await screen.findByRole('heading', { name: 'CM Performance Reports' });
    await userEvent.type(screen.getByPlaceholderText(/Report name/), 'New report');
    await userEvent.click(screen.getByRole('button', { name: 'Add report' }));

    await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    expect(post.mock.calls[0]![0]).toBe('/api/projects/p1/cm-perf-reports');
    expect(post.mock.calls[0]![1]).toMatchObject({ name: 'New report' });
  });
});

describe('CmPerfReportPage (report detail)', () => {
  it('renders report sections grouped by item kind', async () => {
    mockDetail(
      report({
        items: [
          item({ id: 'it1', kind: 'blueprint', label: 'Awareness Blueprint', status: 'On Target' }),
          item({ id: 'it2', kind: 'plan', label: 'Communications Plan' }),
          item({ id: 'it3', kind: 'plan', label: null }),
        ],
      }),
    );
    renderDetail();

    expect(
      await screen.findByRole('heading', { name: /CM Performance Report — Q3 status check/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'ADKAR Blueprints' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Change Management Plans' })).toBeInTheDocument();
    expect(screen.getByText('Awareness Blueprint')).toBeInTheDocument();
    expect(screen.getByText('Communications Plan')).toBeInTheDocument();
    // An item with a status shows its badge (scoped to its own cell, not the status
    // <select> options); a label-less item falls back to "(deleted)".
    const blueprintCell = screen.getByText('Awareness Blueprint').closest('td') as HTMLElement;
    expect(within(blueprintCell).getByText('On Target')).toBeInTheDocument();
    expect(screen.getByText('(deleted)')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /All reports/ })).toBeInTheDocument();
  });

  it('saves a metric-status change on an item', async () => {
    mockDetail(report({ items: [item({ id: 'it1', kind: 'blueprint', status: null })] }));
    const patch = vi.spyOn(api, 'patch').mockResolvedValue(report());
    renderDetail();

    await screen.findByRole('heading', { name: /CM Performance Report/ });
    // Comboboxes: [0] = report status (top), [1] = the single item's metric status.
    const selects = screen.getAllByRole('combobox');
    await userEvent.selectOptions(selects[1]!, 'On Target');

    await waitFor(() => expect(patch).toHaveBeenCalledTimes(1));
    expect(patch.mock.calls[0]![0]).toBe('/api/cm-perf-items/it1');
    expect(patch.mock.calls[0]![1]).toEqual({ status: 'On Target' });
  });
});
