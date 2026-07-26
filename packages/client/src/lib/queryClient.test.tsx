import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useMutation, useQuery } from '@tanstack/react-query';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApiError } from './api';
import { toMessage, toToast } from './queryClient';
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

const CONTEXT = { method: 'GET', url: '/api/projects/p1/dashboard', requestId: 'abc123' };

describe('toToast', () => {
  it('names the failed call and its reference id', () => {
    // The original toast said only "Request timed out after 15s", which named
    // neither the request nor anything greppable in the server log.
    expect(toToast("Couldn't load data", new ApiError(0, 'Request timed out after 15s', CONTEXT))).toBe(
      "Couldn't load data: Request timed out after 15s — GET /api/projects/p1/dashboard · ref abc123",
    );
  });

  it('stays readable for an error carrying no context', () => {
    expect(toToast('Save failed', new Error('boom'))).toBe('Save failed: boom');
    expect(toToast('Save failed', new ApiError(409, 'Conflict'))).toBe('Save failed: Conflict (409)');
  });
});

function FailingWith({ error }: { error: unknown }) {
  useQuery({ queryKey: ['probe', String(Math.random())], queryFn: () => Promise.reject(error), retry: false });
  return null;
}

describe('what gets reported to the server', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('reports a timeout, which the server may have no record of', async () => {
    const toasts = captureToasts();
    try {
      renderWithClient(<FailingWith error={new ApiError(0, 'Request timed out after 15s', CONTEXT)} />);
      await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/client-errors', expect.anything()));
      const body = JSON.parse(fetchMock.mock.calls[0]![1].body as string);
      expect(body).toMatchObject({ kind: 'request', requestId: 'abc123' });
    } finally {
      toasts.stop();
    }
  });

  it('does not report an HTTP error the server already logged', async () => {
    const toasts = captureToasts();
    try {
      renderWithClient(<FailingWith error={new ApiError(500, 'Server exploded', CONTEXT)} />);
      // The toast still fires; the beacon deliberately stays quiet.
      await waitFor(() => expect(toasts.messages().join(' ')).toMatch(/Server exploded/));
      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      toasts.stop();
    }
  });
});
