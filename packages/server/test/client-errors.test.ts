import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { openDb } from '../src/infra/db.js';
import { createApp } from '../src/app.js';
import { hashPassword, type AuthConfig } from '../src/infra/auth.js';
import express from 'express';
import { requestLogger } from '../src/infra/log.js';
import { createTestApp, serve, type TestContext } from './harness.js';

let ctx: TestContext;
const savedLevel = process.env.CMT_LOG_LEVEL;

beforeEach(() => {
  ctx = createTestApp();
  process.env.CMT_LOG_LEVEL = 'error';
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
  process.env.CMT_LOG_LEVEL = savedLevel;
});

const lastLine = () => JSON.parse(vi.mocked(console.error).mock.calls.at(-1)![0] as string);

describe('a request the browser abandons', () => {
  it('is logged under the id the client sent, so a toast leads to the line', async () => {
    process.env.CMT_LOG_LEVEL = 'info';
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    // A route that outlives the client's patience, exercised over real HTTP.
    const app = express();
    app.use(requestLogger());
    app.get('/api/slow', (_req, res) => setTimeout(() => res.json({ ok: true }), 2000));
    const server = serve(app);
    const port = (server.address() as { port: number }).port;

    const controller = new AbortController();
    setTimeout(() => controller.abort(), 100);
    await fetch(`http://127.0.0.1:${port}/api/slow`, {
      signal: controller.signal,
      headers: { 'X-Request-Id': 'toastref1' },
    }).catch(() => {});
    await new Promise((r) => setTimeout(r, 300));

    const lines = logSpy.mock.calls.map((c) => JSON.parse(c[0] as string));
    const aborted = lines.find((l) => l.aborted);
    // Before this change there was no line at all for an abandoned request.
    expect(aborted).toMatchObject({ msg: 'req', method: 'GET', path: '/api/slow', aborted: true, id: 'toastref1' });
  });
});

describe('client error beacon', () => {
  it('writes a browser failure into the same log stream as server errors', async () => {
    await request(ctx.app)
      .post('/api/client-errors')
      .send({
        kind: 'request',
        message: 'GET /api/projects/p1/dashboard — Request timed out after 15s',
        route: '/projects/p1/dashboard',
        requestId: 'abc123',
      })
      .expect(204);

    expect(lastLine()).toMatchObject({
      level: 'error',
      msg: 'client-error',
      kind: 'request',
      error: 'GET /api/projects/p1/dashboard — Request timed out after 15s',
      route: '/projects/p1/dashboard',
      id: 'abc123',
    });
  });

  it('rejects a payload that is not a report, rather than logging anything', async () => {
    await request(ctx.app).post('/api/client-errors').send({ kind: 'nonsense', message: 'x' }).expect(400);
    await request(ctx.app).post('/api/client-errors').send({ message: 'no kind' }).expect(400);
    expect(console.error).not.toHaveBeenCalled();
  });

  it('caps an oversized message so a loop in the browser cannot flood the log', async () => {
    await request(ctx.app)
      .post('/api/client-errors')
      .send({ kind: 'render', message: 'x'.repeat(5000) })
      .expect(400);
  });

  it('stays reachable while logged out, so a broken login page can still report', async () => {
    const auth: AuthConfig = {
      sessionSecret: 'test-session-secret',
      passwordHash: hashPassword('pw'),
      secure: false,
      ttlSeconds: 3600,
    };
    const app = serve(createApp(openDb(':memory:'), { auth }));

    // Everything else is behind the editor guard...
    await request(app).get('/api/projects').expect(401);
    // ...but a browser that cannot even log in must still be able to tell us.
    await request(app).post('/api/client-errors').send({ kind: 'render', message: 'boom' }).expect(204);
  });
});
