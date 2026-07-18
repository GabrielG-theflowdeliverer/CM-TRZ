import { describe, expect, it } from 'vitest';
import { useMutation, useQuery } from '@tanstack/react-query';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApiError } from './api';
import { toMessage } from './queryClient';
import { captureToasts, renderWithClient } from '../test/harness';

describe('toMessage', () => {
  it('appends the HTTP status for server errors', () => {
    expect(toMessage(new ApiError(422, 'Name required'))).toBe('Name required (422)');
  });

  it('omits the status for network/timeout errors (status 0)', () => {
    expect(toMessage(new ApiError(0, 'Request timed out after 15s'))).toBe('Request timed out after 15s');
  });

  it('falls back gracefully for plain and non-errors', () => {
    expect(toMessage(new Error('boom'))).toBe('boom');
    expect(toMessage('weird')).toBe('Unexpected error');
  });
});

function FailingQuery() {
  useQuery({
    queryKey: ['probe'],
    queryFn: () => Promise.reject(new ApiError(500, 'Server exploded')),
    retry: false,
  });
  return null;
}

function FailingMutation() {
  const m = useMutation({ mutationFn: () => Promise.reject(new ApiError(409, 'Conflict')) });
  return (
    <button type="button" onClick={() => m.mutate()}>
      save
    </button>
  );
}

describe('createQueryClient failure surfacing', () => {
  it('turns a failed query into a "Couldn\'t load data" toast', async () => {
    const toasts = captureToasts();
    try {
      renderWithClient(<FailingQuery />);
      await waitFor(() =>
        expect(toasts.messages()).toContain("Couldn't load data: Server exploded (500)"),
      );
    } finally {
      toasts.stop();
    }
  });

  it('turns a failed mutation into a "Save failed" toast', async () => {
    const toasts = captureToasts();
    try {
      renderWithClient(<FailingMutation />);
      await userEvent.click(screen.getByText('save'));
      await waitFor(() => expect(toasts.messages()).toContain('Save failed: Conflict (409)'));
    } finally {
      toasts.stop();
    }
  });
});
