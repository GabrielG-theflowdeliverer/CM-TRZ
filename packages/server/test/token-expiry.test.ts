import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createTestApp, type TestContext } from './harness.js';

let ctx: TestContext;
let projectId: string;

const past = () => new Date(Date.now() - 1000).toISOString();

beforeEach(async () => {
  ctx = createTestApp();
  const { body } = await request(ctx.app).post('/api/projects').send({ name: 'P' }).expect(201);
  projectId = body.id;
});

describe('survey link expiry', () => {
  async function makeSurveyToken(): Promise<string> {
    const { body: assessment } = await request(ctx.app)
      .post(`/api/projects/${projectId}/assessments`)
      .send({ type: 'sponsor_competency' })
      .expect(201);
    const { body: role } = await request(ctx.app)
      .post(`/api/projects/${projectId}/roles`)
      .send({ roster: 'sponsor_coalition', roleName: 'Sponsor', personName: 'J. Smith' })
      .expect(201);
    const { body: campaign } = await request(ctx.app)
      .post(`/api/projects/${projectId}/surveys`)
      .send({ assessmentId: assessment.id, roleIds: [role.id] })
      .expect(201);
    return campaign.recipients[0].token as string;
  }

  it('serves a fresh link and 410s it once the recipient link has expired', async () => {
    const token = await makeSurveyToken();
    // Fresh link gets a future expiry — still reachable.
    await request(ctx.app).get(`/api/survey/${token}`).expect(200);

    // Force the recipient's link past its expiry.
    ctx.db.prepare('UPDATE survey_recipients SET expires_at = ?').run(past());

    await request(ctx.app).get(`/api/survey/${token}`).expect(410);
    // Submitting an expired link is refused too.
    await request(ctx.app).put(`/api/survey/${token}`).send({ responses: {} }).expect(410);
  });

  it('regenerates a single expired link, leaving the others untouched', async () => {
    // Two recipients in one campaign.
    const { body: assessment } = await request(ctx.app)
      .post(`/api/projects/${projectId}/assessments`)
      .send({ type: 'sponsor_competency' })
      .expect(201);
    const roleIds: string[] = [];
    for (const person of ['A. One', 'B. Two']) {
      const { body: role } = await request(ctx.app)
        .post(`/api/projects/${projectId}/roles`)
        .send({ roster: 'sponsor_coalition', roleName: 'Sponsor', personName: person })
        .expect(201);
      roleIds.push(role.id);
    }
    const { body: campaign } = await request(ctx.app)
      .post(`/api/projects/${projectId}/surveys`)
      .send({ assessmentId: assessment.id, roleIds })
      .expect(201);
    const [first, second] = campaign.recipients as Array<{ id: string; token: string }>;

    // Expire only the first recipient's link.
    ctx.db.prepare('UPDATE survey_recipients SET expires_at = ? WHERE id = ?').run(past(), first!.id);
    await request(ctx.app).get(`/api/survey/${first!.token}`).expect(410);
    await request(ctx.app).get(`/api/survey/${second!.token}`).expect(200); // untouched

    // Regenerate just the first: new token works, the old one is gone.
    const { body: reissued } = await request(ctx.app)
      .post(`/api/survey-recipients/${first!.id}/regenerate`)
      .expect(200);
    expect(reissued.token).not.toBe(first!.token);
    await request(ctx.app).get(`/api/survey/${reissued.token}`).expect(200);
    await request(ctx.app).get(`/api/survey/${first!.token}`).expect(404);
    // The second recipient's original link still works.
    await request(ctx.app).get(`/api/survey/${second!.token}`).expect(200);
  });

  it('404s regenerating an unknown recipient', async () => {
    await request(ctx.app).post('/api/survey-recipients/nope/regenerate').expect(404);
  });
});

describe('share link expiry', () => {
  async function makeShareToken(): Promise<string> {
    const { body } = await request(ctx.app).post(`/api/projects/${projectId}/share`).expect(201);
    return body.token as string;
  }

  it('serves a fresh link and treats an expired one as not found (404)', async () => {
    const token = await makeShareToken();
    await request(ctx.app).get(`/api/share/${token}`).expect(200);
    await request(ctx.app).get(`/api/share/${token}/projects/${projectId}/dashboard`).expect(200);

    ctx.db.prepare('UPDATE projects SET share_token_expires_at = ?').run(past());

    // Expired is indistinguishable from unknown/revoked — a plain 404.
    await request(ctx.app).get(`/api/share/${token}`).expect(404);
    await request(ctx.app).get(`/api/share/${token}/projects/${projectId}/dashboard`).expect(404);
  });
});
