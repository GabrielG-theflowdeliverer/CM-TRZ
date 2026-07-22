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

async function objective() {
  const { body } = await request(ctx.app)
    .post(`/api/projects/${projectId}/objectives`)
    .send({ level: 'organization', statement: 'Cut average handling time' })
    .expect(201);
  return body.id as string;
}

describe('outcomes', () => {
  it('builds the objective→metric→measurement tree with realization derived on read', async () => {
    const objId = await objective();
    const { body: metric } = await request(ctx.app)
      .post(`/api/objectives/${objId}/metrics`)
      .send({ kind: 'benefit', name: 'Handling time', unit: 'min', baseline: 10, target: 5, direction: 'decrease' })
      .expect(201);

    // Two readings; the later one is 7.5 -> halfway from 10 down to 5 = 50%.
    await request(ctx.app).post(`/api/metrics/${metric.id}/measurements`).send({ date: '2026-06-01', value: 9 }).expect(201);
    await request(ctx.app).post(`/api/metrics/${metric.id}/measurements`).send({ date: '2026-08-01', value: 7.5 }).expect(201);

    const { body } = await request(ctx.app).get(`/api/projects/${projectId}/outcomes`).expect(200);
    expect(body.objectives).toHaveLength(1);
    const m = body.objectives[0].metrics[0];
    expect(m.measurements).toHaveLength(2);
    expect(m.computed).toEqual({ current: 7.5, pct: 50 });
    expect(body.objectives[0].realization).toBe(50);
    expect(body.realization).toBe(50);
  });

  it('requires an adoptionMeasure for adoption metrics and validates the group', async () => {
    const objId = await objective();
    await request(ctx.app).post(`/api/objectives/${objId}/metrics`).send({ kind: 'adoption', name: 'Usage' }).expect(400);

    const { body: group } = await request(ctx.app).post(`/api/projects/${projectId}/groups`).send({ name: 'Sales' }).expect(201);
    await request(ctx.app)
      .post(`/api/objectives/${objId}/metrics`)
      .send({ kind: 'adoption', name: 'Usage', adoptionMeasure: 'utilization', groupId: group.id })
      .expect(201);

    // A group from another project is rejected.
    const { body: other } = await request(ctx.app).post('/api/projects').send({ name: 'Other' }).expect(201);
    const { body: foreign } = await request(ctx.app).post(`/api/projects/${other.id}/groups`).send({ name: 'X' }).expect(201);
    await request(ctx.app)
      .post(`/api/objectives/${objId}/metrics`)
      .send({ kind: 'adoption', name: 'Usage', adoptionMeasure: 'speed', groupId: foreign.id })
      .expect(400);
  });

  it('deletes cascade: removing an objective drops its metrics and measurements', async () => {
    const objId = await objective();
    const { body: metric } = await request(ctx.app)
      .post(`/api/objectives/${objId}/metrics`)
      .send({ kind: 'benefit', name: 'Revenue', baseline: 0, target: 100 })
      .expect(201);
    await request(ctx.app).post(`/api/metrics/${metric.id}/measurements`).send({ date: '2026-06-01', value: 40 }).expect(201);

    await request(ctx.app).delete(`/api/objectives/${objId}`).expect(204);
    const { body } = await request(ctx.app).get(`/api/projects/${projectId}/outcomes`).expect(200);
    expect(body.objectives).toHaveLength(0);
  });

  it('averages realization across metrics, ignoring unmeasured ones', async () => {
    const objId = await objective();
    const post = (over: object) =>
      request(ctx.app).post(`/api/objectives/${objId}/metrics`).send({ kind: 'benefit', name: 'm', ...over }).expect(201);
    const { body: m1 } = await post({ baseline: 0, target: 10 });
    const { body: m2 } = await post({ baseline: 0, target: 10 });
    await post({ baseline: 0, target: 10 }); // never measured -> excluded
    await request(ctx.app).post(`/api/metrics/${m1.id}/measurements`).send({ date: '2026-06-01', value: 4 }).expect(201);
    await request(ctx.app).post(`/api/metrics/${m2.id}/measurements`).send({ date: '2026-06-01', value: 6 }).expect(201);

    const { body } = await request(ctx.app).get(`/api/projects/${projectId}/outcomes`).expect(200);
    expect(body.realization).toBe(50); // mean(40, 60), the unmeasured metric ignored
  });

  it('404s an unknown objective/metric/measurement', async () => {
    await request(ctx.app).patch('/api/objectives/nope').send({ statement: 'x' }).expect(404);
    await request(ctx.app).delete('/api/metrics/nope').expect(404);
    await request(ctx.app).delete('/api/measurements/nope').expect(404);
  });
});
