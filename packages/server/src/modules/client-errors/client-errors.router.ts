import { Router } from 'express';
import { z } from 'zod';
import { parseBody } from '../../infra/http.js';
import { logger } from '../../infra/log.js';

/**
 * Where client-side failures go to be remembered.
 *
 * Server errors reach `fly logs`; browser errors previously reached nothing —
 * a 6-second toast and a `console.error` nobody was watching. This puts them in
 * the same stream, with the same request id, so one grep covers both halves.
 *
 * Deliberately not Sentry: `docs/data-handling.md` commits to "nothing is sent
 * to any third party", the CSP is `connect-src 'self'`, and survey/share tokens
 * ride in URLs — which Sentry captures by default, and which `Referrer-Policy:
 * no-referrer` exists to keep from leaking. Posting to our own server keeps all
 * of that true.
 *
 * Everything here is bounded: the payload is capped field by field so a loop in
 * the browser cannot flood the log, and the route is rate-limited at the
 * composition root. Nothing is echoed back.
 */
const clientErrorSchema = z.object({
  kind: z.enum(['render', 'request', 'unhandled']),
  message: z.string().max(500),
  stack: z.string().max(4000).optional(),
  /** Route the user was on. Tokens are stripped client-side before sending. */
  route: z.string().max(500).optional(),
  /** Ties the failure to the server-side line for the same request, when there is one. */
  requestId: z.string().max(64).optional(),
});

export function createClientErrorsRouter(): Router {
  const router = Router();

  router.post('/', (req, res) => {
    const report = parseBody(clientErrorSchema, req.body);
    logger.error({
      msg: 'client-error',
      kind: report.kind,
      error: report.message,
      route: report.route,
      id: report.requestId,
      stack: report.stack,
      ua: typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'].slice(0, 200) : undefined,
    });
    // 204: the browser is already in a bad state; give it nothing to parse.
    res.status(204).end();
  });

  return router;
}
