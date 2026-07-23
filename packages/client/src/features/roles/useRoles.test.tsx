import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { api } from '../../lib/api';
import { renderWithClient } from '../../test/harness';
import { useRoles } from './useRoles';

function Harness({ projectId }: { projectId: string }) {
  const { data, fetchStatus } = useRoles(projectId);
  return (
    <div>
      status:{fetchStatus} data:{data ? 'loaded' : 'none'}
    </div>
  );
}

afterEach(() => vi.restoreAllMocks());

describe('useRoles', () => {
  it('fetches the role roster for a real project id', async () => {
    const get = vi.spyOn(api, 'get').mockResolvedValue([] as never);
    renderWithClient(<Harness projectId="p1" />);
    await screen.findByText(/data:loaded/);
    expect(get).toHaveBeenCalledWith('/api/projects/p1/roles');
  });

  it('stays disabled (never fetches) when the project id is empty', async () => {
    const get = vi.spyOn(api, 'get').mockResolvedValue([] as never);
    renderWithClient(<Harness projectId="" />);
    expect(screen.getByText(/status:idle/)).toBeInTheDocument();
    expect(get).not.toHaveBeenCalled();
  });
});
