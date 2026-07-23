import { openDb } from './infra/db.js';
import { snapshotTo } from './infra/backup.js';

/**
 * Write a single verified snapshot of the live database to an exact path, for
 * the scheduled *off-Fly* copy (.github/workflows/backup.yml runs this on the
 * machine, then pulls the file down and stores it as an artifact). Reuses the
 * same WAL-safe online-backup machinery as the startup/local backups.
 *
 *   tsx src/online-backup.ts <dest>
 */
const dbFile = process.env.CMT_DB_FILE;
const dest = process.argv[2];
if (!dbFile || !dest) {
  console.error('usage: CMT_DB_FILE=<db> tsx src/online-backup.ts <dest>');
  process.exit(1);
}

const db = openDb(dbFile);
try {
  await snapshotTo(db, dest);
  console.log('offsite snapshot verified:', dest);
} finally {
  db.close();
}
