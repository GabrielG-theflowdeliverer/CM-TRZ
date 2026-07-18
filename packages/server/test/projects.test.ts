import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createTestApp, type TestContext } from './harness.js';

let ctx: TestContext;
beforeEach(() => {
  ctx = createTestApp();
});

describe('health', () => {
  it('reports ok from the liveness probe', async () => {
    const { body } = await request(ctx.app).get('/api/health').expect(200);
    expect(body).toEqual({ ok: true });
  });
});

describe('projects', () => {
  it('creates a project and seeds core plans, roadmap and an overall blueprint', async () => {
    const created = await request(ctx.app)
      .post('/api/projects')
      .send({ name: 'CRM Rollout', projectType: 'Digital Transformation', pmApproach: 'Iterative' })
      .expect(201);
    expect(created.body.name).toBe('CRM Rollout');

    const plans = await request(ctx.app).get(`/api/projects/${created.body.id}/plans`).expect(200);
    expect(plans.body.map((p: { name: string }) => p.name)).toEqual([
      'Communications Plan',
      'Training Plan',
      'Sponsor Plan',
      'People Manager Plan',
    ]);
    expect(plans.body.every((p: { kind: string }) => p.kind === 'core')).toBe(true);

    const roadmap = await request(ctx.app).get(`/api/projects/${created.body.id}/roadmap`).expect(200);
    expect(roadmap.body.mode).toBe('sequential');

    const blueprints = await request(ctx.app).get(`/api/projects/${created.body.id}/blueprints`).expect(200);
    expect(blueprints.body).toHaveLength(1);
    expect(blueprints.body[0].scopeKind).toBe('overall');
  });

  it('rejects invalid payloads with 400', async () => {
    await request(ctx.app).post('/api/projects').send({ name: '' }).expect(400);
    await request(ctx.app).post('/api/projects').send({ name: 'X', pmApproach: 'Agile' }).expect(400);
  });

  it('updates status and deletes', async () => {
    const { body: project } = await request(ctx.app).post('/api/projects').send({ name: 'A' }).expect(201);
    expect(project.status).toBe('Active');
    const updated = await request(ctx.app)
      .patch(`/api/projects/${project.id}`)
      .send({ name: 'B', status: 'Paused / On Hold' })
      .expect(200);
    expect(updated.body.name).toBe('B');
    expect(updated.body.status).toBe('Paused / On Hold');
    await request(ctx.app).patch(`/api/projects/${project.id}`).send({ status: 'Bogus' }).expect(400);
    await request(ctx.app).delete(`/api/projects/${project.id}`).expect(204);
    await request(ctx.app).get(`/api/projects/${project.id}`).expect(404);
  });

  it('generates a fully-populated demo project', async () => {
    const { body: demo } = await request(ctx.app).post('/api/projects/demo').expect(201);
    expect(demo.name).toContain('Demo');
    const { body: groups } = await request(ctx.app).get(`/api/projects/${demo.id}/groups`).expect(200);
    expect(groups.length).toBeGreaterThanOrEqual(2);
    const { body: dash } = await request(ctx.app).get(`/api/projects/${demo.id}/dashboard`).expect(200);
    expect(dash.pct?.scores.success).toBe(30);
    expect(dash.risk?.quadrant).toBe('High');
    expect(dash.project.watchGroupIds.length).toBeGreaterThan(0);
    const { body: activities } = await request(ctx.app).get(`/api/projects/${demo.id}/activities`).expect(200);
    // The cross-plan activity appears once and links two plans.
    const crossPlan = activities.find((a: { name: string }) => a.name === 'Launch email + FAQ');
    expect(crossPlan.planIds.length).toBe(2);
  });

  it('404s on unknown ids', async () => {
    await request(ctx.app).get('/api/projects/nope').expect(404);
    await request(ctx.app).patch('/api/projects/nope').send({ name: 'X' }).expect(404);
    await request(ctx.app).delete('/api/projects/nope').expect(404);
  });

  it('duplicates a project as a deep copy with new ids', async () => {
    const { body: project } = await request(ctx.app).post('/api/projects').send({ name: 'Source' }).expect(201);
    const { body: group } = await request(ctx.app)
      .post(`/api/projects/${project.id}/groups`)
      .send({ name: 'Client Services', numPeople: 40 })
      .expect(201);
    await request(ctx.app)
      .put(`/api/groups/${group.id}/aspects`)
      .send([{ aspectKey: 'processes', impact: 5, yesterday: 'Manual', tomorrow: 'Automated' }])
      .expect(200);
    await request(ctx.app)
      .put(`/api/groups/${group.id}/adkar`)
      .send({ 'adkar.awareness': 4, 'adkar.desire': 2 })
      .expect(200);
    const { body: assessment } = await request(ctx.app)
      .post(`/api/projects/${project.id}/assessments`)
      .send({ type: 'pct', subjectKind: 'project' })
      .expect(201);
    await request(ctx.app).put(`/api/assessments/${assessment.id}/responses`).send({ 'pct.success.1': 3 }).expect(200);

    const { body: copy } = await request(ctx.app).post(`/api/projects/${project.id}/duplicate`).expect(201);
    expect(copy.name).toBe('Source (copy)');
    expect(copy.id).not.toBe(project.id);

    const { body: copiedGroups } = await request(ctx.app).get(`/api/projects/${copy.id}/groups`).expect(200);
    expect(copiedGroups).toHaveLength(1);
    expect(copiedGroups[0].id).not.toBe(group.id);
    expect(copiedGroups[0].name).toBe('Client Services');
    expect(copiedGroups[0].aspects.find((a: { aspectKey: string }) => a.aspectKey === 'processes').impact).toBe(5);
    expect(copiedGroups[0].adkar.desire).toBe(2);
    expect(copiedGroups[0].computed.barrierPoint).toBe('Desire');

    const { body: copiedAssessments } = await request(ctx.app)
      .get(`/api/projects/${copy.id}/assessments?type=pct`)
      .expect(200);
    expect(copiedAssessments).toHaveLength(1);
    expect(copiedAssessments[0].responses['pct.success.1']).toBe(3);

    // Editing the copy must not touch the source.
    await request(ctx.app).patch(`/api/groups/${copiedGroups[0].id}`).send({ name: 'Renamed' }).expect(200);
    const { body: sourceGroups } = await request(ctx.app).get(`/api/projects/${project.id}/groups`).expect(200);
    expect(sourceGroups[0].name).toBe('Client Services');
  });
});
