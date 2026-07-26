import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { reportClientError, safeRoute } from './report';

/**
 * The beacon exists because a client failure previously left no trace anywhere
 * — a 6s toast and a console line. It has two hard requirements: it must never
 * throw (it runs while the app is already broken), and it must never carry an
 * access token into the log.
 */

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn().mockResolvedValue({ ok: true });
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const sentBody = () => JSON.parse(fetchMock.mock.calls[0]![1].body as string);

describe('safeRoute', () => {
  it('strips survey and share tokens out of the path', () => {
    // These are live access credentials — the whole reason Referrer-Policy is
    // no-referrer server-side. They must not reach a log file either.
    expect(safeRoute('/s/AbCdEf123456')).toBe('/s/[token]');
    expect(safeRoute('/view/tok_9876')).toBe('/view/[token]');
    expect(safeRoute('/survey/xyz/thanks')).toBe('/survey/[token]/thanks');
  });

  it('leaves an ordinary practitioner route alone', () => {
    expect(safeRoute('/projects/p1/dashboard')).toBe('/projects/p1/dashboard');
  });
});

describe('reportClientError', () => {
  it('posts the report to the app, not to a third party', () => {
    reportClientError({ kind: 'render', message: 'boom', stack: 'at x' });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('/api/client-errors');
    expect(init.method).toBe('POST');
    // keepalive so the report survives the user leaving a broken page.
    expect(init.keepalive).toBe(true);
    expect(sentBody()).toMatchObject({ kind: 'render', message: 'boom', stack: 'at x' });
  });

  it('sends the sanitised route, never the raw token path', () => {
    window.history.pushState({}, '', '/s/SECRET-TOKEN-VALUE');
    reportClientError({ kind: 'render', message: 'boom' });
    expect(sentBody().route).toBe('/s/[token]');
    expect(JSON.stringify(sentBody())).not.toContain('SECRET-TOKEN-VALUE');
    window.history.pushState({}, '', '/');
  });

  it('truncates a huge message and stack to what the server accepts', () => {
    reportClientError({ kind: 'unhandled', message: 'x'.repeat(5000), stack: 'y'.repeat(9000) });
    expect(sentBody().message).toHaveLength(500);
    expect(sentBody().stack).toHaveLength(4000);
  });

  it('never throws, even when the beacon itself fails', () => {
    fetchMock.mockRejectedValue(new Error('offline'));
    expect(() => reportClientError({ kind: 'render', message: 'boom' })).not.toThrow();

    vi.stubGlobal('fetch', () => {
      throw new Error('fetch unavailable');
    });
    expect(() => reportClientError({ kind: 'render', message: 'boom' })).not.toThrow();
  });
});
