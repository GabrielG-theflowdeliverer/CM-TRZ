import http from 'node:http';
import type { Express } from 'express';
import { openDb, type Db } from '../src/infra/db.js';
import { createApp } from '../src/app.js';

export interface TestContext {
  db: Db;
  /**
   * A listening server rather than the bare Express app — see `serve`.
   * supertest accepts either, so `request(ctx.app)` reads the same.
   */
  app: http.Server;
}

/** Everything this harness opened, closed after each test (see test/setup.ts). */
const open: Array<{ server: http.Server; db?: Db }> = [];

/**
 * Put an app behind a listening socket and keep it there for the whole test.
 *
 * Handing supertest a bare Express app makes it call `app.listen(0)` for
 * *every request* and close the socket afterwards (supertest/lib/test.js:
 * `serverAddress` listens when `app.address()` is null; `end` closes again).
 * A test making ten assertions therefore opened and tore down ten ephemeral
 * listeners, and across vitest's parallel workers that raced often enough to
 * fail about one run in ten with `Parse Error: Expected HTTP/, RTSP/ or
 * ICE/` — an ECONNRESET on a socket that went away mid-response. Never a real
 * failure, and never reproducible in isolation, which is what made it so easy
 * to paper over with a retry.
 *
 * Giving supertest a server that is already listening makes it reuse that one,
 * so the cost drops to a single listener per test and the race has nothing
 * left to race against.
 *
 * `unref()` so a leaked server can never hold the process open.
 */
export function serve(app: Express, db?: Db): http.Server {
  const server = http.createServer(app).listen(0);
  // The whole point rests on supertest seeing a bound address; if it ever saw
  // null here it would quietly go back to listening per request and the flake
  // would return with nothing to show for it. Fail loudly instead.
  if (!server.address()) throw new Error('serve(): server did not bind synchronously');
  open.push({ server, db });
  return server;
}

/** Fresh in-memory database with real migrations applied — no mocks. */
export function createTestApp(): TestContext {
  const db = openDb(':memory:');
  return { db, app: serve(createApp(db), db) };
}

/**
 * Registered globally in test/setup.ts; safe to call when nothing is open.
 *
 * `closeAllConnections()` first, and it is not optional: Node's global agent
 * has `keepAlive: true` by default, so supertest leaves an idle socket behind
 * and a plain `close()` does not call back until that socket hits
 * `keepAliveTimeout` — 5s per server, in an afterEach, which times the rest of
 * the file out. Dropping the connections makes teardown immediate.
 */
export async function closeTestApps(): Promise<void> {
  const entries = open.splice(0);
  await Promise.all(
    entries.map(
      ({ server, db }) =>
        new Promise<void>((resolve) => {
          server.closeAllConnections();
          server.close(() => {
            db?.close();
            resolve();
          });
        }),
    ),
  );
}
