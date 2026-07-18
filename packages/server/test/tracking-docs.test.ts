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

describe('roadmap', () => {
  it('stores sequential and iterative dates', async () => {
    const { body } = await request(ctx.app)
      .put(`/api/projects/${projectId}/roadmap`)
      .send({
        mode: 'iterative',
        kickoffDate: '2026-08-01',
        goliveDate: '2026-10-01',
        releases: [{ releaseNo: 1, date: '2026-09-01' }],
        adkarMilestones: [
          { releaseNo: 0, element: 'awareness', date: '2026-08-10' },
          { releaseNo: 1, element: 'desire', date: '2026-09-05' },
        ],
      })
      .expect(200);
    expect(body.mode).toBe('iterative');
    expect(body.releases).toEqual([{ releaseNo: 1, date: '2026-09-01', name: null }]);
    expect(body.adkarMilestones).toHaveLength(2);
    expect(body.adkarMilestones.every((m: { groupId: string | null }) => m.groupId === null)).toBe(true);
    await request(ctx.app).put(`/api/projects/${projectId}/roadmap`).send({ kickoffDate: 'not-a-date' }).expect(400);
  });
});

describe('tracking schedules and CM performance', () => {
  it('creates entries in the three schedules with status validation', async () => {
    await request(ctx.app)
      .post(`/api/projects/${projectId}/tracking`)
      .send({ schedule: 'pct_check', scheduledDate: '2026-08-01', description: 'Q3 PCT check', status: 'Not Started' })
      .expect(201);
    await request(ctx.app)
      .post(`/api/projects/${projectId}/tracking`)
      .send({ schedule: 'made_up' })
      .expect(400);
    const { body: entries } = await request(ctx.app).get(`/api/projects/${projectId}/tracking`).expect(200);
    expect(entries).toHaveLength(1);

    const { body: updated } = await request(ctx.app)
      .patch(`/api/tracking/${entries[0].id}`)
      .send({ status: 'Completed', completedDate: '2026-08-02', results: 'All green' })
      .expect(200);
    expect(updated.status).toBe('Completed');
  });

  it('creates CM performance reports that auto-enumerate blueprints and plans', async () => {
    // Seeded project: 1 overall blueprint + 4 core plans -> 5 report items.
    const { body: report } = await request(ctx.app)
      .post(`/api/projects/${projectId}/cm-perf-reports`)
      .send({ name: 'Q3 report', date: '2026-08-01' })
      .expect(201);
    expect(report.items).toHaveLength(5);
    expect(report.items.filter((i: { kind: string }) => i.kind === 'blueprint')).toHaveLength(1);
    expect(report.items.map((i: { label: string }) => i.label)).toContain('Communications Plan');

    const item = report.items[0];
    const { body: after } = await request(ctx.app)
      .patch(`/api/cm-perf-items/${item.id}`)
      .send({ status: 'Behind Target', description: 'Awareness activities slipping' })
      .expect(200);
    expect(after.items[0].status).toBe('Behind Target');

    await request(ctx.app).patch(`/api/cm-perf-items/${item.id}`).send({ status: 'Kind of OK' }).expect(400);
    await request(ctx.app)
      .patch(`/api/cm-perf-reports/${report.id}`)
      .send({ status: 'Completed' })
      .expect(200);
    await request(ctx.app).delete(`/api/cm-perf-reports/${report.id}`).expect(204);
  });

  it('reconciles report items when blueprints/plans are added or removed after creation', async () => {
    const { body: report } = await request(ctx.app)
      .post(`/api/projects/${projectId}/cm-perf-reports`)
      .send({ name: 'Rolling report' })
      .expect(201);
    expect(report.items).toHaveLength(5);
    // Set a status so we can confirm reconciliation preserves it.
    const commsItem = report.items.find((i: { label: string }) => i.label === 'Communications Plan');
    await request(ctx.app).patch(`/api/cm-perf-items/${commsItem.id}`).send({ status: 'On Target' }).expect(200);

    // Add a new blueprint and a new extend plan — both should appear on re-read.
    await request(ctx.app)
      .post(`/api/projects/${projectId}/blueprints`)
      .send({ scopeKind: 'custom', name: 'Release 2 Blueprint' })
      .expect(201);
    const { body: extend } = await request(ctx.app)
      .post(`/api/projects/${projectId}/plans`)
      .send({ kind: 'extend', name: 'Resistance Management Plan' })
      .expect(201);

    const { body: refreshed } = await request(ctx.app).get(`/api/cm-perf-reports/${report.id}`).expect(200);
    expect(refreshed.items).toHaveLength(7);
    expect(refreshed.items.map((i: { label: string }) => i.label)).toContain('Release 2 Blueprint');
    expect(refreshed.items.map((i: { label: string }) => i.label)).toContain('Resistance Management Plan');
    // Existing status preserved through reconciliation.
    expect(refreshed.items.find((i: { label: string }) => i.label === 'Communications Plan').status).toBe('On Target');

    // Deleting the extend plan drops its row on next read.
    await request(ctx.app).delete(`/api/plans/${extend.id}`).expect(204);
    const { body: afterDelete } = await request(ctx.app).get(`/api/cm-perf-reports/${report.id}`).expect(200);
    expect(afterDelete.items.map((i: { label: string }) => i.label)).not.toContain('Resistance Management Plan');
    expect(afterDelete.items).toHaveLength(6);
  });

  it('manages adapt actions blocks', async () => {
    const { body: block } = await request(ctx.app)
      .post(`/api/projects/${projectId}/adapt-actions`)
      .send({ observations: 'Desire gap in Sales', implications: 'Adoption risk', actionSteps: 'Sponsor roadshow' })
      .expect(201);
    const { body: updated } = await request(ctx.app)
      .patch(`/api/adapt-actions/${block.id}`)
      .send({ notes: 'Review in two weeks' })
      .expect(200);
    expect(updated.observations).toBe('Desire gap in Sales');
    expect(updated.notes).toBe('Review in two weeks');
  });
});

describe('docs and resistance', () => {
  it('round-trips structured documents and rejects unknown fields', async () => {
    const { body: doc } = await request(ctx.app)
      .put(`/api/projects/${projectId}/docs/define_success`)
      .send({ project: 'New CRM', purpose: 'Retention', adoption_percentage: '80%' })
      .expect(200);
    expect(doc.project).toBe('New CRM');
    expect(doc.particulars).toBeNull();

    await request(ctx.app)
      .put(`/api/projects/${projectId}/docs/define_success`)
      .send({ bogus_field: 'x' })
      .expect(400);
    await request(ctx.app).get(`/api/projects/${projectId}/docs/nonexistent_doc`).expect(404);
  });

  it('manages resistance items linked to groups', async () => {
    const { body: group } = await request(ctx.app)
      .post(`/api/projects/${projectId}/groups`)
      .send({ name: 'Sales' })
      .expect(201);
    const { body: item } = await request(ctx.app)
      .post(`/api/projects/${projectId}/resistance`)
      .send({ groupId: group.id, anticipatedResistance: 'Fear of quota impact', specialTactics: 'Peer champions' })
      .expect(201);
    expect(item.groupId).toBe(group.id);

    // Deleting the group keeps the row but nulls the link.
    await request(ctx.app).delete(`/api/groups/${group.id}`).expect(204);
    const { body: items } = await request(ctx.app).get(`/api/projects/${projectId}/resistance`).expect(200);
    expect(items[0].groupId).toBeNull();
    expect(items[0].anticipatedResistance).toBe('Fear of quota impact');
  });
});
