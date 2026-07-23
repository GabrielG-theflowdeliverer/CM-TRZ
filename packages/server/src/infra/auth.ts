import type { RequestHandler } from 'express';
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { HttpError } from './http.js';

/**
 * Single-editor authentication. There is exactly one credentialed user (the
 * license holder); everyone else reaches the app only through unauthenticated,
 * token-scoped survey/share routes. So auth is deliberately minimal: a scrypt
 * password check that mints a stateless HMAC-signed session cookie — no user
 * table, no session store, and it survives restarts. Rotate `sessionSecret` to
 * revoke every live session.
 */
export interface AuthConfig {
  /** HMAC key the session cookie is signed with. */
  sessionSecret: string;
  /** scrypt hash of the editor password, as produced by `hashPassword`. */
  passwordHash: string;
  /** Set the Secure cookie flag (true behind HTTPS; false for local http). */
  secure: boolean;
  /** Session lifetime in seconds. */
  ttlSeconds: number;
}

export const COOKIE_NAME = 'cmt_session';
/** Default session lifetime: 7 days. */
export const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;

/** Produce a `salt:hash` scrypt digest for storage in CMT_EDITOR_PASSWORD_HASH. */
export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64);
  return `${salt.toString('hex')}:${hash.toString('hex')}`;
}

/** Constant-time verification of a password against a `salt:hash` digest. */
export function verifyPassword(password: string, stored: string): boolean {
  const [saltHex, hashHex] = stored.split(':');
  if (!saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, 'hex');
  const actual = scryptSync(password, Buffer.from(saltHex, 'hex'), expected.length);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

/** Mint a signed `payload.signature` session token. */
export function signSession(secret: string, ttlSeconds: number, now: number = Date.now()): string {
  const exp = Math.floor(now / 1000) + ttlSeconds;
  const payload = Buffer.from(JSON.stringify({ sub: 'editor', exp })).toString('base64url');
  const sig = createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

/** True when the token's signature is valid and it has not expired. */
export function verifySession(secret: string, token: string | undefined, now: number = Date.now()): boolean {
  if (!token) return false;
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return false;
  const expectedSig = createHmac('sha256', secret).update(payload).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expectedSig);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false;
  try {
    const { exp } = JSON.parse(Buffer.from(payload, 'base64url').toString()) as { exp?: number };
    return typeof exp === 'number' && exp > Math.floor(now / 1000);
  } catch {
    return false;
  }
}

/** Read a single cookie value from a raw Cookie header. */
export function readCookie(header: string | undefined, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() === name) return decodeURIComponent(part.slice(eq + 1).trim());
  }
  return undefined;
}

/** Guard that 401s any request without a valid editor session cookie. */
export function requireEditor(config: AuthConfig): RequestHandler {
  return (req, _res, next) => {
    if (verifySession(config.sessionSecret, readCookie(req.headers.cookie, COOKIE_NAME))) {
      next();
      return;
    }
    next(new HttpError(401, 'Authentication required'));
  };
}
