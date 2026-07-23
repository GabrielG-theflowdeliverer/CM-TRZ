import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import type { Db } from './db.js';

const BACKUP_PREFIX = 'proxima-';
const BACKUP_SUFFIX = '.db';
/** How many backups to keep; oldest are pruned beyond this. */
const DEFAULT_KEEP = 10;

/**
 * Online, WAL-safe snapshot of the live database via SQLite's backup API.
 * Every backup is verified immediately after writing — an unverified backup is
 * false comfort — and old backups are pruned to the newest `keep`.
 * Returns the path of the verified backup file.
 */
export async function backupDb(db: Db, dir: string, keep = DEFAULT_KEEP): Promise<string> {
  fs.mkdirSync(dir, { recursive: true });
  // ISO stamp made filename-safe; lexicographic order == chronological order.
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dest = path.join(dir, `${BACKUP_PREFIX}${stamp}${BACKUP_SUFFIX}`);
  await snapshotTo(db, dest);
  prune(dir, keep);
  return dest;
}

/**
 * Online, WAL-safe snapshot to an exact path: one self-contained, verified file.
 * The offsite-backup CLI uses this to write a fixed filename it can then pull
 * off the host; `backupDb` uses it for timestamped, pruned local snapshots.
 */
export async function snapshotTo(db: Db, dest: string): Promise<void> {
  await db.backup(dest);
  // The live db is WAL-mode and the backup inherits it, leaving -wal/-shm
  // sidecars. A backup must be ONE self-contained file (restore = copy it
  // back), so checkpoint it into rollback-journal mode, which removes them.
  const flatten = new Database(dest);
  try {
    flatten.pragma('journal_mode = DELETE');
  } finally {
    flatten.close();
  }
  verifyBackup(dest);
}

/** Open a backup read-only and prove it's a healthy, migrated database. */
export function verifyBackup(file: string): void {
  const check = new Database(file, { readonly: true, fileMustExist: true });
  try {
    const integrity = check.pragma('quick_check', { simple: true });
    if (integrity !== 'ok') throw new Error(`Backup failed integrity check: ${String(integrity)}`);
    const version = check.pragma('user_version', { simple: true }) as number;
    if (!(version > 0)) throw new Error('Backup has no migrations applied — not a valid database');
  } finally {
    check.close();
  }
}

function prune(dir: string, keep: number): void {
  const backups = fs
    .readdirSync(dir)
    .filter((f) => f.startsWith(BACKUP_PREFIX) && f.endsWith(BACKUP_SUFFIX))
    .sort(); // oldest first (timestamped names)
  for (const file of backups.slice(0, Math.max(0, backups.length - keep))) {
    fs.unlinkSync(path.join(dir, file));
  }
}
