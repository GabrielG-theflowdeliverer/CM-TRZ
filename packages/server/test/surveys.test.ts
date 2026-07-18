import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createTestApp, type TestContext } from './harness.js';

let ctx: TestContext;
let projectId: string;
let assessmentId: string;

async function addRole(pid: string, personName: string | null): Promise<string> {
  const { body } = await request(ctx.app)
    .post(`/api/projects/${pid}/roles`)
    .send({ roster: 'sponsor_coalition', roleName: 'Primary Sponsor', personName })
    .expect(201);
  return body.id;
}

beforeEach(async () => {
  ctx = createTestApp();
  const { body: project } = await request(ctx.app).post('/api/projects').send({ name: 'P' }).expect(201);
  projectId = project.id;
  const { body: assessment } = await request(ctx.app)
    .post(`/api/projects/${projectId}/assessments`)
    .send({ type: 'sponsor_competency' })
    .expect(201);
  assessmentId = assessment.id;
});

describe('survey campaigns', () => {
  it('creates a campaign with a tokened recipient per named role-holder', async () => {
    const roleA = await addRole(projectId, 'J. Smith');
    const roleB = await addRole(projectId, 'A. Lee');

    const { body: campaign } = await request(ctx.app)
      .post(`/api/projects/${projectId}/surveys`)
      .send({ assessmentId, roleIds: [roleA, roleB] })
      .expect(201);

    expect(campaign.assessmentId).toBe(assessmentId);
    expect(campaign.recipients).toHaveLength(2);
    const smith = campaign.recipients.find((r: { personName: string }) => r.personName === 'J. Smith');
    expect(smith.token).toEqual(expect.any(String));
    expect(smith.token.length).toBeGreaterThan(20);
    expect(smith.submittedAt).toBeNull();
    // Tokens are distinct per recipient.
    const tokens = new Set(campaign.recipients.map((r: { token: string }) => r.token));
    expect(tokens.size).toBe(2);
  });

  it('rejects a role with no named person (recipients must be identifiable)', async () => {
    const emptyRole = await addRole(projectId, null);
    const { body } = await request(ctx.app)
      .post(`/api/projects/${projectId}/surveys`)
      .send({ assessmentId, roleIds: [emptyRole] })
      .expect(400);
    expect(body.error).toMatch(/no named person/i);
  });

  it('rejects a role that belongs to another project', async () => {
    const { body: other } = await request(ctx.app).post('/api/projects').send({ name: 'Other' }).expect(201);
    const foreignRole = await addRole(other.id, 'Outsider');
    await request(ctx.app)
      .post(`/api/projects/${projectId}/surveys`)
      .send({ assessmentId, roleIds: [foreignRole] })
      .expect(400);
  });

  it('404s when the assessment is not in the project', async () => {
    const role = await addRole(projectId, 'J. Smith');
    const { body: other } = await request(ctx.app).post('/api/projects').send({ name: 'Other' }).expect(201);
    const { body: foreignAssessment } = await request(ctx.app)
      .post(`/api/projects/${other.id}/assessments`)
      .send({ type: 'sponsor_competency' })
      .expect(201);
    await request(ctx.app)
      .post(`/api/projects/${projectId}/surveys`)
      .send({ assessmentId: foreignAssessment.id, roleIds: [role] })
      .expect(404);
  });

  it('lists campaigns with response progress and fetches one by id', async () => {
    const role = await addRole(projectId, 'J. Smith');
    const { body: created } = await request(ctx.app)
      .post(`/api/projects/${projectId}/surveys`)
      .send({ assessmentId, roleIds: [role] })
      .expect(201);

    const { body: list } = await request(ctx.app).get(`/api/projects/${projectId}/surveys`).expect(200);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ id: created.id, recipientCount: 1, submittedCount: 0 });

    const { body: fetched } = await request(ctx.app).get(`/api/surveys/${created.id}`).expect(200);
    expect(fetched.recipients).toHaveLength(1);
  });

  it('preserves a submitted survey when the role is later removed (person snapshot, role SET NULL)', async () => {
    const role = await addRole(projectId, 'J. Smith');
    const { body: campaign } = await request(ctx.app)
      .post(`/api/projects/${projectId}/surveys`)
      .send({ assessmentId, roleIds: [role] })
      .expect(201);

    await request(ctx.app).delete(`/api/roles/${role}`).expect(204);

    const { body: fetched } = await request(ctx.app).get(`/api/surveys/${campaign.id}`).expect(200);
    expect(fetched.recipients).toHaveLength(1);
    expect(fetched.recipients[0].personName).toBe('J. Smith'); // snapshot survived
    expect(fetched.recipients[0].roleId).toBeNull(); // link cleared, data kept
  });
});
