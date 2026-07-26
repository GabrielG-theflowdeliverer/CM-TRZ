import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import type { Request, Response } from 'express';
import { logger, requestLogger, SLOW_REQUEST_MS } from '../src/infra/log.js';

const savedLevel = process.env.CMT_LOG_LEVEL;

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
  process.env.CMT_LOG_LEVEL = savedLevel;
});

/** The last JSON line passed to a console spy. */
function lastLine(spy: ReturnType<typeof vi.spyOn>): Record<string, unknown> {
  const call = spy.mock.calls.at(-1);
  return JSON.parse(call![0] as string);
}

describe('logger', () => {
  it('emits a structured JSON line with a timestamp and level (info -> stdout)', () => {
    process.env.CMT_LOG_LEVEL = 'info';
    logger.info({ msg: 'hello', n: 1 });
    const line = lastLine(vi.mocked(console.log));
    expect(line).toMatchObject({ level: 'info', msg: 'hello', n: 1 });
    expect(typeof line.t).toBe('string');
  });

  it('routes error to stderr', () => {
    process.env.CMT_LOG_LEVEL = 'info';
    logger.error({ msg: 'boom' });
    expect(console.error).toHaveBeenCalledOnce();
    expect(console.log).not.toHaveBeenCalled();
    expect(lastLine(vi.mocked(console.error))).toMatchObject({ level: 'error', msg: 'boom' });
  });

  it('honours the CMT_LOG_LEVEL threshold', () => {
    process.env.CMT_LOG_LEVEL = 'error';
    logger.info({ msg: 'suppressed' });
    logger.warn({ msg: 'suppressed' });
    expect(console.log).not.toHaveBeenCalled();
    logger.error({ msg: 'kept' });
    expect(console.error).toHaveBeenCalledOnce();
  });

  it("'silent' suppresses everything", () => {
    process.env.CMT_LOG_LEVEL = 'silent';
    logger.error({ msg: 'nope' });
    expect(console.error).not.toHaveBeenCalled();
  });
});

describe('requestLogger', () => {
  /** A real Express req always carries `headers` and a res with `locals`/`setHeader`. */
  function fakeReqRes(path: string, method = 'GET', status = 200, headers: Record<string, string> = {}) {
    const res = new EventEmitter() as unknown as Response;
    Object.assign(res, { statusCode: status, locals: {}, setHeader: vi.fn() });
    return { req: { path, method, headers } as unknown as Request, res };
  }

  it('logs one line per finished request with method/path/status/ms', () => {
    process.env.CMT_LOG_LEVEL = 'info';
    const next = vi.fn();
    const { req, res } = fakeReqRes('/api/projects', 'POST', 201);
    requestLogger()(req, res, next);
    expect(next).toHaveBeenCalledOnce();
    res.emit('finish');
    const line = lastLine(vi.mocked(console.log));
    expect(line).toMatchObject({ msg: 'req', method: 'POST', path: '/api/projects', status: 201 });
    expect(typeof line.ms).toBe('number');
  });

  it('records a request the client gave up on, which used to vanish', () => {
    // `finish` never fires when the browser aborts, so the old logger wrote
    // nothing at all — the user saw a timeout and the server had no record.
    process.env.CMT_LOG_LEVEL = 'info';
    const { req, res } = fakeReqRes('/api/projects/p1/dashboard');
    requestLogger()(req, res, vi.fn());
    res.emit('close');
    expect(lastLine(vi.mocked(console.log))).toMatchObject({
      msg: 'req',
      method: 'GET',
      path: '/api/projects/p1/dashboard',
      aborted: true,
      level: 'warn',
    });
  });

  it('does not double-log a request that completed normally', () => {
    process.env.CMT_LOG_LEVEL = 'info';
    const { req, res } = fakeReqRes('/api/projects');
    requestLogger()(req, res, vi.fn());
    res.emit('finish');
    res.emit('close'); // always follows finish
    expect(console.log).toHaveBeenCalledOnce();
  });

  it('raises a slow request to warn so it stands out from traffic', () => {
    process.env.CMT_LOG_LEVEL = 'info';
    // hrtime is unaffected by fake timers, so drive it directly: the logger
    // reads it once at entry and once on finish.
    vi.spyOn(process.hrtime, 'bigint')
      .mockReturnValueOnce(0n)
      .mockReturnValueOnce(BigInt(SLOW_REQUEST_MS + 50) * 1_000_000n);

    const { req, res } = fakeReqRes('/api/projects/p1/dashboard');
    requestLogger()(req, res, vi.fn());
    res.emit('finish');

    expect(lastLine(vi.mocked(console.log))).toMatchObject({
      level: 'warn',
      slow: true,
      ms: SLOW_REQUEST_MS + 50,
    });
  });

  it('leaves a normal-speed request at info', () => {
    process.env.CMT_LOG_LEVEL = 'info';
    vi.spyOn(process.hrtime, 'bigint')
      .mockReturnValueOnce(0n)
      .mockReturnValueOnce(BigInt(SLOW_REQUEST_MS - 100) * 1_000_000n);

    const { req, res } = fakeReqRes('/api/projects');
    requestLogger()(req, res, vi.fn());
    res.emit('finish');

    const line = lastLine(vi.mocked(console.log));
    expect(line.level).toBe('info');
    expect(line.slow).toBeUndefined();
  });

  it('echoes an id back and logs under it, so a toast leads to the log line', () => {
    process.env.CMT_LOG_LEVEL = 'info';
    const { req, res } = fakeReqRes('/api/projects', 'GET', 200, { 'x-request-id': 'abc123' });
    requestLogger()(req, res, vi.fn());
    expect(res.setHeader).toHaveBeenCalledWith('X-Request-Id', 'abc123');
    expect(res.locals.requestId).toBe('abc123');
    res.emit('finish');
    expect(lastLine(vi.mocked(console.log))).toMatchObject({ id: 'abc123' });
  });

  it('replaces a malformed client id rather than logging whatever was sent', () => {
    process.env.CMT_LOG_LEVEL = 'info';
    const nasty = 'not an id\n{"level":"info","msg":"forged"}';
    const { req, res } = fakeReqRes('/api/projects', 'GET', 200, { 'x-request-id': nasty });
    requestLogger()(req, res, vi.fn());
    res.emit('finish');
    const line = lastLine(vi.mocked(console.log));
    expect(line.id).not.toBe(nasty);
    expect(String(line.id)).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('skips the health probe so it never floods the log', () => {
    process.env.CMT_LOG_LEVEL = 'info';
    const next = vi.fn();
    const { req, res } = fakeReqRes('/api/health');
    requestLogger()(req, res, next);
    expect(next).toHaveBeenCalledOnce();
    res.emit('finish');
    expect(console.log).not.toHaveBeenCalled();
  });
});
