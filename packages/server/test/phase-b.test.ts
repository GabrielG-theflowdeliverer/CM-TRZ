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

describe('roadmap-driven PCT scheduling (M4)', () => {
  it('creates the three named PCT runs from roadmap key dates, idempotently', async () => {
    await request(ctx.app)
      .put(`/api/projects/${projectId}/roadmap`)
      .send({ kickoffDate: '2026-08-01', goliveDate: '2026-10-01' })
      .expect(200);
    let { body: runs } = await request(ctx.app).get(`/api/projects/${projectId}/assessments?type=pct`).expect(200);
    expect(runs.map((r: { label: string }) => r.label).sort()).toEqual([
      'Go Live/Launch Assessment',
      'Project Kickoff Assessment',
    ]);
    expect(runs.every((r: { status: string }) => r.status === 'Not Started')).toBe(true);

    // Re-saving with a moved date updates (not duplicates) the run.
    await request(ctx.app)
      .put(`/api/projects/${projectId}/roadmap`)
      .send({ kickoffDate: '2026-08-15', outcomesDate: '2026-12-01' })
      .expect(200);
    ({ body: runs } = await request(ctx.app).get(`/api/projects/${projectId}/assessments?type=pct`).expect(200));
    expect(runs).toHaveLength(3);
    const kickoff = runs.find((r: { label: string }) => r.label === 'Project Kickoff Assessment');
    expect(kickoff.scheduledDate).toBe('2026-08-15');
  });

  it('never touches a completed run', async () => {
    await request(ctx.app).put(`/api/projects/${projectId}/roadmap`).send({ kickoffDate: '2026-08-01' }).expect(200);
    const { body: runs } = await request(ctx.app).get(`/api/projects/${projectId}/assessments?type=pct`).expect(200);
    await request(ctx.app)
      .patch(`/api/assessments/${runs[0].id}`)
      .send({ status: 'Completed', completedDate: '2026-08-02' })
      .expect(200);
    await request(ctx.app).put(`/api/projects/${projectId}/roadmap`).send({ kickoffDate: '2026-09-09' }).expect(200);
    const { body: after } = await request(ctx.app).get(`/api/assessments/${runs[0].id}`).expect(200);
    expect(after.scheduledDate).toBe('2026-08-01');
  });
});

describe('group-scoped risk assessments (C3)', () => {
  it('runs a full risk assessment against a group and surfaces it on the group DTO', async () => {
    const { body: group } = await request(ctx.app)
      .post(`/api/projects/${projectId}/groups`)
      .send({ name: 'Sales' })
      .expect(201);
    const { body: run } = await request(ctx.app)
      .post(`/api/projects/${projectId}/assessments`)
      .send({ type: 'risk', subjectKind: 'group', subjectId: group.id })
      .expect(201);
    const responses: Record<string, number> = {};
    for (const key of RISK_ITEM_KEYS) responses[key] = key.startsWith('risk.cc') ? 5 : 4;
    const { body: scored } = await request(ctx.app)
      .put(`/api/assessments/${run.id}/responses`)
      .send(responses)
      .expect(200);
    expect(scored.computed.risk).toEqual({ cc: 70, oa: 56, quadrant: 'High' });

    const { body: groupAfter } = await request(ctx.app).get(`/api/groups/${group.id}`).expect(200);
    expect(groupAfter.computed.risk).toEqual({ assessmentId: run.id, cc: 70, oa: 56, quadrant: 'High' });

    // Project-level risk stays independent of group risk.
    const { body: projectRuns } = await request(ctx.app)
      .get(`/api/projects/${projectId}/assessments?type=risk&subjectKind=project`)
      .expect(200);
    expect(projectRuns).toHaveLength(0);
  });
});

describe('roadmap group milestones + named releases (C4)', () => {
  it('stores per-group ADKAR milestones and named releases', async () => {
    const { body: group } = await request(ctx.app)
      .post(`/api/projects/${projectId}/groups`)
      .send({ name: 'Sales' })
      .expect(201);
    const { body: roadmap } = await request(ctx.app)
      .put(`/api/projects/${projectId}/roadmap`)
      .send({
        releases: [{ releaseNo: 1, name: 'MVP', date: '2026-09-01' }],
        adkarMilestones: [
          { releaseNo: 0, element: 'awareness', date: '2026-08-01' },
          { releaseNo: 0, element: 'awareness', date: '2026-08-20', groupId: group.id },
        ],
      })
      .expect(200);
    expect(roadmap.releases[0]).toEqual({ releaseNo: 1, name: 'MVP', date: '2026-09-01' });
    expect(roadmap.adkarMilestones).toHaveLength(2);
    await request(ctx.app)
      .put(`/api/projects/${projectId}/roadmap`)
      .send({ adkarMilestones: [{ releaseNo: 0, element: 'awareness', date: '2026-01-01', groupId: 'bogus' }] })
      .expect(400);
  });

  it('group blueprints prefer the group milestone over the overall default', async () => {
    const { body: group } = await request(ctx.app)
      .post(`/api/projects/${projectId}/groups`)
      .send({ name: 'Sales' })
      .expect(201);
    await request(ctx.app)
      .put(`/api/projects/${projectId}/roadmap`)
      .send({
        adkarMilestones: [
          { releaseNo: 0, element: 'awareness', date: '2026-08-01' },
          { releaseNo: 0, element: 'awareness', date: '2026-08-20', groupId: group.id },
          { releaseNo: 0, element: 'desire', date: '2026-09-01' },
        ],
      })
      .expect(200);
    const { body: groupBlueprint } = await request(ctx.app)
      .post(`/api/projects/${projectId}/blueprints`)
      .send({ scopeKind: 'group', groupId: group.id, name: 'Sales BP' })
      .expect(201);
    // Group milestone wins for awareness; overall fallback used for desire.
    expect(groupBlueprint.computed.milestones.awareness).toEqual({ effectiveDate: '2026-08-20', fromRoadmap: true });
    expect(groupBlueprint.computed.milestones.desire).toEqual({ effectiveDate: '2026-09-01', fromRoadmap: true });

    const { body: blueprints } = await request(ctx.app).get(`/api/projects/${projectId}/blueprints`).expect(200);
    const overall = blueprints.find((b: { scopeKind: string }) => b.scopeKind === 'overall');
    expect(overall.computed.milestones.awareness).toEqual({ effectiveDate: '2026-08-01', fromRoadmap: true });
  });
});

describe('ADKAR runs incl. Overall Change (C2)', () => {
  it('supports named overall-change ADKAR runs alongside per-group history', async () => {
    const { body: overallRun } = await request(ctx.app)
      .post(`/api/projects/${projectId}/assessments`)
      .send({ type: 'adkar', subjectKind: 'project', label: 'Initial assessment', scheduledDate: '2026-08-01' })
      .expect(201);
    const { body: scored } = await request(ctx.app)
      .put(`/api/assessments/${overallRun.id}/responses`)
      .send({ 'adkar.awareness': 4, 'adkar.desire': 2 })
      .expect(200);
    expect(scored.computed.adkar.barrierPoint).toBe('Desire');

    const { body: group } = await request(ctx.app)
      .post(`/api/projects/${projectId}/groups`)
      .send({ name: 'Sales' })
      .expect(201);
    await request(ctx.app).put(`/api/groups/${group.id}/adkar`).send({ 'adkar.awareness': 5 }).expect(200);
    await request(ctx.app)
      .post(`/api/projects/${projectId}/assessments`)
      .send({ type: 'adkar', subjectKind: 'group', subjectId: group.id, label: 'Follow-up', copyFromLatest: true })
      .expect(201);

    const { body: all } = await request(ctx.app).get(`/api/projects/${projectId}/assessments?type=adkar`).expect(200);
    expect(all).toHaveLength(3);
    const groupRuns = all.filter((r: { subjectId: string | null }) => r.subjectId === group.id);
    expect(groupRuns).toHaveLength(2);
    // copyFromLatest pre-filled the follow-up from the inline run.
    expect(groupRuns.find((r: { label: string }) => r.label === 'Follow-up').responses['adkar.awareness']).toBe(5);
  });
});
