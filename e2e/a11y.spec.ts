import { test, expect, type APIRequestContext, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * WCAG baseline: axe-core against the two surfaces that actually face users —
 * the public respondent survey page and a representative practitioner page.
 * We gate on critical/serious impact (the baseline); moderate/minor findings
 * are surfaced but not failed, to keep this a floor rather than a moving target.
 */

async function seedToken(request: APIRequestContext): Promise<string> {
  const project = await (await request.post('/api/projects', { data: { name: 'A11y' } })).json();
  const assessment = await (
    await request.post(`/api/projects/${project.id}/assessments`, { data: { type: 'sponsor_competency' } })
  ).json();
  const role = await (
    await request.post(`/api/projects/${project.id}/roles`, {
      data: { roster: 'sponsor_coalition', roleName: 'Sponsor', personName: 'A11y Person' },
    })
  ).json();
  const campaign = await (
    await request.post(`/api/projects/${project.id}/surveys`, {
      data: { assessmentId: assessment.id, roleIds: [role.id] },
    })
  ).json();
  return campaign.recipients[0].token;
}

async function expectNoSeriousViolations(page: Page) {
  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  const serious = violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');
  const summary = serious
    .map((v) => `${v.impact}: ${v.id} — ${v.help}\n    ${v.nodes.map((n) => n.target.join(' ')).join('\n    ')}`)
    .join('\n');
  expect(serious, `Serious/critical a11y violations:\n${summary}`).toEqual([]);
}

test('respondent survey page has no serious a11y violations', async ({ page, request }) => {
  const token = await seedToken(request);
  await page.goto(`/s/${token}`);
  await expect(page.getByRole('button', { name: 'Submit' })).toBeVisible();
  await expectNoSeriousViolations(page);
});

test('practitioner home page has no serious a11y violations', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Change Management Tool' })).toBeVisible();
  await expectNoSeriousViolations(page);
});
