import { test, expect } from '@playwright/test';
import { StudioPage } from 'pages/StudioPage';
import { LabApi, freshKey } from 'utils/api';
import type { Job } from 'utils/types';
import data from 'utils/TestData.json' assert { type: 'json' };

const { personas } = data;

test.describe('F2: cross-workspace boundary must be enforced server-side', () => {
  test.fail(
    true,
    'KNOWN DEFECT F2: tenancy is taken from the client-supplied header with no membership check. See FINDINGS.md.',
  );

  test.beforeEach(async ({ request }) => {
    await new LabApi(request).reset();
  });

  test('a user cannot LIST another workspace\'s jobs', async ({ request }) => {
    const lab = new LabApi(request);
    await lab.createJobOk('bea', 'beta', 'BETA confidential brief', freshKey('beta'));

    const res = await lab.listJobs('ava', 'beta'); // Ava is not a member of beta
    expect([403, 404], 'listing a foreign workspace must be refused').toContain(res.status());

    if (res.status() === 200) {
      const jobs = ((await res.json()) as { jobs: Job[] }).jobs;
      expect(jobs, 'no foreign workspace data may be returned').toHaveLength(0);
    }
  });

  test('a user cannot READ a specific job belonging to another workspace', async ({ request }) => {
    const lab = new LabApi(request);
    const betaJob = await lab.createJobOk('bea', 'beta', 'BETA confidential brief', freshKey('beta'));
    const res = await lab.getJob('ava', 'alpha', betaJob.id);
    expect([403, 404], 'a foreign job id must not be readable').toContain(res.status());
  });

  test('a user cannot CREATE work in another workspace or spend its credits', async ({ request }) => {
    const lab = new LabApi(request);
    const res = await lab.createJob('ava', 'beta', 'cross-tenant write', freshKey('xtenant'));
    expect([403, 404], 'writing into a foreign workspace must be refused').toContain(res.status());
    expect(await lab.credits('bea', 'beta'), 'another tenant must not be able to spend your credits').toBe(
      personas.bea.startingCredits,
    );
  });

  test('the browser UI does not expose another workspace to a non-member', async ({ page, request }) => {
    const lab = new LabApi(request);
    await lab.createJobOk('bea', 'beta', 'BETA confidential brief', freshKey('beta'));

    const studio = new StudioPage(page);
    await studio.goto();   
    await studio.actAs('ava', 'beta');
    await expect(
      studio.jobsPanel,
      'a non-member must never see another workspace\'s job metadata',
    ).not.toContainText('BETA confidential brief');
  });
});

test.describe('F2b: role must be enforced server-side, not only in the UI', () => {
  test.fail(true, 'KNOWN DEFECT F2: POST /api/jobs never inspects user.role. See FINDINGS.md.');

  test.beforeEach(async ({ request }) => {
    await new LabApi(request).reset();
  });

  test('a viewer cannot create a job through the API', async ({ request }) => {
    const lab = new LabApi(request);
    const before = await lab.credits('vic', 'alpha');
    const res = await lab.createJob('vic', 'alpha', 'viewer must not create this', freshKey('viewer'));
    expect(res.status(), 'a viewer creating a job must be refused').toBe(403);   
    expect(await lab.credits('vic', 'alpha')).toBe(before);
  });

  test('a viewer is not offered the generate control in the UI', async ({ page }) => {
    const studio = new StudioPage(page);
    await studio.goto();
    await studio.actAs('vic', 'alpha');
    await expect(studio.roleBadge).toHaveText(/viewer/i);    
    await expect(studio.generateButton, 'a viewer must not be offered Generate').toBeDisabled();
  });
});
