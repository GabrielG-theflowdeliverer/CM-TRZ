import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApiError } from '../lib/api';
import { queryGate } from './QueryGate';

const ok = { isPending: false, isError: false, error: null, refetch: () => {} };

describe('queryGate', () => {
  it('returns null once the data is ready', () => {
    expect(queryGate(ok, 'plan')).toBeNull();
  });

  it('shows a loading panel while pending', () => {
    render(<>{queryGate({ ...ok, isPending: true }, 'plan')}</>);
    expect(screen.getByText(/Loading plan/)).toBeInTheDocument();
  });

  it('shows a not-found message for a 404, with no retry', () => {
    render(<>{queryGate({ ...ok, isError: true, error: new ApiError(404, 'Plan not found') }, 'plan')}</>);
    expect(screen.getByText(/could not be found/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument();
  });

  it('offers Retry for a non-404 error and calls refetch', async () => {
    const refetch = vi.fn();
    render(<>{queryGate({ ...ok, isError: true, error: new ApiError(500, 'Server error'), refetch }, 'plan')}</>);
    expect(screen.getByText(/Couldn't load/)).toBeInTheDocument();
    expect(screen.getByText('Server error')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });
});
