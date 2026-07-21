import type { Db } from '../../infra/db.js';

export function getShareToken(db: Db, projectId: string): string | null {
  const row = db.prepare('SELECT share_token FROM projects WHERE id = ?').get(projectId) as
    | { share_token: string | null }
    | undefined;
  return row ? row.share_token : null;
}

export function projectExists(db: Db, projectId: string): boolean {
  return db.prepare('SELECT 1 FROM projects WHERE id = ?').get(projectId) !== undefined;
}

export function setShareToken(db: Db, projectId: string, token: string | null): boolean {
  return db.prepare('UPDATE projects SET share_token = ? WHERE id = ?').run(token, projectId).changes > 0;
}

export function getProjectIdByShareToken(db: Db, token: string): string | null {
  const row = db.prepare('SELECT id FROM projects WHERE share_token = ?').get(token) as
    | { id: string }
    | undefined;
  return row ? row.id : null;
}
