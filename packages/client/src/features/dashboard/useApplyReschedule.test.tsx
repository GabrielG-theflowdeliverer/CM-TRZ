import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { api } from '../../lib/api';
import { renderWithClient } from '../../test/harness';
import { useApplyReschedule, type RescheduleChange } from './useApplyReschedule';

function Harness({ onReady }: { onReady: (mutate: (c: RescheduleChange[]) => void) => void }) {
  const apply = useApplyReschedule();
  return (
    <button type="button" onClick={() => onReady(apply.mutate)}>
      go
    </button>
  );
}

afterEach(() => vi.restoreAllMocks());

const change: RescheduleChange = {
  projectId: 'p1',
  kickoffDate: '2026-01-01',
  goliveDate: '2026-06-01',
  outcomesDate: '2026-09-01',
};

describe('useApplyReschedule', () => {
  it('writes each roadmap and invalidates the assessment-detail family (not the dead projectId key)', async () => {
    const put = vi.spyOn(api, 'put').mockResolvedValue({} as never);
    let mutate: ((c: RescheduleChange[]) => void) | undefined;
    const { client } = renderWithClient(<Harness onReady={(fn) => (mutate = fn)} />);
    const spy = vi.spyOn(client, 'invalidateQueries');

    await userEvent.click(screen.getByText('go'));
    mutate!([change]);

    await waitFor(() =>
      expect(put).toHaveBeenCalledWith('/api/projects/p1/roadmap', {
        kickoffDate: '2026-01-01',
        goliveDate: '2026-06-01',
        outcomesDate: '2026-09-01',
      }),
    );

    await waitFor(() => {
      const keys = spy.mock.calls.map((c) => c[0]?.queryKey);
      // The whole assessment-detail family is busted so an open run refreshes.
      expect(keys).toContainEqual(['assessment']);
      // Per-project caches still refresh.
      expect(keys).toContainEqual(['roadmap', 'p1']);
      expect(keys).toContainEqual(['project', 'p1']);
      expect(keys).toContainEqual(['assessments', 'p1']);
      // The old dead key (projectId where an assessmentId belongs) is gone.
      expect(keys).not.toContainEqual(['assessment', 'p1']);
    });
  });
});
