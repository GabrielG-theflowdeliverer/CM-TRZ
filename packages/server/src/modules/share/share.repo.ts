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

export function setShareToken(
  db: Db,
  projectId: string,
  token: string | null,
  expiresAt: string | null,
): boolean {
  return (
    db
      .prepare('UPDATE projects SET share_token = ?, share_token_expires_at = ? WHERE id = ?')
      .run(token, expiresAt, projectId).changes > 0
  );
}

/**
 * Resolve a live share token to its project. An expired token is treated
 * exactly like an unknown or revoked one (returns null → 404), so expiry never
 * reveals that the token once existed.
 */
export function getProjectIdByShareToken(db: Db, token: string, now: string): string | null {
  const row = db
    .prepare(
      'SELECT id FROM projects WHERE share_token = ? AND (share_token_expires_at IS NULL OR share_token_expires_at > ?)',
    )
    .get(token, now) as { id: string } | undefined;
  return row ? row.id : null;
}
