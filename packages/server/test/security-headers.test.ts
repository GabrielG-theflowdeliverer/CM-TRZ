import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createTestApp } from './harness.js';

describe('security headers', () => {
  it('sets a strict Referrer-Policy so URL tokens never leak in the Referer header', async () => {
    const { app } = createTestApp();
    const res = await request(app).get('/api/health');
    // The token-in-URL leak is the reason this exists — no-referrer closes it.
    expect(res.headers['referrer-policy']).toBe('no-referrer');
  });

  it('sets the baseline hardening headers on API responses', async () => {
    const { app } = createTestApp();
    const res = await request(app).get('/api/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    // helmet frameguard defaults to DENY — no clickjacking via <iframe>.
    expect(res.headers['x-frame-options']).toBe('DENY');
    // helmet strips the framework fingerprint.
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('applies the headers to the public token surfaces too', async () => {
    const { app } = createTestApp();
    // An unknown share token 404s, but the headers must already be attached.
    const res = await request(app).get('/api/share/does-not-exist');
    expect(res.headers['referrer-policy']).toBe('no-referrer');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });

  it('emits a same-origin Content-Security-Policy', async () => {
    const { app } = createTestApp();
    const res = await request(app).get('/api/health');
    const csp = res.headers['content-security-policy'];
    expect(csp).toBeDefined();
    // Scripts are same-origin only — no 'unsafe-inline' escape hatch for JS.
    expect(csp).toContain("script-src 'self'");
    expect(csp).not.toContain("script-src 'self' 'unsafe-inline'");
    // Styles need 'unsafe-inline' because recharts sets inline style="" on its
    // SVG nodes (verified in-browser — see docs/prod-readiness.md item 1b).
    expect(csp).toContain("style-src 'self' 'unsafe-inline'");
    // No embedding, no plugins.
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
  });
});
