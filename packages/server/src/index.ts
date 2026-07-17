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

app.listen(port, () => {
  console.log(`Change Management Tool API listening on http://localhost:${port}`);
});
