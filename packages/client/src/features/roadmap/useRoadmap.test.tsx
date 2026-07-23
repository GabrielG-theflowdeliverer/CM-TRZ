import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { api } from '../../lib/api';
import { renderWithClient } from '../../test/harness';
import { useRoadmap } from './useRoadmap';

function Harness({ projectId }: { projectId: string }) {
  const { data, fetchStatus } = useRoadmap(projectId);
  return (
    <div>
      status:{fetchStatus} data:{data ? 'loaded' : 'none'}
    </div>
  );
}

afterEach(() => vi.restoreAllMocks());

describe('useRoadmap', () => {
  it('fetches the roadmap for a real project id', async () => {
    const get = vi.spyOn(api, 'get').mockResolvedValue({ projectId: 'p1' } as never);
    renderWithClient(<Harness projectId="p1" />);
    await screen.findByText(/data:loaded/);
    expect(get).toHaveBeenCalledWith('/api/projects/p1/roadmap');
  });

  it('stays disabled (never fetches) when the project id is empty', async () => {
    const get = vi.spyOn(api, 'get').mockResolvedValue({} as never);
    renderWithClient(<Harness projectId="" />);
    expect(screen.getByText(/status:idle/)).toBeInTheDocument();
    expect(get).not.toHaveBeenCalled();
  });
});
