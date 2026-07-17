import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { PCT_ITEM_KEYS, RISK_ITEM_KEYS } from '@cmt/domain';
import { createTestApp, type TestContext } from './harness.js';

let ctx: TestContext;

beforeEach(() => {
  ctx = createTestApp();
});

async function buildRichProject(name: string): Promise<string> {
  const { body: project } = await request(ctx.app).post('/api/projects').send({ name }).expect(201);
  const projectId = project.id as string;

  // PCT run: all 3s except one aspect at 2s (success 30, others 30/30/20 pattern)
  const { body: pctRun } = await request(ctx.app)
    .post(`/api/projects/${projectId}/assessments`)
    .send({ type: 'pct', completedDate: '2026-07-01' })
    .expect(201);
  const pct: Record<string, number> = {};
  for (const key of PCT_ITEM_KEYS) pct[key] = key.startsWith('pct.change_management') ? 2 : 3;
  await request(ctx.app).put(`/api/assessments/${pctRun.id}/responses`).send(pct).expect(200);

  // High-risk run (both sections >= 42)
  const { body: riskRun } = await request(ctx.app)
    .post(`/api/projects/${projectId}/assessments`)
    .send({ type: 'risk', completedDate: '2026-07-02' })
    .expect(201);
  const risk: Record<string, number> = {};
  for (const key of RISK_ITEM_KEYS) risk[key] = 4;
  await request(ctx.app).put(`/api/assessments/${riskRun.id}/responses`).send(risk).expect(200);

  // Group with impact + ADKAR barrier
  const { body: group } = await request(ctx.app)
    .post(`/api/projects/${projectId}/groups`)
    .send({ name: 'Client Services', numPeople: 40 })
    .expect(201);
  await request(ctx.app)
    .put(`/api/groups/${group.id}/aspects`)
    .send([
      { aspectKey: 'processes', impact: 4 },
      { aspectKey: 'systems', impact: 2 },
    ])
    .expect(200);
  await request(ctx.app)
    .put(`/api/groups/${group.id}/adkar`)
    .send({ 'adkar.awareness': 4, 'adkar.desire': 3 })
    .expect(200);

  // Roadmap + plan activity (one overdue) + tracking check
  await request(ctx.app)
    .put(`/api/projects/${projectId}/roadmap`)
    .send({ goliveDate: '2099-01-01' })
    .expect(200);
  const { body: plans } = await request(ctx.app).get(`/api/projects/${projectId}/plans`).expect(200);
  await request(ctx.app)
    .post(`/api/plans/${plans[0].id}/activities`)
    .send({ name: 'Old task', finishDate: '2020-01-01', status: 'In Progress' })
    .expect(201);
  await request(ctx.app)
    .post(`/api/plans/${plans[0].id}/activities`)
    .send({ name: 'Done task', status: 'Completed' })
    .expect(201);
  await request(ctx.app)
    .post(`/api/projects/${projectId}/cm-perf`)
    .send({ type: 'Core Plan', description: 'Comms', status: 'On Target', completedDate: '2026-07-01' })
    .expect(201);
  return projectId;
}

describe('export / import', () => {
  it('round-trips a project losslessly', async () => {
    const projectId = await buildRichProject('Exportable');
    const { body: payload } = await request(ctx.app).get(`/api/projects/${projectId}/export`).expect(200);
    expect(payload.format).toBe('change-management-tool/project');

    const { body: imported } = await request(ctx.app).post('/api/import').send(payload).expect(201);
    expect(imported.id).not.toBe(projectId);
    expect(imported.name).toBe('Exportable');

    const [src, dst] = await Promise.all([
      request(ctx.app).get(`/api/projects/${projectId}/export`),
      request(ctx.app).get(`/api/projects/${imported.id}/export`),
    ]);
    // Same shape and counts everywhere; ids differ by design.
    for (const key of [
      'assessments',
      'assessmentResponses',
      'groups',
      'groupAspects',
      'plans',
      'planActivities',
      'blueprints',
      'trackingEntries',
      'cmPerfEntries',
    ] as const) {
      expect(dst.body[key]).toHaveLength(src.body[key].length);
    }
    const { body: groups } = await request(ctx.app).get(`/api/projects/${imported.id}/groups`).expect(200);
    expect(groups[0].computed.barrierPoint).toBe('Desire');
    expect(groups[0].computed.degreeOfImpact).toBe(3);
  });

  it('rejects malformed payloads', async () => {
    await request(ctx.app).post('/api/import').send({ hello: 'world' }).expect(400);
  });
});

describe('dashboard', () => {
  it('aggregates health across projects', async () => {
    await buildRichProject('Alpha');
    await buildRichProject('Beta');
    // A third empty project should not break anything.
    await request(ctx.app).post('/api/projects').send({ name: 'Empty' }).expect(201);

    const { body } = await request(ctx.app).get('/api/dashboard').expect(200);
    expect(body.summary.totalProjects).toBe(3);
    expect(body.summary.highRiskCount).toBe(2); // all 4s -> CC 56 / OA 56 -> High
    expect(body.summary.overdueActivities).toBe(2); // one per rich project

    const alpha = body.projects.find((p: { name: string }) => p.name === 'Alpha');
    expect(alpha.pct.scores).toEqual({
      success: 30,
      leadership: 30,
      project_management: 30,
      change_management: 20,
    });
    expect(alpha.risk.quadrant).toBe('High');
    expect(alpha.groupCount).toBe(1);
    expect(alpha.totalPeople).toBe(40);
    expect(alpha.avgDegreeOfImpact).toBe(3);
    expect(alpha.barrierDistribution).toEqual({ Desire: 1 });
    expect(alpha.progress.percentComplete).toBe(50);
    expect(alpha.latestCmPerfStatus).toBe('On Target');
    expect(alpha.nextMilestone).toEqual({ date: '2099-01-01', label: 'Go Live' });

    const empty = body.projects.find((p: { name: string }) => p.name === 'Empty');
    expect(empty.pct).toBeNull();
    expect(empty.risk).toBeNull();
    expect(empty.progress.percentComplete).toBeNull();
  });

  it('excludes archived projects', async () => {
    const projectId = await buildRichProject('Archived soon');
    await request(ctx.app).patch(`/api/projects/${projectId}`).send({ archived: true }).expect(200);
    const { body } = await request(ctx.app).get('/api/dashboard').expect(200);
    expect(body.summary.totalProjects).toBe(0);
  });
});
