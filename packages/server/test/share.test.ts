import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createTestApp, type TestContext } from './harness.js';

let ctx: TestContext;
let projectId: string;

beforeEach(async () => {
  ctx = createTestApp();
  const { body } = await request(ctx.app).post('/api/projects').send({ name: 'P' }).expect(201);
  projectId = body.id;
});

describe('view-only project share', () => {
  it('is off by default and turns on with an unguessable token', async () => {
    const { body: off } = await request(ctx.app).get(`/api/projects/${projectId}/share`).expect(200);
    expect(off).toEqual({ token: null });

    const { body: on } = await request(ctx.app).post(`/api/projects/${projectId}/share`).expect(201);
    expect(on.token).toEqual(expect.any(String));
    expect(on.token.length).toBeGreaterThan(20);

    const { body: state } = await request(ctx.app).get(`/api/projects/${projectId}/share`).expect(200);
    expect(state.token).toBe(on.token);
  });

  it('serves the read-only dashboard projection for a valid token', async () => {
    const { body: on } = await request(ctx.app).post(`/api/projects/${projectId}/share`).expect(201);
    const { body: view } = await request(ctx.app).get(`/api/share/${on.token}`).expect(200);
    // The dashboard projection, and nothing token-ish inside it.
    expect(view.project.name).toBe('P');
    expect(view).toHaveProperty('groups');
    expect(view).toHaveProperty('barrierCounts');
    expect(JSON.stringify(view)).not.toContain(on.token);
  });

  it('rotating the token revokes old links; disabling revokes entirely', async () => {
    const { body: first } = await request(ctx.app).post(`/api/projects/${projectId}/share`).expect(201);
    const { body: second } = await request(ctx.app).post(`/api/projects/${projectId}/share`).expect(201);
    expect(second.token).not.toBe(first.token);

    await request(ctx.app).get(`/api/share/${first.token}`).expect(404); // old link dead
    await request(ctx.app).get(`/api/share/${second.token}`).expect(200);

    await request(ctx.app).delete(`/api/projects/${projectId}/share`).expect(204);
    await request(ctx.app).get(`/api/share/${second.token}`).expect(404);
    const { body: off } = await request(ctx.app).get(`/api/projects/${projectId}/share`).expect(200);
    expect(off).toEqual({ token: null });
  });

  it('404s an unknown token and never leaks the share token via project DTOs', async () => {
    await request(ctx.app).get('/api/share/not-a-token').expect(404);

    const { body: on } = await request(ctx.app).post(`/api/projects/${projectId}/share`).expect(201);
    const { body: project } = await request(ctx.app).get(`/api/projects/${projectId}`).expect(200);
    const { body: list } = await request(ctx.app).get('/api/projects').expect(200);
    expect(JSON.stringify(project)).not.toContain(on.token);
    expect(JSON.stringify(list)).not.toContain(on.token);
  });
});
