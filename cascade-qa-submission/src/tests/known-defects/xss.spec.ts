import { test, expect } from '@playwright/test';
import { StudioPage } from 'pages/StudioPage';
import { LabApi, freshKey } from 'utils/api';
import data from 'utils/TestData.json' assert { type: 'json' };

const { prompts } = data;

/**
 * CATEGORY: Security — KNOWN DEFECT F4 (not a release gate)
 *
 * Contract (implicit but non-negotiable for a multi-tenant SaaS): customer-supplied
 * content must be rendered as text, never executed as markup.
 *
 * Why automated: stored XSS is the highest-leverage web vulnerability, and escaping is
 * exactly the kind of thing a well-meaning refactor silently removes. A regression test
 * that renders a payload and asserts nothing executed is cheap and permanent.
 *
 * TRIGGER DISCOVERED IN SOURCE (labelled per assessment rules): the client builds job
 * cards with innerHTML and interpolates `job.prompt` unescaped. The EXECUTION below is
 * observed in a real browser, not inferred.
 */
test.describe('F4: customer-supplied prompt text must not execute as markup', () => {
  test.fail(true, 'KNOWN DEFECT F4: job cards are built with innerHTML and the prompt is not escaped. See FINDINGS.md.');

  test.beforeEach(async ({ request }) => {
    await new LabApi(request).reset();
  });

  test('a prompt containing markup is rendered as inert text', async ({ page, request }) => {
    const lab = new LabApi(request);
    const studio = new StudioPage(page);
    await lab.createJobOk('ava', 'alpha', prompts.xssPayload, freshKey('xss'));

    await studio.goto();
    await expect(studio.jobsPanel).toContainText('img', { timeout: 10_000 });

    // Contract: no script ran.
    expect(
      await page.evaluate(() => (window as { __xssExecuted?: boolean }).__xssExecuted === true),
      'customer content must never execute in another user\'s browser',
    ).toBe(false);

    // Contract: the payload was escaped, so no element was injected into the DOM.
    expect(
      await page.locator('#jobs img').count(),
      'the prompt must be rendered as text, not parsed into elements',
    ).toBe(0);
  });

  test('the payload does not execute in a victim from another workspace', async ({ page, request }) => {
    const lab = new LabApi(request);
    const studio = new StudioPage(page);

    // Escalation chain: F2 lets Ava write into Beta, and F4 then executes her payload
    // in Bea's browser. Neither defect alone is as severe as the pair.
    const res = await lab.createJob('ava', 'beta', prompts.xssPayload, freshKey('xss-cross'));

    // If F2 is fixed first this write is refused, and this test becomes moot — that is
    // the correct outcome, and the assertion below still holds.
    if (res.status() === 201) {
      await studio.goto();
      await studio.actAs('bea', 'beta');
      await expect(studio.jobsPanel).toContainText('img', { timeout: 10_000 });
    }

    expect(
      await page.evaluate(() => (window as { __xssExecuted?: boolean }).__xssExecuted === true),
      'one tenant must never be able to run script in another tenant\'s session',
    ).toBe(false);
  });
});
