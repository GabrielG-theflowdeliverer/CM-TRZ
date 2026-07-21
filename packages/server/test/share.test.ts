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

  it('browses the whole project read-only: lists, items, docs and roadmap', async () => {
    const { body: on } = await request(ctx.app).post(`/api/projects/${projectId}/share`).expect(201);
    const t = on.token;
    const { body: group } = await request(ctx.app)
      .post(`/api/projects/${projectId}/groups`)
      .send({ name: 'Sales' })
      .expect(201);
    const { body: run } = await request(ctx.app)
      .post(`/api/projects/${projectId}/assessments`)
      .send({ type: 'pct' })
      .expect(201);

    // Project-scoped mirror.
    const { body: project } = await request(ctx.app).get(`/api/share/${t}/projects/${projectId}`).expect(200);
    expect(project.name).toBe('P');
    const { body: groups } = await request(ctx.app).get(`/api/share/${t}/projects/${projectId}/groups`).expect(200);
    expect(groups).toHaveLength(1);
    await request(ctx.app).get(`/api/share/${t}/projects/${projectId}/assessments`).expect(200);
    await request(ctx.app).get(`/api/share/${t}/projects/${projectId}/roadmap`).expect(200);
    await request(ctx.app).get(`/api/share/${t}/projects/${projectId}/tracking`).expect(200);

    // Item-level reads, ownership-checked.
    const { body: sharedRun } = await request(ctx.app).get(`/api/share/${t}/assessments/${run.id}`).expect(200);
    expect(sharedRun.id).toBe(run.id);
    await request(ctx.app).get(`/api/share/${t}/groups/${group.id}`).expect(200);
  });

  it('rejects every write with 403 — the guard runs before the reused routers', async () => {
    const { body: on } = await request(ctx.app).post(`/api/projects/${projectId}/share`).expect(201);
    const t = on.token;
    await request(ctx.app).post(`/api/share/${t}/projects/${projectId}/groups`).send({ name: 'X' }).expect(403);
    await request(ctx.app)
      .patch(`/api/share/${t}/projects/${projectId}`)
      .send({ name: 'Hacked' })
      .expect(403);
    await request(ctx.app).delete(`/api/share/${t}/projects/${projectId}/roles`).expect(403);
    // Nothing was created through the share surface.
    const { body: groups } = await request(ctx.app).get(`/api/projects/${projectId}/groups`).expect(200);
    expect(groups).toHaveLength(0);
  });

  it('pins the token to its project: foreign projects and items 404', async () => {
    const { body: on } = await request(ctx.app).post(`/api/projects/${projectId}/share`).expect(201);
    const t = on.token;
    const { body: other } = await request(ctx.app).post('/api/projects').send({ name: 'Other' }).expect(201);
    const { body: foreignGroup } = await request(ctx.app)
      .post(`/api/projects/${other.id}/groups`)
      .send({ name: 'Secret' })
      .expect(201);

    await request(ctx.app).get(`/api/share/${t}/projects/${other.id}/groups`).expect(404);
    await request(ctx.app).get(`/api/share/${t}/projects/${other.id}`).expect(404);
    await request(ctx.app).get(`/api/share/${t}/groups/${foreignGroup.id}`).expect(404);
  });

  it('excludes surveys and exports from the browse surface', async () => {
    const { body: on } = await request(ctx.app).post(`/api/projects/${projectId}/share`).expect(201);
    const t = on.token;
    // Surveys would leak respondent tokens; exports would bulk-download licensed content.
    await request(ctx.app).get(`/api/share/${t}/projects/${projectId}/surveys`).expect(404);
    await request(ctx.app).get(`/api/share/${t}/projects/${projectId}/export`).expect(404);
    await request(ctx.app).get(`/api/share/${t}/projects/${projectId}/share`).expect(404);
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
