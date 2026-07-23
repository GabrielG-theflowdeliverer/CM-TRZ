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

/**
 * Log one line per completed request (method, path, status, duration). Skips the
 * health probe, which Fly hits every 30s and would otherwise drown the signal.
 */
export function requestLogger() {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (req.path === '/api/health') return next();
    const start = process.hrtime.bigint();
    res.on('finish', () => {
      const ms = Number(process.hrtime.bigint() - start) / 1e6;
      logger.info({
        msg: 'req',
        method: req.method,
        path: req.path,
        status: res.statusCode,
        ms: Math.round(ms),
      });
    });
    next();
  };
}
