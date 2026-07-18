import path from 'node:path';
import fs from 'node:fs';
import express from 'express';
import { fileURLToPath } from 'node:url';
import { openDb } from './infra/db.js';
import { createApp } from './app.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const dbFile = process.env.CMT_DB_FILE ?? path.join(here, '..', 'data', 'proxima.db');
// Deliberately NOT process.env.PORT: dev harnesses set PORT for the front-end
// server, and picking it up here would collide with Vite.
const port = Number(process.env.CMT_PORT ?? 3001);

const db = openDb(dbFile);
const app = createApp(db);

// In production, serve the built client alongside the API.
const clientDist = path.join(here, '..', '..', 'client', 'dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get(/^\/(?!api\/).*/, (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

const server = app.listen(port, () => {
  console.log(`Change Management Tool API listening on http://localhost:${port}`);
});
// Bound how long a single request may hold a connection.
server.requestTimeout = 30_000;
server.headersTimeout = 35_000;

// Graceful shutdown: stop accepting connections, then close the DB so WAL is
// checkpointed cleanly. Force-exit if the drain hangs.
let shuttingDown = false;
function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`${signal} received — shutting down`);
  const force = setTimeout(() => process.exit(1), 10_000).unref();
  server.close(() => {
    try {
      db.close();
    } catch (err) {
      console.error('Error closing database:', err);
    }
    clearTimeout(force);
    process.exit(0);
  });
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Never let an unhandled error take the process down silently.
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled promise rejection:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
  shutdown('uncaughtException');
});
