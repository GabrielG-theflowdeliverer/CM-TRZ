import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { RISK_ITEM_KEYS } from '@cmt/domain';
import { createTestApp, type TestContext } from './harness.js';

let ctx: TestContext;
let projectId: string;

beforeEach(async () => {
  ctx = createTestApp();
  const { body } = await request(ctx.app).post('/api/projects').send({ name: 'P' }).expect(201);
  projectId = body.id;
});

describe('assessment engine', () => {
  it('supports multiple runs per type and lists them', async () => {
    await request(ctx.app).post(`/api/projects/${projectId}/assessments`).send({ type: 'pct' }).expect(201);
    await request(ctx.app).post(`/api/projects/${projectId}/assessments`).send({ type: 'pct' }).expect(201);
    await request(ctx.app).post(`/api/projects/${projectId}/assessments`).send({ type: 'risk' }).expect(201);
    const { body: pctRuns } = await request(ctx.app)
      .get(`/api/projects/${projectId}/assessments?type=pct`)
      .expect(200);
    expect(pctRuns).toHaveLength(2);
    const { body: all } = await request(ctx.app).get(`/api/projects/${projectId}/assessments`).expect(200);
    expect(all).toHaveLength(3);
  });

  it('computes PCT scores only when an aspect is fully answered', async () => {
    const { body: run } = await request(ctx.app)
      .post(`/api/projects/${projectId}/assessments`)
      .send({ type: 'pct' })
      .expect(201);
    const partial: Record<string, number> = {};
    for (let i = 1; i <= 9; i++) partial[`pct.success.${i}`] = 3;
    let { body } = await request(ctx.app).put(`/api/assessments/${run.id}/responses`).send(partial).expect(200);
    expect(body.computed.pct.success).toBeNull();

    ({ body } = await request(ctx.app)
      .put(`/api/assessments/${run.id}/responses`)
      .send({ 'pct.success.10': 2 })
      .expect(200));
    expect(body.computed.pct.success).toBe(29);
  });

  it('rejects out-of-range and unknown responses with 400', async () => {
    const { body: run } = await request(ctx.app)
      .post(`/api/projects/${projectId}/assessments`)
      .send({ type: 'pct' })
      .expect(201);
    await request(ctx.app).put(`/api/assessments/${run.id}/responses`).send({ 'pct.success.1': 4 }).expect(400);
    await request(ctx.app).put(`/api/assessments/${run.id}/responses`).send({ 'risk.cc.1': 3 }).expect(400);
    await request(ctx.app).put(`/api/assessments/${run.id}/responses`).send({ 'pct.success.1': 2.5 }).expect(400);
  });

  it('computes the risk quadrant from full sections', async () => {
    const { body: run } = await request(ctx.app)
      .post(`/api/projects/${projectId}/assessments`)
      .send({ type: 'risk' })
      .expect(201);
    const responses: Record<string, number> = {};
    for (const key of RISK_ITEM_KEYS) responses[key] = key.startsWith('risk.cc') ? 4 : 2;
    const { body } = await request(ctx.app).put(`/api/assessments/${run.id}/responses`).send(responses).expect(200);
    expect(body.computed.risk).toEqual({ cc: 56, oa: 28, quadrant: 'Medium' });
  });

  it('keeps risk sections NA until all fourteen factors are answered', async () => {
    const { body: run } = await request(ctx.app)
      .post(`/api/projects/${projectId}/assessments`)
      .send({ type: 'risk' })
      .expect(201);
    const { body } = await request(ctx.app)
      .put(`/api/assessments/${run.id}/responses`)
      .send({ 'risk.cc.1': 5 })
      .expect(200);
    expect(body.computed.risk.cc).toBeNull();
    expect(body.computed.risk.quadrant).toBeNull();
  });

  it('computes sponsor competency totals and interpretation', async () => {
    const { body: run } = await request(ctx.app)
      .post(`/api/projects/${projectId}/assessments`)
      .send({ type: 'sponsor_competency', subjectKind: 'person', label: 'CFO' })
      .expect(201);
    const { body } = await request(ctx.app)
      .put(`/api/assessments/${run.id}/responses`)
      .send({ 'sponsor_competency.participation.1': 4, 'sponsor_competency.coalition.3': 5 })
      .expect(200);
    expect(body.computed.competency.total).toBe(9);
    expect(body.computed.competency.interpretation).toBe('Fair to Poor');
  });

  it('a new run always starts blank — the removed copyFromLatest flag does nothing', async () => {
    // The pre-fill convenience was removed once surveys became the scoring
    // source of truth (stale hand-entered data must not seed new runs). The
    // schema strips the unknown key; this guards against it creeping back.
    const { body: first } = await request(ctx.app)
      .post(`/api/projects/${projectId}/assessments`)
      .send({ type: 'pct' })
      .expect(201);
    await request(ctx.app).put(`/api/assessments/${first.id}/responses`).send({ 'pct.success.1': 2 }).expect(200);

    const { body: second } = await request(ctx.app)
      .post(`/api/projects/${projectId}/assessments`)
      .send({ type: 'pct', copyFromLatest: true })
      .expect(201);
    expect(second.responses).toEqual({});
  });

  it('requires a subjectId for group-scoped runs', async () => {
    await request(ctx.app)
      .post(`/api/projects/${projectId}/assessments`)
      .send({ type: 'adkar', subjectKind: 'group' })
      .expect(400);
  });

  it('404s for unknown assessments and projects', async () => {
    await request(ctx.app).get('/api/assessments/nope').expect(404);
    await request(ctx.app).get('/api/projects/nope/assessments').expect(404);
    await request(ctx.app).put('/api/assessments/nope/responses').send({}).expect(404);
  });

  it('deletes runs', async () => {
    const { body: run } = await request(ctx.app)
      .post(`/api/projects/${projectId}/assessments`)
      .send({ type: 'manager_competency', subjectKind: 'person' })
      .expect(201);
    await request(ctx.app).delete(`/api/assessments/${run.id}`).expect(204);
    await request(ctx.app).get(`/api/assessments/${run.id}`).expect(404);
  });
});
