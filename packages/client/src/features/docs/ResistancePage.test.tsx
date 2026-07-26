import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ASPECT_KEYS } from '@cmt/domain';
import { api } from '../../lib/api';
import { renderWithClient } from '../../test/harness';
import type { GroupDto, ResistanceItem } from '../../lib/types';
import { ResistancePage } from './ResistancePage';

afterEach(() => vi.restoreAllMocks());

const project = {
  id: 'p1',
  name: 'P',
  projectType: null,
  pmApproach: null,
  status: 'Active',
  watchGroupIds: [],
  createdAt: 'x',
  updatedAt: 'x',
};

const group = (id: string, name: string): GroupDto => ({
  id,
  projectId: 'p1',
  position: 0,
  name,
  numPeople: null,
  adoptionUsageDefinition: null,
  uniqueConsiderations: null,
  tags: [],
  orgGroupId: null,
  aspects: ASPECT_KEYS.map((aspectKey) => ({ aspectKey, yesterday: null, tomorrow: null, impact: null })),
  adkar: {},
  adkarAssessmentId: null,
  computed: { aspectsImpacted: 0, degreeOfImpact: null, barrierPoint: null, risk: null },
});

const item = (over: Partial<ResistanceItem> = {}): ResistanceItem => ({
  id: 'r1',
  projectId: 'p1',
  position: 0,
  groupId: 'g1',
  groupLabel: null,
  anticipatedResistance: 'Loss of autonomy',
  specialTactics: null,
  ...over,
});

function mockGet(items: ResistanceItem[]) {
  const table: Record<string, unknown> = {
    '/api/projects/p1': project,
    '/api/projects/p1/groups': [group('g1', 'Sales'), group('g2', 'Ops')],
    '/api/projects/p1/resistance': items,
  };
  return vi.spyOn(api, 'get').mockImplementation((url: string) => {
    if (url in table) return Promise.resolve(table[url]);
    throw new Error(`unexpected GET ${url}`);
  });
}

function renderPage() {
  return renderWithClient(
    <MemoryRouter initialEntries={['/projects/p1/resistance']}>
      <Routes>
        <Route path="/projects/:projectId/resistance" element={<ResistancePage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ResistancePage', () => {
  it('shows an empty state before any rows exist', async () => {
    mockGet([]);
    renderPage();
    expect(await screen.findByText('No resistance rows yet.')).toBeInTheDocument();
  });

  it('lists a row resolving its group id to that group name', async () => {
    mockGet([item()]);
    renderPage();
    await screen.findByDisplayValue('Loss of autonomy');
    // groupId g1 wins over groupLabel — the row shows the live group's name.
    expect(screen.getByRole('combobox')).toHaveValue('Sales');
  });

  it('falls back to the free-text label when the row has no linked group', async () => {
    mockGet([item({ groupId: null, groupLabel: 'Contractors' })]);
    renderPage();
    await screen.findByDisplayValue('Loss of autonomy');
    // 'Contractors' isn't a project group, so the select holds it as free text.
    expect(screen.getByRole('combobox')).toHaveValue('');
  });

  it('adds a row', async () => {
    mockGet([]);
    const post = vi.spyOn(api, 'post').mockResolvedValue(item());
    renderPage();
    await screen.findByText('No resistance rows yet.');

    await userEvent.click(screen.getByRole('button', { name: 'Add row' }));
    await waitFor(() => expect(post).toHaveBeenCalledWith('/api/projects/p1/resistance', {}));
  });

  it('links a row to a group by name, clearing any free-text label', async () => {
    mockGet([item({ groupId: null, groupLabel: null })]);
    const patch = vi.spyOn(api, 'patch').mockResolvedValue(item());
    renderPage();
    await screen.findByDisplayValue('Loss of autonomy');

    await userEvent.selectOptions(screen.getByRole('combobox'), 'Ops');
    await waitFor(() =>
      expect(patch).toHaveBeenCalledWith('/api/resistance/r1', { groupId: 'g2', groupLabel: null }),
    );
  });

  it('saves an edited tactic on blur', async () => {
    mockGet([item()]);
    const patch = vi.spyOn(api, 'patch').mockResolvedValue(item());
    renderPage();
    const row = await screen.findByRole('row', { name: /Loss of autonomy/i });

    // Second textbox in the row is Special Tactics.
    const boxes = within(row).getAllByRole('textbox');
    await userEvent.type(boxes[1]!, 'Sponsor roadshow');
    await userEvent.tab();

    await waitFor(() =>
      expect(patch).toHaveBeenCalledWith('/api/resistance/r1', { specialTactics: 'Sponsor roadshow' }),
    );
  });

  it('only deletes once the confirm is accepted', async () => {
    mockGet([item()]);
    const del = vi.spyOn(api, 'del').mockResolvedValue(undefined);
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderPage();
    await screen.findByDisplayValue('Loss of autonomy');

    await userEvent.click(screen.getByRole('button', { name: '✕' }));
    expect(confirmSpy).toHaveBeenCalled();
    expect(del).not.toHaveBeenCalled();

    confirmSpy.mockReturnValue(true);
    await userEvent.click(screen.getByRole('button', { name: '✕' }));
    await waitFor(() => expect(del).toHaveBeenCalledWith('/api/resistance/r1'));
  });
});
