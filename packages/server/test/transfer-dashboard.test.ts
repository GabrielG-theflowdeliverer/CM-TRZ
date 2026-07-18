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
  const { body: report } = await request(ctx.app)
    .post(`/api/projects/${projectId}/cm-perf-reports`)
    .send({ name: 'Status report', date: '2026-07-01' })
    .expect(201);
  await request(ctx.app).patch(`/api/cm-perf-items/${report.items[0].id}`).send({ status: 'On Target' }).expect(200);
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
      'activities',
      'activityPlans',
      'activityGroups',
      'blueprints',
      'trackingEntries',
      'cmPerfReports',
      'cmPerfItems',
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

  it('imports legacy v1 exports, unifying the old activity tables', async () => {
    const projectId = await buildRichProject('Legacy source');
    const { body: v2 } = await request(ctx.app).get(`/api/projects/${projectId}/export`).expect(200);
    const { body: blueprints } = await request(ctx.app).get(`/api/projects/${projectId}/blueprints`).expect(200);
    const overallBlueprint = blueprints[0];
    const { body: plans } = await request(ctx.app).get(`/api/projects/${projectId}/plans`).expect(200);

    // Hand-build a v1-shaped payload (pre-unification format).
    const v1 = {
      ...v2,
      version: 1,
      activities: undefined,
      activityAdkar: undefined,
      activityGroups: undefined,
      activityPlans: undefined,
      activityBlueprints: undefined,
      activityRoles: undefined,
      roadmapAdkarMilestones: [],
      blueprintActivities: [
        {
          id: 'v1-ba-1',
          blueprint_id: overallBlueprint.id,
          element: 'awareness',
          position: 0,
          name: 'Legacy blueprint activity',
          roles_required: 'Sponsor',
          start_date: '2026-01-01',
          finish_date: '2026-02-01',
          status: 'Completed',
        },
      ],
      planActivities: [
        {
          id: 'v1-pa-1',
          plan_id: plans[0].id,
          position: 0,
          name: 'Legacy plan activity',
          adkar_outcome: 'desire',
          group_id: v2.groups[0].id,
          method_mechanism: 'Email',
          roles_required: null,
          responsible: 'CP',
          start_date: null,
          finish_date: null,
          status: 'In Progress',
          result_feedback: null,
        },
      ],
    };
    const { body: imported } = await request(ctx.app).post('/api/import').send(v1).expect(201);
    const { body: acts } = await request(ctx.app).get(`/api/projects/${imported.id}/activities`).expect(200);
    const legacyBlueprintActivity = acts.find((a: { name: string }) => a.name === 'Legacy blueprint activity');
    const legacyPlanActivity = acts.find((a: { name: string }) => a.name === 'Legacy plan activity');
    expect(legacyBlueprintActivity.adkarOutcomes).toEqual(['awareness']);
    expect(legacyBlueprintActivity.overall).toBe(true);
    expect(legacyBlueprintActivity.blueprintIds).toHaveLength(1);
    expect(legacyPlanActivity.adkarOutcomes).toEqual(['desire']);
    expect(legacyPlanActivity.groupIds).toHaveLength(1);
    expect(legacyPlanActivity.planIds).toHaveLength(1);
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

  it('serves the per-project dashboard with histograms and watch list data', async () => {
    const projectId = await buildRichProject('Solo');
    const { body: d } = await request(ctx.app).get(`/api/projects/${projectId}/dashboard`).expect(200);
    expect(d.pct.scores.success).toBe(30);
    expect(d.risk.quadrant).toBe('High');
    expect(d.risk.subject).toBe('Overall Change');
    // One group with 2 aspects impacted (4 and 2 -> degree 3).
    expect(d.aspectsImpactedHistogram[1]).toBe(1); // bucket "2 aspects"
    expect(d.degreeOfImpactHistogram[2]).toBe(1); // bucket "3"
    expect(d.barrierCounts.Desire).toBe(1);
    expect(d.groups).toHaveLength(1);
    expect(d.groups[0]).toMatchObject({ name: 'Client Services', aspectsImpacted: 2, barrierPoint: 'Desire' });
    expect(d.latestCmPerf.worstStatus).toBe('On Target');

    // Watch list persists on the project (max 5 enforced by schema).
    await request(ctx.app)
      .patch(`/api/projects/${projectId}`)
      .send({ watchGroupIds: [d.groups[0].id] })
      .expect(200);
    const { body: project } = await request(ctx.app).get(`/api/projects/${projectId}`).expect(200);
    expect(project.watchGroupIds).toEqual([d.groups[0].id]);
  });

  it('excludes non-active projects from the portfolio dashboard', async () => {
    const projectId = await buildRichProject('Paused soon');
    await request(ctx.app).patch(`/api/projects/${projectId}`).send({ status: 'Paused / On Hold' }).expect(200);
    const { body } = await request(ctx.app).get('/api/dashboard').expect(200);
    expect(body.summary.totalProjects).toBe(0);
  });

  it('exports per-dataset and combined CSV', async () => {
    const projectId = await buildRichProject('CSV project');
    const groupsCsv = await request(ctx.app).get(`/api/projects/${projectId}/export/csv/groups`).expect(200);
    expect(groupsCsv.headers['content-type']).toContain('text/csv');
    expect(groupsCsv.text).toContain('Impacted Group');
    expect(groupsCsv.text).toContain('Client Services');
    const allCsv = await request(ctx.app).get(`/api/projects/${projectId}/export/csv`).expect(200);
    expect(allCsv.text).toContain('# GROUPS');
    expect(allCsv.text).toContain('# ASSESSMENTS');
    await request(ctx.app).get(`/api/projects/${projectId}/export/csv/bogus`).expect(404);
  });
});
