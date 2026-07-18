import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useInvalidateProjectCaches } from './queryInvalidation';
import { renderWithClient } from '../test/harness';

function Harness({ onReady }: { onReady: (invalidate: ReturnType<typeof useInvalidateProjectCaches>) => void }) {
  const invalidate = useInvalidateProjectCaches();
  return (
    <button type="button" onClick={() => onReady(invalidate)}>
      go
    </button>
  );
}

describe('useInvalidateProjectCaches', () => {
  it('always busts both the portfolio and per-project dashboards, plus any passed feature keys', async () => {
    let run: ReturnType<typeof useInvalidateProjectCaches> | undefined;
    const { client } = renderWithClient(<Harness onReady={(fn) => (run = fn)} />);
    const spy = vi.spyOn(client, 'invalidateQueries');

    await userEvent.click(screen.getByText('go'));
    run!(['groups', 'p1']);

    const invalidatedKeys = spy.mock.calls.map((call) => call[0]?.queryKey);
    expect(invalidatedKeys).toContainEqual(['dashboard']);
    expect(invalidatedKeys).toContainEqual(['project-dashboard']);
    expect(invalidatedKeys).toContainEqual(['groups', 'p1']);
  });
});
