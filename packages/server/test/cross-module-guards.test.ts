import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createTestApp, type TestContext } from './harness.js';

/**
 * Every surface that stores a `group_id` shares one rule — "the group must
 * belong to this project" (impact.guards.assertGroupInProject). Before it was
 * consolidated there were five separate implementations with two different
 * error messages, so these cases pin both the rejection and the wording: a
 * surface that quietly grew its own copy would show up here as a mismatch.
 */

let ctx: TestContext;
let projectId: string;
let foreignGroupId: string;

beforeEach(async () => {
  ctx = createTestApp();
  const { body: mine } = await request(ctx.app).post('/api/projects').send({ name: 'Mine' }).expect(201);
  projectId = mine.id;
  const { body: theirs } = await request(ctx.app).post('/api/projects').send({ name: 'Theirs' }).expect(201);
  const { body: group } = await request(ctx.app)
    .post(`/api/projects/${theirs.id}/groups`)
    .send({ name: 'Their Sales' })
    .expect(201);
  foreignGroupId = group.id;
});

const MESSAGE = 'groupId does not belong to this project';

describe('a group from another project is refused everywhere it can be referenced', () => {
  it('rejects it on a reinforcement action', async () => {
    const { body } = await request(ctx.app)
      .post(`/api/projects/${projectId}/reinforcement-actions`)
      .send({ groupId: foreignGroupId, mechanism: 'Recognition' })
      .expect(400);
    expect(body.error).toBe(MESSAGE);
  });

  it('rejects it on a resistance item', async () => {
    const { body } = await request(ctx.app)
      .post(`/api/projects/${projectId}/resistance`)
      .send({ groupId: foreignGroupId, anticipatedResistance: 'Pushback' })
      .expect(400);
    expect(body.error).toBe(MESSAGE);
  });

  it('rejects it on a group-scoped blueprint', async () => {
    const { body } = await request(ctx.app)
      .post(`/api/projects/${projectId}/blueprints`)
      .send({ scopeKind: 'group', groupId: foreignGroupId, name: 'Theirs' })
      .expect(400);
    expect(body.error).toBe(MESSAGE);
  });

  it('rejects it on a roadmap ADKAR milestone', async () => {
    const { body } = await request(ctx.app)
      .put(`/api/projects/${projectId}/roadmap`)
      .send({ adkarMilestones: [{ releaseNo: 0, element: 'awareness', date: '2026-01-01', groupId: foreignGroupId }] })
      .expect(400);
    expect(body.error).toBe(MESSAGE);
  });

  it('rejects it on an outcome metric', async () => {
    const { body: objective } = await request(ctx.app)
      .post(`/api/projects/${projectId}/objectives`)
      .send({ level: 'organization', statement: 'Grow revenue' })
      .expect(201);
    const { body } = await request(ctx.app)
      .post(`/api/objectives/${objective.id}/metrics`)
      .send({ kind: 'benefit', name: 'Adoption', groupId: foreignGroupId })
      .expect(400);
    expect(body.error).toBe(MESSAGE);
  });

  it('still accepts a group that does belong to the project', async () => {
    const { body: mineGroup } = await request(ctx.app)
      .post(`/api/projects/${projectId}/groups`)
      .send({ name: 'My Sales' })
      .expect(201);
    await request(ctx.app)
      .post(`/api/projects/${projectId}/reinforcement-actions`)
      .send({ groupId: mineGroup.id, mechanism: 'Recognition' })
      .expect(201);
  });
});

describe('survey campaigns refuse subjects from another project', () => {
  it('404s an assessment the project does not own', async () => {
    const { body: theirs } = await request(ctx.app).post('/api/projects').send({ name: 'Other' }).expect(201);
    const { body: assessment } = await request(ctx.app)
      .post(`/api/projects/${theirs.id}/assessments`)
      .send({ type: 'pct' })
      .expect(201);
    // A role of our own, so the campaign body validates and the assessment
    // guard — not the schema — is what rejects the request.
    const { body: myRole } = await request(ctx.app)
      .post(`/api/projects/${projectId}/roles`)
      .send({ roster: 'core', roleName: 'Sponsor', personName: 'B. Person' })
      .expect(201);
    await request(ctx.app)
      .post(`/api/projects/${projectId}/surveys`)
      .send({ assessmentId: assessment.id, roleIds: [myRole.id] })
      .expect(404);
  });

  it('400s a role the project does not own', async () => {
    const { body: assessment } = await request(ctx.app)
      .post(`/api/projects/${projectId}/assessments`)
      .send({ type: 'pct' })
      .expect(201);
    const { body: theirs } = await request(ctx.app).post('/api/projects').send({ name: 'Other' }).expect(201);
    const { body: role } = await request(ctx.app)
      .post(`/api/projects/${theirs.id}/roles`)
      .send({ roster: 'core', roleName: 'Sponsor', personName: 'A. Person' })
      .expect(201);
    const { body } = await request(ctx.app)
      .post(`/api/projects/${projectId}/surveys`)
      .send({ assessmentId: assessment.id, roleIds: [role.id] })
      .expect(400);
    expect(body.error).toBe(`Role ${role.id} is not in this project`);
  });
});
