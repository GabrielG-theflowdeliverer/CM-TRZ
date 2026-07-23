import { Router } from 'express';
import { z } from 'zod';
import { HttpError, parseBody } from '../../infra/http.js';
import {
  COOKIE_NAME,
  readCookie,
  signSession,
  verifyPassword,
  verifySession,
  type AuthConfig,
} from '../../infra/auth.js';

const loginSchema = z.object({ password: z.string().min(1) });

/**
 * Auth endpoints, mounted BEFORE the editor guard so they stay reachable while
 * logged out. When `config` is undefined the app runs without authentication
 * (local dev): `/me` reports authenticated and `/login` is a no-op success, so
 * the client renders normally.
 */
export function createAuthRouter(config?: AuthConfig): Router {
  const router = Router();

  router.get('/me', (req, res) => {
    if (!config) {
      res.json({ authenticated: true, authRequired: false });
      return;
    }
    const authenticated = verifySession(config.sessionSecret, readCookie(req.headers.cookie, COOKIE_NAME));
    res.json({ authenticated, authRequired: true });
  });

  router.post('/login', (req, res) => {
    const { password } = parseBody(loginSchema, req.body);
    if (!config) {
      res.status(204).end();
      return;
    }
    if (!verifyPassword(password, config.passwordHash)) throw new HttpError(401, 'Incorrect password');
    const token = signSession(config.sessionSecret, config.ttlSeconds);
    res.cookie(COOKIE_NAME, token, {
      httpOnly: true,
      secure: config.secure,
      sameSite: 'lax',
      maxAge: config.ttlSeconds * 1000,
      path: '/',
    });
    res.status(204).end();
  });

  router.post('/logout', (_req, res) => {
    res.clearCookie(COOKIE_NAME, { path: '/' });
    res.status(204).end();
  });

  return router;
}
