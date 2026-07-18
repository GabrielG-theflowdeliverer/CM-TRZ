import type { Db } from './db.js';

/** SQLite has no boolean type; store booleans as 0/1 the way the schema expects. */
function bind(value: unknown): unknown {
  return typeof value === 'boolean' ? (value ? 1 : 0) : value;
}

/**
 * Partial UPDATE by id: writes only the columns whose camelCase key is present
 * in `fields` (mapped to their snake_case column via `columnMap`). Undefined
 * keys are skipped, so there is no read-then-rewrite-all-columns round trip and
 * no hand-written `fields.x !== undefined ? fields.x : current.x` per column.
 * Returns whether the row exists.
 */
export function updateById(
  db: Db,
  table: string,
  id: string,
  columnMap: Record<string, string>,
  fields: Record<string, unknown>,
): boolean {
  const sets: string[] = [];
  const values: unknown[] = [];
  for (const [key, col] of Object.entries(columnMap)) {
    if (fields[key] !== undefined) {
      sets.push(`${col} = ?`);
      values.push(bind(fields[key]));
    }
  }
  if (sets.length === 0) {
    return db.prepare(`SELECT 1 FROM ${table} WHERE id = ? LIMIT 1`).get(id) !== undefined;
  }
  values.push(id);
  return db.prepare(`UPDATE ${table} SET ${sets.join(', ')} WHERE id = ?`).run(...values).changes > 0;
}

/**
 * Next append position within an ordered collection, optionally scoped
 * (e.g. per project, per kind). Replaces the repeated
 * `SELECT COALESCE(MAX(position) + 1, 0)` snippet.
 */
export function nextPosition(db: Db, table: string, scope: Record<string, unknown> = {}): number {
  const keys = Object.keys(scope);
  const where = keys.length ? ` WHERE ${keys.map((k) => `${k} = ?`).join(' AND ')}` : '';
  const row = db
    .prepare(`SELECT COALESCE(MAX(position) + 1, 0) AS pos FROM ${table}${where}`)
    .get(...keys.map((k) => scope[k])) as { pos: number };
  return row.pos;
}
