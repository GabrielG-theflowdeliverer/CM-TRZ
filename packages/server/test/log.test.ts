import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import type { Request, Response } from 'express';
import { logger, requestLogger } from '../src/infra/log.js';

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
  function fakeReqRes(path: string, method = 'GET', status = 200) {
    const res = new EventEmitter() as unknown as Response;
    (res as unknown as { statusCode: number }).statusCode = status;
    return { req: { path, method } as Request, res };
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
