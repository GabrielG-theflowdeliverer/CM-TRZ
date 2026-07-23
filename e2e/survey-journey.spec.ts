import { test, expect, type APIRequestContext } from '@playwright/test';

/**
 * The one flow that crosses the public boundary: a practitioner runs a survey
 * campaign, a role-holder submits it via their tokened link, and the roll-up
 * shows up back on the assessment. Project/assessment/role/campaign setup is
 * seeded via the API (standard for e2e); the browser drives the two surfaces
 * that actually face users — the respondent submit and the practitioner view.
 */

const PERSON = 'E2E Respondent';

async function seedCampaign(request: APIRequestContext) {
  const project = await (await request.post('/api/projects', { data: { name: 'E2E Journey' } })).json();
  const assessment = await (
    await request.post(`/api/projects/${project.id}/assessments`, { data: { type: 'sponsor_competency' } })
  ).json();
  const role = await (
    await request.post(`/api/projects/${project.id}/roles`, {
      data: { roster: 'sponsor_coalition', roleName: 'Sponsor', personName: PERSON },
    })
  ).json();
  const campaign = await (
    await request.post(`/api/projects/${project.id}/surveys`, {
      data: { assessmentId: assessment.id, roleIds: [role.id] },
    })
  ).json();
  return { projectId: project.id, assessmentId: assessment.id, token: campaign.recipients[0].token };
}

test('respondent submits via token and the roll-up appears on the assessment', async ({ page, request }) => {
  const { projectId, assessmentId, token } = await seedCampaign(request);

  // --- Respondent: open the chrome-less survey and submit it ---
  await page.goto(`/s/${token}`);
  await expect(page.getByRole('heading', { name: /Sponsor/i })).toBeVisible();

  // Pick "4" for every item (sponsor competency is a 1–5 scale, 20 items). Each
  // item is a radiogroup of five radios (values 1..5), so value 4 is index 3 —
  // a stable target (clicking mutates title/aria, so don't select on those).
  const groups = page.getByRole('radiogroup');
  const count = await groups.count();
  expect(count).toBe(20);
  for (let i = 0; i < count; i++) await groups.nth(i).getByRole('radio').nth(3).click();

  await page.getByRole('button', { name: 'Submit' }).click();
  await expect(page.getByText(`Thank you, ${PERSON}`)).toBeVisible();

  // --- Practitioner: the submission is reflected on the assessment run ---
  await page.goto(`/projects/${projectId}/assessments/${assessmentId}`);
  await expect(page.getByText('1/1 submitted')).toBeVisible();
  const recipientRow = page.getByRole('row', { name: new RegExp(PERSON) });
  await expect(recipientRow.getByText('Submitted')).toBeVisible();
});
