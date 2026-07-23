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

  it('does NOT emit a Content-Security-Policy yet (deferred to step 1b)', async () => {
    const { app } = createTestApp();
    const res = await request(app).get('/api/health');
    expect(res.headers['content-security-policy']).toBeUndefined();
  });
});
