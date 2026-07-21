import { afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { openDb, type Db } from '../src/infra/db.js';
import { backupDb, verifyBackup } from '../src/infra/backup.js';
import { createApp } from '../src/app.js';

const tmpDirs: string[] = [];
const openDbs: Db[] = [];

function tmpDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cmt-backup-'));
  tmpDirs.push(dir);
  return dir;
}

function openTracked(file: string): Db {
  const db = openDb(file);
  openDbs.push(db);
  return db;
}

afterEach(() => {
  for (const db of openDbs.splice(0)) {
    try {
      db.close();
    } catch {
      /* already closed */
    }
  }
  for (const dir of tmpDirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

describe('backup and restore', () => {
  it('restore drill: the app boots off a backup with the data intact', async () => {
    const dir = tmpDir();
    const db = openTracked(path.join(dir, 'live.db'));
    const app = createApp(db);
    const { body: project } = await request(app).post('/api/projects').send({ name: 'Precious' }).expect(201);

    const backupFile = await backupDb(db, path.join(dir, 'backups'));

    // The drill itself: treat the backup as the database and run the real app on it.
    const restored = openTracked(backupFile);
    const { body: projects } = await request(createApp(restored)).get('/api/projects').expect(200);
    expect(projects).toHaveLength(1);
    expect(projects[0]).toMatchObject({ id: project.id, name: 'Precious' });
  });

  it('captures writes made after an earlier backup (snapshots are point-in-time)', async () => {
    const dir = tmpDir();
    const db = openTracked(path.join(dir, 'live.db'));
    const app = createApp(db);

    await request(app).post('/api/projects').send({ name: 'First' }).expect(201);
    const early = await backupDb(db, path.join(dir, 'backups'));
    await request(app).post('/api/projects').send({ name: 'Second' }).expect(201);
    const late = await backupDb(db, path.join(dir, 'backups'));

    const countIn = (file: string) => {
      const check = openTracked(file);
      return (check.prepare('SELECT COUNT(*) AS n FROM projects').get() as { n: number }).n;
    };
    expect(countIn(early)).toBe(1);
    expect(countIn(late)).toBe(2);
  });

  it('prunes old backups beyond the keep limit, oldest first', async () => {
    const dir = tmpDir();
    const backups = path.join(dir, 'backups');
    fs.mkdirSync(backups, { recursive: true });
    // Seed fake older backups (timestamped names sort chronologically).
    for (const stamp of ['2020-01-01', '2020-01-02', '2020-01-03']) {
      fs.writeFileSync(path.join(backups, `proxima-${stamp}T00-00-00-000Z.db`), 'old');
    }
    const db = openTracked(path.join(dir, 'live.db'));

    await backupDb(db, backups, 3);

    const remaining = fs.readdirSync(backups).sort();
    // Single-file guarantee: no -wal/-shm sidecars, so restore = copy one file.
    expect(remaining.every((f) => f.endsWith('.db'))).toBe(true);
    expect(remaining).toHaveLength(3);
    expect(remaining[0]).toContain('2020-01-02'); // 2020-01-01 pruned
    expect(remaining[1]).toContain('2020-01-03');
    expect(remaining[2]).not.toContain('2020-'); // the fresh, real backup survives
  });

  it('verifyBackup rejects a file that is not a healthy migrated database', () => {
    const dir = tmpDir();
    const junk = path.join(dir, 'junk.db');
    fs.writeFileSync(junk, 'this is not a sqlite database');
    expect(() => verifyBackup(junk)).toThrow();

    // An empty file (sqlite treats it as a blank db, user_version 0 — i.e. no
    // migrations ever ran) must also be rejected.
    const empty = path.join(dir, 'empty.db');
    fs.writeFileSync(empty, '');
    expect(() => verifyBackup(empty)).toThrow(/no migrations/i);
  });
});
