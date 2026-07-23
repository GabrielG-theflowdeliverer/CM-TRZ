import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { BlueprintDto, GroupDto } from '../../lib/types';
import { api } from '../../lib/api';
import { renderWithClient } from '../../test/harness';
import { BlueprintsPage } from './BlueprintsPage';

const blueprint = (over: Partial<BlueprintDto> = {}): BlueprintDto => ({
  id: 'b1',
  projectId: 'p1',
  scopeKind: 'custom',
  groupId: null,
  name: 'Rollout Blueprint',
  notes: null,
  createdAt: '2026-07-01T00:00:00.000Z',
  updatedAt: '2026-07-18T00:00:00.000Z',
  elements: [],
  activities: [],
  groupName: null,
  computed: { milestones: {} },
  ...over,
});

const group = (id: string, name: string): GroupDto =>
  ({
    id,
    projectId: 'p1',
    position: 0,
    name,
    numPeople: null,
    adoptionUsageDefinition: null,
    uniqueConsiderations: null,
    tags: [],
    orgGroupId: null,
    aspects: [],
    adkar: {},
    adkarAssessmentId: null,
    computed: { aspectsImpacted: 0, degreeOfImpact: null, barrierPoint: null, risk: null },
  }) as GroupDto;

function mockGet(over: Record<string, unknown> = {}) {
  const table: Record<string, unknown> = {
    '/api/projects/p1': { id: 'p1', name: 'Project One' },
    '/api/projects/p1/blueprints': [blueprint()],
    '/api/projects/p1/groups': [group('g1', 'Finance Team')],
    ...over,
  };
  return vi.spyOn(api, 'get').mockImplementation((url: string) => {
    if (url in table) return Promise.resolve(table[url]);
    throw new Error(`unexpected GET ${url}`);
  });
}

function renderPage() {
  return renderWithClient(
    <MemoryRouter initialEntries={['/projects/p1/blueprints']}>
      <Routes>
        <Route path="/projects/:projectId/blueprints" element={<BlueprintsPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

afterEach(() => vi.restoreAllMocks());

describe('BlueprintsPage', () => {
  it('lists blueprints with scope and a link into the detail page', async () => {
    mockGet();
    renderPage();

    expect(await screen.findByRole('heading', { name: 'ADKAR Blueprints' })).toBeInTheDocument();
    const link = await screen.findByRole('link', { name: 'Rollout Blueprint' });
    expect(link).toHaveAttribute('href', '/projects/p1/blueprints/b1');
    expect(screen.getByText('Custom')).toBeInTheDocument();
    // Group scope option is offered in the create select.
    expect(screen.getByRole('option', { name: 'Group: Finance Team' })).toBeInTheDocument();
  });

  it('creates a custom-scope blueprint from the form', async () => {
    mockGet();
    const post = vi.spyOn(api, 'post').mockResolvedValue(blueprint({ id: 'b2', name: 'New BP' }));

    renderPage();
    await screen.findByRole('heading', { name: 'ADKAR Blueprints' });

    await userEvent.type(screen.getByPlaceholderText('Blueprint name…'), 'New BP');
    await userEvent.click(screen.getByRole('button', { name: 'Create blueprint' }));

    await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    expect(post.mock.calls[0]![0]).toBe('/api/projects/p1/blueprints');
    expect(post.mock.calls[0]![1]).toEqual({ scopeKind: 'custom', groupId: null, name: 'New BP' });
  });

  it('deletes a blueprint only after confirmation', async () => {
    mockGet();
    const del = vi.spyOn(api, 'del').mockResolvedValue(undefined);
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);

    renderPage();
    const removeButton = await screen.findByRole('button', { name: '✕' });

    // Declining the confirm leaves the blueprint in place.
    await userEvent.click(removeButton);
    expect(del).not.toHaveBeenCalled();

    // Accepting deletes it.
    confirm.mockReturnValue(true);
    await userEvent.click(removeButton);
    await waitFor(() => expect(del).toHaveBeenCalledWith('/api/blueprints/b1'));
  });
});
