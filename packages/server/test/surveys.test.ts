import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { SPONSOR_COMPETENCY_ITEM_KEYS } from '@cmt/domain';
import { createTestApp, type TestContext } from './harness.js';

/** A complete, valid sponsor-competency response set at a uniform score (1..5). */
function answers(value: number): Record<string, number> {
  return Object.fromEntries(SPONSOR_COMPETENCY_ITEM_KEYS.map((k) => [k, value]));
}
const fullResponses = () => answers(4);

async function campaignWithToken(pid: string, aid: string): Promise<string> {
  const { body: role } = await request(ctx.app)
    .post(`/api/projects/${pid}/roles`)
    .send({ roster: 'sponsor_coalition', roleName: 'Sponsor', personName: 'J. Smith' })
    .expect(201);
  const { body: campaign } = await request(ctx.app)
    .post(`/api/projects/${pid}/surveys`)
    .send({ assessmentId: aid, roleIds: [role.id] })
    .expect(201);
  return campaign.recipients[0].token;
}

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

  it('rejects a second campaign for the same assessment (one per assessment)', async () => {
    const role = await addRole(projectId, 'J. Smith');
    await request(ctx.app)
      .post(`/api/projects/${projectId}/surveys`)
      .send({ assessmentId, roleIds: [role] })
      .expect(201);
    const { body } = await request(ctx.app)
      .post(`/api/projects/${projectId}/surveys`)
      .send({ assessmentId, roleIds: [role] })
      .expect(409);
    expect(body.error).toMatch(/already exists/i);
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

describe('public survey capture (/api/survey/:token)', () => {
  it('serves the blank survey by token, exposing only the respondent view', async () => {
    const token = await campaignWithToken(projectId, assessmentId);
    const { body } = await request(ctx.app).get(`/api/survey/${token}`).expect(200);
    expect(body).toEqual({
      personName: 'J. Smith',
      assessmentType: 'sponsor_competency',
      assessmentLabel: null,
      submitted: false,
      responses: {},
    });
    // No project/campaign internals leak into the respondent view.
    expect(body).not.toHaveProperty('projectId');
    expect(body).not.toHaveProperty('campaignId');
  });

  it('accepts a submission, then reports it submitted with read-only responses', async () => {
    const token = await campaignWithToken(projectId, assessmentId);
    const { body: after } = await request(ctx.app)
      .put(`/api/survey/${token}`)
      .send(fullResponses())
      .expect(200);
    expect(after.submitted).toBe(true);

    const { body: refetch } = await request(ctx.app).get(`/api/survey/${token}`).expect(200);
    expect(refetch.submitted).toBe(true);
    expect(refetch.responses[SPONSOR_COMPETENCY_ITEM_KEYS[0]!]).toBe(4);

    // The practitioner sees the progress tick up.
    const { body: list } = await request(ctx.app).get(`/api/projects/${projectId}/surveys`).expect(200);
    expect(list[0].submittedCount).toBe(1);
  });

  it('refuses a second submission (submit-once)', async () => {
    const token = await campaignWithToken(projectId, assessmentId);
    await request(ctx.app).put(`/api/survey/${token}`).send(fullResponses()).expect(200);
    const { body } = await request(ctx.app).put(`/api/survey/${token}`).send(fullResponses()).expect(409);
    expect(body.error).toMatch(/already been submitted/i);
  });

  it('validates responses against the assessment type', async () => {
    const token = await campaignWithToken(projectId, assessmentId);
    await request(ctx.app)
      .put(`/api/survey/${token}`)
      .send({ [SPONSOR_COMPETENCY_ITEM_KEYS[0]!]: 9 }) // out of 1..5 range
      .expect(400);
    await request(ctx.app).put(`/api/survey/${token}`).send({ 'bogus.key': 3 }).expect(400);
  });

  it('404s an unknown token on both read and submit without leaking existence', async () => {
    await request(ctx.app).get('/api/survey/not-a-real-token').expect(404);
    await request(ctx.app).put('/api/survey/not-a-real-token').send(fullResponses()).expect(404);
  });
});

describe('assessment survey roll-up', () => {
  const KEY0 = SPONSOR_COMPETENCY_ITEM_KEYS[0]!;
  const LEN = SPONSOR_COMPETENCY_ITEM_KEYS.length;

  it("aggregates submissions into the assessment's score and supersedes hand-entered responses, keeping notes", async () => {
    const roleA = await addRole(projectId, 'J. Smith');
    const roleB = await addRole(projectId, 'A. Lee');

    // Practitioner hand-enters responses and a note beforehand.
    await request(ctx.app).patch(`/api/assessments/${assessmentId}`).send({ notes: 'keep me' }).expect(200);
    await request(ctx.app).put(`/api/assessments/${assessmentId}/responses`).send(answers(1)).expect(200);

    const { body: campaign } = await request(ctx.app)
      .post(`/api/projects/${projectId}/surveys`)
      .send({ assessmentId, roleIds: [roleA, roleB] })
      .expect(201);
    const tokenOf = (name: string) =>
      campaign.recipients.find((r: { personName: string }) => r.personName === name).token;

    await request(ctx.app).put(`/api/survey/${tokenOf('J. Smith')}`).send(answers(4)).expect(200);
    await request(ctx.app).put(`/api/survey/${tokenOf('A. Lee')}`).send(answers(2)).expect(200);

    const { body: a } = await request(ctx.app).get(`/api/assessments/${assessmentId}`).expect(200);

    // Aggregate mean (3) replaces the hand-entered 1s...
    expect(a.responses[KEY0]).toBe(3);
    expect(a.computed.competency.total).toBe(3 * LEN);
    // ...but the note is untouched.
    expect(a.notes).toBe('keep me');
    // Each respondent's own answers + computed score are attached.
    expect(a.survey.respondentCount).toBe(2);
    const smith = a.survey.individuals.find((i: { personName: string }) => i.personName === 'J. Smith');
    const lee = a.survey.individuals.find((i: { personName: string }) => i.personName === 'A. Lee');
    expect(smith.computed.competency.total).toBe(4 * LEN);
    expect(smith.responses[KEY0]).toBe(4);
    expect(lee.responses[KEY0]).toBe(2);
  });

  it('falls back to hand-entered responses when nobody has submitted yet', async () => {
    await request(ctx.app).put(`/api/assessments/${assessmentId}/responses`).send(answers(5)).expect(200);
    const { body: a } = await request(ctx.app).get(`/api/assessments/${assessmentId}`).expect(200);
    expect(a.computed.competency.total).toBe(5 * LEN);
    expect(a.survey).toBeUndefined();
  });
});
