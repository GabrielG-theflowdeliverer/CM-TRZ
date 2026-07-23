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

describe('transfer of ownership', () => {
  it('creates, lists, updates and deletes checklist items', async () => {
    const { body: item } = await request(ctx.app)
      .post(`/api/projects/${projectId}/transfer-items`)
      .send({ responsibility: 'Monitor adoption and usage of the change', newOwner: 'Ops Lead' })
      .expect(201);
    expect(item).toMatchObject({ responsibility: 'Monitor adoption and usage of the change', newOwner: 'Ops Lead', done: false });

    await request(ctx.app)
      .post(`/api/projects/${projectId}/transfer-items`)
      .send({ responsibility: 'Keep reinforcement mechanisms active' })
      .expect(201);

    const { body: list } = await request(ctx.app).get(`/api/projects/${projectId}/transfer-items`).expect(200);
    expect(list).toHaveLength(2);

    const { body: done } = await request(ctx.app)
      .patch(`/api/transfer-items/${item.id}`)
      .send({ done: true })
      .expect(200);
    expect(done.done).toBe(true);

    await request(ctx.app).delete(`/api/transfer-items/${item.id}`).expect(204);
    const { body: after } = await request(ctx.app).get(`/api/projects/${projectId}/transfer-items`).expect(200);
    expect(after).toHaveLength(1);
  });

  it('rejects an empty responsibility and 404s an unknown item', async () => {
    await request(ctx.app).post(`/api/projects/${projectId}/transfer-items`).send({ responsibility: '' }).expect(400);
    await request(ctx.app).patch('/api/transfer-items/nope').send({ done: true }).expect(404);
    await request(ctx.app).delete('/api/transfer-items/nope').expect(404);
  });

  it('removes a project\'s items when the project is deleted (cascade)', async () => {
    await request(ctx.app)
      .post(`/api/projects/${projectId}/transfer-items`)
      .send({ responsibility: 'Own ongoing performance measurement' })
      .expect(201);
    await request(ctx.app).delete(`/api/projects/${projectId}`).expect(204);
    await request(ctx.app).get(`/api/projects/${projectId}/transfer-items`).expect(404);
  });
});
