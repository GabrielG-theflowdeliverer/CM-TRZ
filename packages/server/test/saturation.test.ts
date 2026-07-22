import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { GOLIVE_WEIGHT } from '@cmt/domain';
import { createTestApp, type TestContext } from './harness.js';

let ctx: TestContext;

beforeEach(() => {
  ctx = createTestApp();
});

/** Project with a roadmap window and one fully-impacting group. */
async function seedProject(name: string, dates: { kickoff: string; golive: string; outcomes: string }) {
  const { body: project } = await request(ctx.app).post('/api/projects').send({ name }).expect(201);
  await request(ctx.app)
    .put(`/api/projects/${project.id}/roadmap`)
    .send({ kickoffDate: dates.kickoff, goliveDate: dates.golive, outcomesDate: dates.outcomes })
    .expect(200);
  const { body: group } = await request(ctx.app)
    .post(`/api/projects/${project.id}/groups`)
    .send({ name: `${name} Sales` })
    .expect(201);
  // Degree of impact 4: two aspects at 4.
  await request(ctx.app)
    .put(`/api/groups/${group.id}/aspects`)
    .send([
      { aspectKey: 'processes', impact: 4 },
      { aspectKey: 'systems', impact: 4 },
    ])
    .expect(200);
  return { project, group };
}

describe('org groups', () => {
  it('creates, lists, links to a project group, and rejects unknown links', async () => {
    const { group } = await seedProject('A', { kickoff: '2026-07-01', golive: '2026-09-15', outcomes: '2026-12-01' });
    const { body: org } = await request(ctx.app).post('/api/org-groups').send({ name: 'Sales' }).expect(201);
    const { body: list } = await request(ctx.app).get('/api/org-groups').expect(200);
    expect(list).toHaveLength(1);

    const { body: linked } = await request(ctx.app)
      .patch(`/api/groups/${group.id}`)
      .send({ orgGroupId: org.id })
      .expect(200);
    expect(linked.orgGroupId).toBe(org.id);

    await request(ctx.app).patch(`/api/groups/${group.id}`).send({ orgGroupId: 'nope' }).expect(400);

    // Unlink.
    const { body: unlinked } = await request(ctx.app)
      .patch(`/api/groups/${group.id}`)
      .send({ orgGroupId: null })
      .expect(200);
    expect(unlinked.orgGroupId).toBeNull();
  });
});

describe('saturation heatmap', () => {
  it('sums overlapping projects per org group per month, with go-live weighting and contributions', async () => {
    const a = await seedProject('A', { kickoff: '2026-07-01', golive: '2026-09-15', outcomes: '2026-12-01' });
    const b = await seedProject('B', { kickoff: '2026-09-01', golive: '2026-10-10', outcomes: '2027-01-15' });
    const { body: org } = await request(ctx.app).post('/api/org-groups').send({ name: 'Sales' }).expect(201);
    await request(ctx.app).patch(`/api/groups/${a.group.id}`).send({ orgGroupId: org.id }).expect(200);
    await request(ctx.app).patch(`/api/groups/${b.group.id}`).send({ orgGroupId: org.id }).expect(200);

    const { body } = await request(ctx.app)
      .get('/api/dashboard/saturation?from=2026-06&to=2027-02')
      .expect(200);
    expect(body.months).toHaveLength(9);
    expect(body.unlinkedGroupCount).toBe(0);
    // The reduced project model ships for the client what-if, with raw
    // roadmap dates so the review dialog can show current -> proposed.
    expect(body.projects).toHaveLength(2);
    expect(body.projects[0]).toMatchObject({
      goliveMonth: '2026-09',
      startMonth: '2026-07',
      roadmap: { kickoffDate: '2026-07-01', goliveDate: '2026-09-15', outcomesDate: '2026-12-01' },
    });
    const row = body.rows.find((r: { orgGroupName: string }) => r.orgGroupName === 'Sales');
    const cell = (month: string) => row.cells[body.months.indexOf(month)];

    expect(cell('2026-06').score).toBe(0); // before either window
    expect(cell('2026-07').score).toBe(4); // A only, off-peak
    // September: A at go-live peak (4×1.5) + B at go-live-adjacent peak (4×1.5).
    expect(cell('2026-09').score).toBe(4 * GOLIVE_WEIGHT * 2);
    expect(cell('2026-09').band).toBe('overloaded');
    expect(cell('2026-09').contributions).toHaveLength(2);
    // December: A's last month (off-peak) + B off-peak.
    expect(cell('2026-12').score).toBe(8);
    expect(cell('2026-12').band).toBe('elevated');
    expect(cell('2027-02').score).toBe(0); // after both
  });

  it('counts unlinked groups, skips completed projects, and validates the range', async () => {
    const a = await seedProject('A', { kickoff: '2026-07-01', golive: '2026-09-15', outcomes: '2026-12-01' });
    await request(ctx.app).post('/api/org-groups').send({ name: 'Sales' }).expect(201);

    // Unlinked group → contributes nothing but is counted.
    const { body: before } = await request(ctx.app)
      .get('/api/dashboard/saturation?from=2026-07&to=2026-08')
      .expect(200);
    expect(before.unlinkedGroupCount).toBe(1);
    expect(before.rows[0].cells.every((c: { score: number }) => c.score === 0)).toBe(true);

    // Completed projects drop out entirely.
    await request(ctx.app).patch(`/api/projects/${a.project.id}`).send({ status: 'Completed' }).expect(200);
    const { body: after } = await request(ctx.app)
      .get('/api/dashboard/saturation?from=2026-07&to=2026-08')
      .expect(200);
    expect(after.unlinkedGroupCount).toBe(0);

    await request(ctx.app).get('/api/dashboard/saturation?from=bad&to=2026-08').expect(400);
    await request(ctx.app).get('/api/dashboard/saturation?from=2026-09&to=2026-08').expect(400);
    await request(ctx.app).get('/api/dashboard/saturation?from=2020-01&to=2026-01').expect(400); // > 24 months
  });
});
