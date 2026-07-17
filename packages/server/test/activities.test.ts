import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createTestApp, type TestContext } from './harness.js';

let ctx: TestContext;
let projectId: string;
let groupA: string;
let groupB: string;
let commsPlanId: string;
let trainingPlanId: string;
let roleId: string;
let overallBlueprintId: string;

beforeEach(async () => {
  ctx = createTestApp();
  const { body: project } = await request(ctx.app).post('/api/projects').send({ name: 'P' }).expect(201);
  projectId = project.id;
  groupA = (await request(ctx.app).post(`/api/projects/${projectId}/groups`).send({ name: 'A' })).body.id;
  groupB = (await request(ctx.app).post(`/api/projects/${projectId}/groups`).send({ name: 'B' })).body.id;
  const { body: plans } = await request(ctx.app).get(`/api/projects/${projectId}/plans`).expect(200);
  commsPlanId = plans[0].id;
  trainingPlanId = plans[1].id;
  roleId = (
    await request(ctx.app).post(`/api/projects/${projectId}/roles`).send({ roster: 'core', roleName: 'Primary Sponsor' })
  ).body.id;
  const { body: blueprints } = await request(ctx.app).get(`/api/projects/${projectId}/blueprints`).expect(200);
  overallBlueprintId = blueprints[0].id;
});

describe('unified activities', () => {
  it('creates an activity with multi-links and reads it from every perspective', async () => {
    const { body: activity } = await request(ctx.app)
      .post(`/api/projects/${projectId}/activities`)
      .send({
        name: 'Townhall',
        adkarOutcomes: ['awareness', 'desire'],
        groupIds: [groupA, groupB],
        planIds: [commsPlanId, trainingPlanId],
        roleIds: [roleId],
        startDate: '2026-08-01',
        finishDate: '2026-08-05',
        status: 'In Progress',
      })
      .expect(201);
    expect(activity.adkarOutcomes.sort()).toEqual(['awareness', 'desire']);
    expect(activity.groupIds).toHaveLength(2);
    expect(activity.overall).toBe(false);

    // Visible under both plans...
    for (const planId of [commsPlanId, trainingPlanId]) {
      const { body: plan } = await request(ctx.app).get(`/api/plans/${planId}`).expect(200);
      expect(plan.activities.map((a: { id: string }) => a.id)).toContain(activity.id);
    }
    // ...and under each filter perspective.
    for (const filter of [
      `element=awareness`,
      `element=desire`,
      `groupId=${groupA}`,
      `groupId=${groupB}`,
      `roleId=${roleId}`,
      `status=In%20Progress`,
      `planId=${commsPlanId}`,
    ]) {
      const { body: list } = await request(ctx.app)
        .get(`/api/projects/${projectId}/activities?${filter}`)
        .expect(200);
      expect(list.map((a: { id: string }) => a.id)).toContain(activity.id);
    }
    // A DISTINCT result: never duplicated despite multiple links.
    const { body: all } = await request(ctx.app).get(`/api/projects/${projectId}/activities`).expect(200);
    expect(all.filter((a: { id: string }) => a.id === activity.id)).toHaveLength(1);
  });

  it('defaults to overall change when no groups are linked', async () => {
    const { body: activity } = await request(ctx.app)
      .post(`/api/projects/${projectId}/activities`)
      .send({ name: 'Global comms' })
      .expect(201);
    expect(activity.overall).toBe(true);
    const { body: overallOnly } = await request(ctx.app)
      .get(`/api/projects/${projectId}/activities?overall=true`)
      .expect(200);
    expect(overallOnly.map((a: { id: string }) => a.id)).toContain(activity.id);
  });

  it('updates links atomically and validates ownership', async () => {
    const { body: activity } = await request(ctx.app)
      .post(`/api/projects/${projectId}/activities`)
      .send({ name: 'X', groupIds: [groupA] })
      .expect(201);
    const { body: updated } = await request(ctx.app)
      .patch(`/api/activities/${activity.id}`)
      .send({ groupIds: [groupB], adkarOutcomes: ['knowledge'] })
      .expect(200);
    expect(updated.groupIds).toEqual([groupB]);
    expect(updated.adkarOutcomes).toEqual(['knowledge']);

    // Foreign project's entities are rejected.
    const { body: other } = await request(ctx.app).post('/api/projects').send({ name: 'Other' }).expect(201);
    const foreignGroup = (
      await request(ctx.app).post(`/api/projects/${other.id}/groups`).send({ name: 'F' })
    ).body.id;
    await request(ctx.app).patch(`/api/activities/${activity.id}`).send({ groupIds: [foreignGroup] }).expect(400);
    await request(ctx.app)
      .post(`/api/projects/${projectId}/activities`)
      .send({ name: 'Bad', adkarOutcomes: ['persuasion'] })
      .expect(400);
  });

  it('adding via a blueprint links element, blueprint and scope group', async () => {
    const { body: groupBlueprint } = await request(ctx.app)
      .post(`/api/projects/${projectId}/blueprints`)
      .send({ scopeKind: 'group', groupId: groupA, name: 'A Blueprint' })
      .expect(201);
    const { body: after } = await request(ctx.app)
      .post(`/api/blueprints/${groupBlueprint.id}/activities`)
      .send({ element: 'desire', name: 'WIIFM' })
      .expect(201);
    const activity = after.activities[0];
    expect(activity.adkarOutcomes).toEqual(['desire']);
    expect(activity.groupIds).toEqual([groupA]);
    expect(activity.blueprintIds).toEqual([groupBlueprint.id]);

    // Overall blueprint activities are flagged overall.
    const { body: overallAfter } = await request(ctx.app)
      .post(`/api/blueprints/${overallBlueprintId}/activities`)
      .send({ element: 'awareness', name: 'Announce' })
      .expect(201);
    expect(overallAfter.activities[0].overall).toBe(true);
  });

  it('deleting a linked group or plan detaches without deleting the activity', async () => {
    const { body: activity } = await request(ctx.app)
      .post(`/api/projects/${projectId}/activities`)
      .send({ name: 'X', groupIds: [groupA], planIds: [commsPlanId] })
      .expect(201);
    await request(ctx.app).delete(`/api/groups/${groupA}`).expect(204);
    const { body: after } = await request(ctx.app).get(`/api/activities/${activity.id}`).expect(200);
    expect(after.groupIds).toEqual([]);
    expect(after.planIds).toEqual([commsPlanId]);
  });

  it('plan progress counts each unified activity once', async () => {
    await request(ctx.app)
      .post(`/api/projects/${projectId}/activities`)
      .send({ name: 'Done', planIds: [commsPlanId], status: 'Completed' })
      .expect(201);
    await request(ctx.app)
      .post(`/api/plans/${commsPlanId}/activities`)
      .send({ name: 'Open', status: 'Not Started' })
      .expect(201);
    const { body: plan } = await request(ctx.app).get(`/api/plans/${commsPlanId}`).expect(200);
    expect(plan.computed.progress).toMatchObject({ total: 2, completed: 1, percentComplete: 50 });
  });
});
