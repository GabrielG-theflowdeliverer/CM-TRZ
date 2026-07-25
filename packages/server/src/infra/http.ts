import type { NextFunction, Request, Response } from 'express';
import { ZodError, type ZodTypeAny, type z } from 'zod';
import { logger } from './log.js';

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export function notFound(what: string): never {
  throw new HttpError(404, `${what} not found`);
}

/**
 * Path params inherited through `Router({ mergeParams: true })`. Express types
 * `req.params` from the route pattern alone, so a sub-router that inherits
 * `:projectId` (or `:token`) from its mount path sees it as unknown. The cast
 * that bridges that is stated here, once, instead of at every call site.
 */
function pathParam(req: { params: unknown }, name: string): string {
  return (req.params as Record<string, string>)[name]!;
}

/** The `:projectId` path param on project-scoped routers. */
export function projectIdParam(req: { params: unknown }): string {
  return pathParam(req, 'projectId');
}

/** The `:token` path param on the public share/survey surfaces. */
export function tokenParam(req: { params: unknown }): string {
  return pathParam(req, 'token');
}

/** Parse and validate a request body against a zod schema (400 on failure). */
export function parseBody<S extends ZodTypeAny>(schema: S, body: unknown): z.output<S> {
  const result = schema.safeParse(body);
  if (!result.success) {
    throw new HttpError(400, result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '));
  }
  return result.data;
}

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message });
    return;
  }
  if (err instanceof ZodError) {
    res.status(400).json({ error: err.issues.map((i) => i.message).join('; ') });
    return;
  }
  // Unexpected: log with request context (structured, so it's findable in
  // `fly logs`) but never leak the message or stack to the client.
  logger.error({
    msg: 'unhandled',
    method: req.method,
    path: req.path,
    status: 500,
    err: err instanceof Error ? err.message : String(err),
    stack: err instanceof Error ? err.stack : undefined,
  });
  res.status(500).json({ error: 'Internal server error' });
}
