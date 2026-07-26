import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { api } from '../../lib/api';
import { renderWithClient } from '../../test/harness';
import type { BlueprintDto } from '../../lib/types';
import { useBlueprintMutations, useSnapshots } from './useBlueprints';

/**
 * The page tests reach create, delete and add-activity. The rest of
 * `useBlueprintMutations` — element edits, activity edits, and the snapshot
 * pair — had no coverage at all, so a wrong URL or payload key in any of them
 * would ship silently and only show up as a save that quietly does nothing.
 * These pin each request the hook makes.
 */

afterEach(() => vi.restoreAllMocks());

const blueprint = { id: 'b1', name: 'Overall' } as unknown as BlueprintDto;

/** Buttons rather than a captured hook object, so each case reads as a user action. */
function Harness() {
  const m = useBlueprintMutations('p1', 'b1');
  const { data: snapshots } = useSnapshots('b1');
  return (
    <div>
      <button onClick={() => m.update.mutate({ id: 'b1', fields: { name: 'Renamed' } })}>rename</button>
      <button onClick={() => m.saveElement.mutate({ id: 'b1', element: 'awareness', fields: { gaugeGap: 'Gap' } })}>
        save-element
      </button>
      <button onClick={() => m.updateActivity.mutate({ activityId: 'a1', fields: { status: 'Completed' } })}>
        update-activity
      </button>
      <button onClick={() => m.removeActivity.mutate('a1')}>remove-activity</button>
      <button onClick={() => m.takeSnapshot.mutate({ id: 'b1', label: 'Baseline' })}>snapshot</button>
      <button onClick={() => m.deleteSnapshot.mutate('s1')}>delete-snapshot</button>
      <span>snapshots:{snapshots?.length ?? '-'}</span>
    </div>
  );
}

function renderHarness() {
  vi.spyOn(api, 'get').mockResolvedValue([{ id: 's1', label: 'Baseline' }] as never);
  return renderWithClient(<Harness />);
}

describe('useBlueprintMutations', () => {
  it('renames a blueprint through the item route', async () => {
    const patch = vi.spyOn(api, 'patch').mockResolvedValue(blueprint);
    renderHarness();
    await userEvent.click(screen.getByRole('button', { name: 'rename' }));
    await waitFor(() => expect(patch).toHaveBeenCalledWith('/api/blueprints/b1', { name: 'Renamed' }));
  });

  it('flattens the element name into the elements payload', async () => {
    const put = vi.spyOn(api, 'put').mockResolvedValue(blueprint);
    renderHarness();
    await userEvent.click(screen.getByRole('button', { name: 'save-element' }));
    // `element` sits alongside the fields, not nested — the server reads it flat.
    await waitFor(() =>
      expect(put).toHaveBeenCalledWith('/api/blueprints/b1/elements', { element: 'awareness', gaugeGap: 'Gap' }),
    );
  });

  it('edits and removes a blueprint activity by activity id', async () => {
    const patch = vi.spyOn(api, 'patch').mockResolvedValue(blueprint);
    const del = vi.spyOn(api, 'del').mockResolvedValue(blueprint);
    renderHarness();

    await userEvent.click(screen.getByRole('button', { name: 'update-activity' }));
    await waitFor(() =>
      expect(patch).toHaveBeenCalledWith('/api/blueprint-activities/a1', { status: 'Completed' }),
    );

    await userEvent.click(screen.getByRole('button', { name: 'remove-activity' }));
    await waitFor(() => expect(del).toHaveBeenCalledWith('/api/blueprint-activities/a1'));
  });

  it('takes and deletes snapshots, refreshing the snapshot list', async () => {
    const post = vi.spyOn(api, 'post').mockResolvedValue({ id: 's2', label: 'Baseline' });
    const del = vi.spyOn(api, 'del').mockResolvedValue(undefined);
    renderHarness();
    await screen.findByText('snapshots:1');

    await userEvent.click(screen.getByRole('button', { name: 'snapshot' }));
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith('/api/blueprints/b1/snapshots', { label: 'Baseline' }),
    );

    await userEvent.click(screen.getByRole('button', { name: 'delete-snapshot' }));
    await waitFor(() => expect(del).toHaveBeenCalledWith('/api/snapshots/s1'));
  });
});
