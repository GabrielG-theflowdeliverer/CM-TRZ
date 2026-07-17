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

describe('blueprints', () => {
  it('supports multiple blueprints per project (overall, group, custom)', async () => {
    const { body: group } = await request(ctx.app)
      .post(`/api/projects/${projectId}/groups`)
      .send({ name: 'Sales' })
      .expect(201);
    await request(ctx.app)
      .post(`/api/projects/${projectId}/blueprints`)
      .send({ scopeKind: 'group', groupId: group.id, name: 'Sales Blueprint' })
      .expect(201);
    await request(ctx.app)
      .post(`/api/projects/${projectId}/blueprints`)
      .send({ scopeKind: 'custom', name: 'Release 2 Blueprint' })
      .expect(201);
    const { body: blueprints } = await request(ctx.app).get(`/api/projects/${projectId}/blueprints`).expect(200);
    // seeded Overall + two created
    expect(blueprints).toHaveLength(3);
    expect(blueprints.find((b: { scopeKind: string }) => b.scopeKind === 'group').groupName).toBe('Sales');
  });

  it('requires a valid group for group-scoped blueprints', async () => {
    await request(ctx.app)
      .post(`/api/projects/${projectId}/blueprints`)
      .send({ scopeKind: 'group', name: 'X' })
      .expect(400);
    await request(ctx.app)
      .post(`/api/projects/${projectId}/blueprints`)
      .send({ scopeKind: 'group', groupId: 'not-a-group', name: 'X' })
      .expect(400);
  });

  it('milestone dates default from the roadmap and can be overridden per element', async () => {
    await request(ctx.app)
      .put(`/api/projects/${projectId}/roadmap`)
      .send({ adkarMilestones: [{ releaseNo: 0, element: 'awareness', date: '2026-08-01' }] })
      .expect(200);
    const { body: blueprints } = await request(ctx.app).get(`/api/projects/${projectId}/blueprints`).expect(200);
    const overall = blueprints[0];
    expect(overall.computed.milestones.awareness).toEqual({ effectiveDate: '2026-08-01', fromRoadmap: true });

    const { body: updated } = await request(ctx.app)
      .put(`/api/blueprints/${overall.id}/elements`)
      .send({ element: 'awareness', milestoneOverrideDate: '2026-09-15', gaugeGap: 'Large' })
      .expect(200);
    expect(updated.computed.milestones.awareness).toEqual({ effectiveDate: '2026-09-15', fromRoadmap: false });
    expect(updated.elements.find((e: { element: string }) => e.element === 'awareness').gaugeGap).toBe('Large');
  });

  it('manages activities per ADKAR element', async () => {
    const { body: blueprints } = await request(ctx.app).get(`/api/projects/${projectId}/blueprints`).expect(200);
    const overall = blueprints[0];
    const { body: withActivity } = await request(ctx.app)
      .post(`/api/blueprints/${overall.id}/activities`)
      .send({ element: 'desire', name: 'WIIFM sessions', startDate: '2026-08-01', finishDate: '2026-08-15' })
      .expect(201);
    expect(withActivity.activities).toHaveLength(1);
    expect(withActivity.activities[0].status).toBe('Not Started');
    expect(withActivity.activities[0].adkarOutcomes).toEqual(['desire']);

    const activityId = withActivity.activities[0].id;
    const { body: after } = await request(ctx.app)
      .patch(`/api/activities/${activityId}`)
      .send({ status: 'Completed' })
      .expect(200);
    expect(after.status).toBe('Completed');

    await request(ctx.app).post(`/api/blueprints/${overall.id}/activities`).send({ element: 'invalid' }).expect(400);
  });

  it('snapshots freeze state and stay immutable after edits', async () => {
    const { body: blueprints } = await request(ctx.app).get(`/api/projects/${projectId}/blueprints`).expect(200);
    const overall = blueprints[0];
    await request(ctx.app)
      .post(`/api/blueprints/${overall.id}/activities`)
      .send({ element: 'awareness', name: 'Original name' })
      .expect(201);
    const { body: snapshot } = await request(ctx.app)
      .post(`/api/blueprints/${overall.id}/snapshots`)
      .send({ label: 'v1' })
      .expect(201);
    expect(snapshot.payload.activities[0].name).toBe('Original name');

    const { body: current } = await request(ctx.app).get(`/api/blueprints/${overall.id}`).expect(200);
    await request(ctx.app)
      .patch(`/api/activities/${current.activities[0].id}`)
      .send({ name: 'Edited name' })
      .expect(200);

    const { body: snapshots } = await request(ctx.app).get(`/api/blueprints/${overall.id}/snapshots`).expect(200);
    expect(snapshots).toHaveLength(1);
    expect(snapshots[0].payload.activities[0].name).toBe('Original name');
  });
});

describe('plans', () => {
  it('adds extend plans and prevents deleting core plans', async () => {
    const { body: extend } = await request(ctx.app)
      .post(`/api/projects/${projectId}/plans`)
      .send({ kind: 'extend', name: 'Resistance Management Plan' })
      .expect(201);
    const { body: plans } = await request(ctx.app).get(`/api/projects/${projectId}/plans`).expect(200);
    expect(plans).toHaveLength(5);

    const core = plans.find((p: { kind: string }) => p.kind === 'core');
    await request(ctx.app).delete(`/api/plans/${core.id}`).expect(400);
    await request(ctx.app).delete(`/api/plans/${extend.id}`).expect(204);
  });

  it('tracks activity progress and validates enums and group ownership', async () => {
    const { body: plans } = await request(ctx.app).get(`/api/projects/${projectId}/plans`).expect(200);
    const comms = plans[0];
    await request(ctx.app)
      .post(`/api/plans/${comms.id}/activities`)
      .send({ name: 'Kickoff email', adkarOutcomes: ['awareness'], status: 'Completed' })
      .expect(201);
    const { body: after } = await request(ctx.app)
      .post(`/api/plans/${comms.id}/activities`)
      .send({ name: 'FAQ page', status: 'In Progress' })
      .expect(201);
    expect(after.computed.progress).toMatchObject({ total: 2, completed: 1, percentComplete: 50 });

    await request(ctx.app)
      .post(`/api/plans/${comms.id}/activities`)
      .send({ name: 'Bad', status: 'Done' })
      .expect(400);
    await request(ctx.app)
      .post(`/api/plans/${comms.id}/activities`)
      .send({ name: 'Bad', adkarOutcomes: ['motivation'] })
      .expect(400);

    // Group from another project is rejected.
    const { body: other } = await request(ctx.app).post('/api/projects').send({ name: 'Other' }).expect(201);
    const { body: foreignGroup } = await request(ctx.app)
      .post(`/api/projects/${other.id}/groups`)
      .send({ name: 'Foreign' })
      .expect(201);
    await request(ctx.app)
      .post(`/api/plans/${comms.id}/activities`)
      .send({ name: 'Bad', groupIds: [foreignGroup.id] })
      .expect(400);
  });
});
