import { test, expect } from '@playwright/test';
import { StudioPage } from 'pages/StudioPage';
import { LabApi } from 'utils/api';
import type { Job } from 'utils/types';
import data from 'utils/TestData.json' assert { type: 'json' };

const { personas } = data;

test.describe('F1: idempotent retry must not double-charge', () => {
  test.fail(
    true,
    'KNOWN DEFECT F1: the lab stores idempotencyKey but never de-duplicates on it. See FINDINGS.md.',
  );

  test('replaying one idempotency key creates at most one job and spends at most one credit', async ({ request }) => {
    const lab = new LabApi(request);
    await lab.reset();

    const key = 'fixed-retry-key';
    const prompt = 'duplicate submission';

    const first = await lab.createJob('ava', 'alpha', prompt, key);
    expect(first.status()).toBe(201);
    const firstJob = ((await first.json()) as { job: Job }).job;    
    const second = await lab.createJob('ava', 'alpha', prompt, key);
    const third = await lab.createJob('ava', 'alpha', prompt, key);    
    const secondJob = ((await second.json()) as { job: Job }).job;
    const thirdJob = ((await third.json()) as { job: Job }).job;
    expect(secondJob.id, 'a replayed key must return the original job').toBe(firstJob.id);
    expect(thirdJob.id, 'a replayed key must return the original job').toBe(firstJob.id);
   
    const list = await lab.listJobs('ava', 'alpha');
    const jobs = ((await list.json()) as { jobs: Job[] }).jobs;
    expect(jobs.filter((j) => j.idempotencyKey === key), 'one key must yield one job').toHaveLength(1);
    expect(await lab.credits('ava', 'alpha'), 'three identical requests must cost one credit').toBe(
      personas.ava.startingCredits - 1,
    );
  });
});


test.describe('F1b: retry after a lost response must not double-charge', () => {
  test.fail(true, 'KNOWN DEFECT F1: server ignores the replayed idempotency key. See FINDINGS.md.');

  test('a customer who retries a timed-out submission is charged once', async ({ page, request }) => {
    const lab = new LabApi(request);
    await lab.reset();
    const studio = new StudioPage(page);

    const keysSent: string[] = [];
    let swallowNext = true;

    await page.route('**/api/jobs', async (route) => {
      if (route.request().method() !== 'POST') return route.fallback();
      keysSent.push(route.request().postDataJSON().idempotencyKey);
      if (swallowNext) {
        swallowNext = false;
        await route.fetch(); 
        return route.abort('timedout'); 
      }
      return route.continue();
    });

    await studio.goto();
    await studio.submitPrompt('timed out then retried');
    await expect(studio.statusLine).toHaveText(/failed to fetch/i);    
    await studio.generateButton.click();
    await expect(studio.jobsPanel).toContainText(/succeeded/i, { timeout: 15_000 });
    expect(keysSent[0]).toBe(keysSent[1]);
  
    const list = await lab.listJobs('ava', 'alpha');
    const jobs = ((await list.json()) as { jobs: Job[] }).jobs;
    expect(jobs, 'a retried submission must not create a second job').toHaveLength(1);
    expect(await lab.credits('ava', 'alpha'), 'a retried submission must cost one credit').toBe(
      personas.ava.startingCredits - 1,
    );
  });
});
