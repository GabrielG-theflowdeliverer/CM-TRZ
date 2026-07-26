import { randomBytes } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

/**
 * Minimal structured logging — one JSON line per event, so Fly's log capture
 * (`fly logs`) stays greppable and a failure is still visible long after the
 * client's 6-second error toast has vanished. Deliberately dependency-free and
 * explicit rather than pulling in a logging framework (KISS/YAGNI for a
 * single-instance app): stdout for info/warn, stderr for error.
 *
 * The threshold is read from CMT_LOG_LEVEL per call (default 'info'); tests set
 * 'silent' so the suite stays quiet. `error` always writes unless silenced.
 */
export type LogLevel = 'silent' | 'error' | 'warn' | 'info';

const RANK: Record<LogLevel, number> = { silent: 0, error: 1, warn: 2, info: 3 };

function threshold(): number {
  const raw = process.env.CMT_LOG_LEVEL as LogLevel | undefined;
  return RANK[raw ?? 'info'] ?? RANK.info;
}

function emit(level: Exclude<LogLevel, 'silent'>, fields: Record<string, unknown>): void {
  if (RANK[level] > threshold()) return;
  const line = JSON.stringify({ t: new Date().toISOString(), level, ...fields });
  if (level === 'error') console.error(line);
  else console.log(line);
}

export const logger = {
  info: (fields: Record<string, unknown>) => emit('info', fields),
  warn: (fields: Record<string, unknown>) => emit('warn', fields),
  error: (fields: Record<string, unknown>) => emit('error', fields),
};

/** Anything slower than this is logged at `warn`, so it stands out from traffic. */
export const SLOW_REQUEST_MS = 1000;

/**
 * The path to record, taken from `req.originalUrl`.
 *
 * Not `req.path`: Express rewrites `req.url` when it enters a mounted router
 * and only restores it if the handler calls `next()` — which a handler that
 * sends a response does not. Read on `finish`, `req.path` is therefore whatever
 * remained after routing, so `GET /api/projects/:id/dashboard` logged as `/`
 * and `GET /api/auth/me` as `/me`. `originalUrl` is documented as never
 * rewritten.
 *
 * Survey and share tokens ride in the path and are live access credentials, so
 * the segment after them is replaced — the same reason `Referrer-Policy` is
 * `no-referrer` and the client strips them before reporting. The query string
 * is dropped entirely rather than audited.
 */
export function loggablePath(originalUrl: string): string {
  const path = originalUrl.split('?')[0] ?? '';
  return path.replace(/\/api\/(survey|share)\/[^/]+/g, '/api/$1/[token]');
}

/**
 * Ids are echoed back to the client and printed in logs, so a client-supplied
 * one has to look like an id and nothing else. Anything unexpected is replaced
 * rather than rejected — a malformed header should not fail the request.
 */
const ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

export function newRequestId(): string {
  return randomBytes(6).toString('base64url');
}

function requestIdOf(req: Request): string {
  const supplied = req.headers['x-request-id'];
  return typeof supplied === 'string' && ID_PATTERN.test(supplied) ? supplied : newRequestId();
}

/**
 * One line per request, carrying the id the client can quote back.
 *
 * Three cases, because only the first used to be recorded:
 * - completed          -> info, or warn past SLOW_REQUEST_MS
 * - completed slowly   -> warn, so `fly logs` filtering finds it
 * - client gave up     -> warn with `aborted: true`
 *
 * That last case is the one that mattered: `finish` only fires when a response
 * completes, so a request the browser abandoned (api.ts aborts at 15s) left no
 * trace at all — the user saw "the request timed out" and the server had
 * nothing to show for it.
 *
 * Skips the health probe, which Fly hits every 30s and would drown the signal.
 */
export function requestLogger() {
  return (req: Request, res: Response, next: NextFunction): void => {
    // One source of truth for the path, used for the skip and the log line
    // alike — req.path is unreliable by the time the response finishes.
    const path = loggablePath(req.originalUrl);
    if (path === '/api/health') return next();
    const id = requestIdOf(req);
    res.locals.requestId = id;
    // Echoed so a successful-but-slow request can also be traced from the client.
    res.setHeader('X-Request-Id', id);

    const start = process.hrtime.bigint();
    const elapsed = () => Math.round(Number(process.hrtime.bigint() - start) / 1e6);
    let finished = false;

    res.on('finish', () => {
      finished = true;
      const ms = elapsed();
      const fields = { msg: 'req', id, method: req.method, path, status: res.statusCode, ms };
      if (ms >= SLOW_REQUEST_MS) logger.warn({ ...fields, slow: true });
      else logger.info(fields);
    });

    // `close` fires for every request; only interesting when nothing was sent.
    res.on('close', () => {
      if (finished) return;
      logger.warn({ msg: 'req', id, method: req.method, path, ms: elapsed(), aborted: true });
    });

    next();
  };
}
