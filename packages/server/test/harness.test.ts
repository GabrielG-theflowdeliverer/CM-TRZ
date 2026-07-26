import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createTestApp } from './harness.js';

/**
 * The harness is load-bearing: every other server suite runs through it, and
 * the reason it exists in its current shape (one listening server per test,
 * rather than one per request) is a flake fix. A silent regression there would
 * not fail anything — it would just make the suite unreliable again, slowly.
 * These cases assert the property directly.
 */
describe('test harness', () => {
  it('serves every request from the same listening server', async () => {
    const ctx = createTestApp();
    const port = (ctx.app.address() as { port: number }).port;

    // If supertest were starting its own server per request (what it does when
    // handed a bare Express app), ours would see none of these.
    let handled = 0;
    ctx.app.on('request', () => {
      handled += 1;
    });

    await request(ctx.app).get('/api/health').expect(200);
    await request(ctx.app).post('/api/projects').send({ name: 'P' }).expect(201);
    await request(ctx.app).get('/api/projects').expect(200);

    expect(handled).toBe(3);
    expect(ctx.app.listening).toBe(true);
    expect((ctx.app.address() as { port: number }).port).toBe(port);
  });

  it('gives each test its own database', async () => {
    // Isolation still has to hold now that servers are pooled and closed
    // globally rather than per file.
    const ctx = createTestApp();
    const { body } = await request(ctx.app).get('/api/projects').expect(200);
    expect(body).toEqual([]);
  });
});
