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

  it('tracks CM performance with the five-level status vocabulary', async () => {
    const { body: entry } = await request(ctx.app)
      .post(`/api/projects/${projectId}/cm-perf`)
      .send({ type: 'ADKAR Blueprint', description: 'Overall', status: 'Behind Target' })
      .expect(201);
    expect(entry.status).toBe('Behind Target');
    await request(ctx.app)
      .post(`/api/projects/${projectId}/cm-perf`)
      .send({ status: 'Kind of OK' })
      .expect(400);
    await request(ctx.app).delete(`/api/cm-perf/${entry.id}`).expect(204);
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
