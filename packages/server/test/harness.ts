import type { Express } from 'express';
import { openDb, type Db } from '../src/infra/db.js';
import { createApp } from '../src/app.js';

export interface TestContext {
  db: Db;
  app: Express;
}

/** Fresh in-memory database with real migrations applied — no mocks. */
export function createTestApp(): TestContext {
  const db = openDb(':memory:');
  return { db, app: createApp(db) };
}
