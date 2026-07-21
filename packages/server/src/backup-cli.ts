import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDb } from './infra/db.js';
import { backupDb } from './infra/backup.js';

/** Manual backup: `npm run backup` (or with CMT_DB_FILE / CMT_BACKUP_DIR set). */
const here = path.dirname(fileURLToPath(import.meta.url));
const dbFile = process.env.CMT_DB_FILE ?? path.join(here, '..', 'data', 'proxima.db');
const backupDir = process.env.CMT_BACKUP_DIR ?? path.join(path.dirname(dbFile), 'backups');

const db = openDb(dbFile);
try {
  const dest = await backupDb(db, backupDir);
  console.log(`Backup written and verified: ${dest}`);
  console.log('To restore: stop the server, copy the backup over the db file, restart.');
} finally {
  db.close();
}
