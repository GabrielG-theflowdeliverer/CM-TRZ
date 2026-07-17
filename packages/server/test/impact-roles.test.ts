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

describe('impacted groups', () => {
  it('creates groups and computes aspects impacted / degree of impact', async () => {
    const { body: group } = await request(ctx.app)
      .post(`/api/projects/${projectId}/groups`)
      .send({ name: 'Client Services', numPeople: 40 })
      .expect(201);
    expect(group.aspects).toHaveLength(10); // all ten aspects always presented
    expect(group.computed.degreeOfImpact).toBeNull();

    const { body: updated } = await request(ctx.app)
      .put(`/api/groups/${group.id}/aspects`)
      .send([
        { aspectKey: 'processes', impact: 5 },
        { aspectKey: 'systems', impact: 3 },
        { aspectKey: 'tools', impact: 0 },
      ])
      .expect(200);
    expect(updated.computed.aspectsImpacted).toBe(2);
    expect(updated.computed.degreeOfImpact).toBe(4);
  });

  it('rejects invalid aspect payloads', async () => {
    const { body: group } = await request(ctx.app)
      .post(`/api/projects/${projectId}/groups`)
      .send({ name: 'G' })
      .expect(201);
    await request(ctx.app)
      .put(`/api/groups/${group.id}/aspects`)
      .send([{ aspectKey: 'processes', impact: 6 }])
      .expect(400);
    await request(ctx.app)
      .put(`/api/groups/${group.id}/aspects`)
      .send([{ aspectKey: 'bogus', impact: 1 }])
      .expect(400);
  });

  it('manages group ADKAR through the assessments engine with barrier point', async () => {
    const { body: group } = await request(ctx.app)
      .post(`/api/projects/${projectId}/groups`)
      .send({ name: 'G' })
      .expect(201);
    const { body: after } = await request(ctx.app)
      .put(`/api/groups/${group.id}/adkar`)
      .send({ 'adkar.awareness': 4, 'adkar.desire': 2 })
      .expect(200);
    expect(after.computed.barrierPoint).toBe('Desire');
    expect(after.adkarAssessmentId).toBeTruthy();

    // The run is visible in the assessment engine (history).
    const { body: runs } = await request(ctx.app)
      .get(`/api/projects/${projectId}/assessments?type=adkar&subjectKind=group&subjectId=${group.id}`)
      .expect(200);
    expect(runs).toHaveLength(1);
  });

  it('deleting a group cleans its ADKAR runs and nulls references', async () => {
    const { body: group } = await request(ctx.app)
      .post(`/api/projects/${projectId}/groups`)
      .send({ name: 'Doomed' })
      .expect(201);
    await request(ctx.app).put(`/api/groups/${group.id}/adkar`).send({ 'adkar.awareness': 3 }).expect(200);

    const { body: plans } = await request(ctx.app).get(`/api/projects/${projectId}/plans`).expect(200);
    const { body: planAfterAdd } = await request(ctx.app)
      .post(`/api/plans/${plans[0].id}/activities`)
      .send({ name: 'Townhall', groupIds: [group.id] })
      .expect(201);
    expect(planAfterAdd.activities[0].groupIds).toEqual([group.id]);

    await request(ctx.app).delete(`/api/groups/${group.id}`).expect(204);

    const { body: runs } = await request(ctx.app)
      .get(`/api/projects/${projectId}/assessments?type=adkar`)
      .expect(200);
    expect(runs).toHaveLength(0);
    const { body: planAfterDelete } = await request(ctx.app).get(`/api/plans/${plans[0].id}`).expect(200);
    expect(planAfterDelete.activities[0].groupIds).toEqual([]);
  });
});

describe('roles', () => {
  it('creates roster roles with group links and ADKAR barrier', async () => {
    const { body: group } = await request(ctx.app)
      .post(`/api/projects/${projectId}/groups`)
      .send({ name: 'Sales' })
      .expect(201);
    const { body: role } = await request(ctx.app)
      .post(`/api/projects/${projectId}/roles`)
      .send({ roster: 'core', roleName: 'Primary Sponsor', personName: 'JS', support: 'Supportive', influence: 'High', groupIds: [group.id] })
      .expect(201);
    expect(role.groupIds).toEqual([group.id]);

    const { body: withAdkar } = await request(ctx.app)
      .put(`/api/roles/${role.id}/adkar`)
      .send({ 'adkar.awareness': 5, 'adkar.desire': 5, 'adkar.knowledge': 3 })
      .expect(200);
    expect(withAdkar.computed.barrierPoint).toBe('Knowledge');
  });

  it('rejects invalid roster and enum values', async () => {
    await request(ctx.app).post(`/api/projects/${projectId}/roles`).send({ roster: 'imaginary' }).expect(400);
    await request(ctx.app)
      .post(`/api/projects/${projectId}/roles`)
      .send({ roster: 'core', support: 'Hostile' })
      .expect(400);
  });

  it('deleting a role removes its ADKAR runs', async () => {
    const { body: role } = await request(ctx.app)
      .post(`/api/projects/${projectId}/roles`)
      .send({ roster: 'extend', roleName: 'Influencer' })
      .expect(201);
    await request(ctx.app).put(`/api/roles/${role.id}/adkar`).send({ 'adkar.awareness': 2 }).expect(200);
    await request(ctx.app).delete(`/api/roles/${role.id}`).expect(204);
    const { body: runs } = await request(ctx.app)
      .get(`/api/projects/${projectId}/assessments?type=adkar`)
      .expect(200);
    expect(runs).toHaveLength(0);
  });
});
