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

describe('reinforcement actions', () => {
  it('creates group-scoped and project-wide actions, lists and updates them', async () => {
    const { body: group } = await request(ctx.app).post(`/api/projects/${projectId}/groups`).send({ name: 'Sales' }).expect(201);

    const { body: scoped } = await request(ctx.app)
      .post(`/api/projects/${projectId}/reinforcement-actions`)
      .send({ groupId: group.id, mechanism: 'Weekly wins recognition', owner: 'J. Smith', status: 'In Progress' })
      .expect(201);
    expect(scoped).toMatchObject({ groupId: group.id, mechanism: 'Weekly wins recognition', status: 'In Progress' });

    await request(ctx.app)
      .post(`/api/projects/${projectId}/reinforcement-actions`)
      .send({ mechanism: 'Quarterly sustainment audit' }) // project-wide (no group)
      .expect(201);

    const { body: list } = await request(ctx.app).get(`/api/projects/${projectId}/reinforcement-actions`).expect(200);
    expect(list).toHaveLength(2);

    const { body: done } = await request(ctx.app)
      .patch(`/api/reinforcement-actions/${scoped.id}`)
      .send({ status: 'Completed' })
      .expect(200);
    expect(done.status).toBe('Completed');

    await request(ctx.app).delete(`/api/reinforcement-actions/${scoped.id}`).expect(204);
    const { body: after } = await request(ctx.app).get(`/api/projects/${projectId}/reinforcement-actions`).expect(200);
    expect(after).toHaveLength(1);
  });

  it('rejects a mechanism-less action and a foreign group', async () => {
    await request(ctx.app).post(`/api/projects/${projectId}/reinforcement-actions`).send({ owner: 'x' }).expect(400);

    const { body: other } = await request(ctx.app).post('/api/projects').send({ name: 'Other' }).expect(201);
    const { body: foreign } = await request(ctx.app).post(`/api/projects/${other.id}/groups`).send({ name: 'X' }).expect(201);
    await request(ctx.app)
      .post(`/api/projects/${projectId}/reinforcement-actions`)
      .send({ groupId: foreign.id, mechanism: 'Coaching' })
      .expect(400);
  });

  it('removes a group\'s actions when the group is deleted (cascade)', async () => {
    const { body: group } = await request(ctx.app).post(`/api/projects/${projectId}/groups`).send({ name: 'Ops' }).expect(201);
    await request(ctx.app)
      .post(`/api/projects/${projectId}/reinforcement-actions`)
      .send({ groupId: group.id, mechanism: 'Peer coaching' })
      .expect(201);

    await request(ctx.app).delete(`/api/groups/${group.id}`).expect(204);
    const { body: list } = await request(ctx.app).get(`/api/projects/${projectId}/reinforcement-actions`).expect(200);
    expect(list).toHaveLength(0);
  });

  it('404s an unknown action', async () => {
    await request(ctx.app).patch('/api/reinforcement-actions/nope').send({ status: 'Completed' }).expect(404);
    await request(ctx.app).delete('/api/reinforcement-actions/nope').expect(404);
  });
});
