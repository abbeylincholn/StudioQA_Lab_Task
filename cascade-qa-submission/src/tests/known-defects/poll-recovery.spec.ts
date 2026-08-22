import { test, expect } from '@playwright/test';
import { StudioPage } from 'pages/StudioPage';
import { LabApi } from 'utils/api';
import type { Job } from 'utils/types';
import data from 'utils/TestData.json' assert { type: 'json' };

const { prompts } = data;

async function waitForUiToAbsorbTransientError(studio: StudioPage): Promise<void> {
  await expect(
    studio.statusLine,
    'the UI poller should have hit the armed transient 500',
  ).toHaveText(/temporary job status failure/i, { timeout: 10_000 });
}

test.describe('F5: the client must recover from a transient status error', () => {
  test.fail(
    true,
    'KNOWN DEFECT F5: the poller calls clearInterval on any error and never resumes. See FINDINGS.md.',
  );

  test.beforeEach(async ({ request }) => {
    await new LabApi(request).reset();
  });

  test('one transient 500 must not strand the job in a non-terminal state', async ({ page, request }) => {
    const lab = new LabApi(request);
    const studio = new StudioPage(page);

    await studio.goto();
    await studio.submitPrompt(prompts.transientError);

    const jobId = await studio.firstJobId();
    await waitForUiToAbsorbTransientError(studio);
   
    const serverJob = await lab.waitForTerminal('ava', 'alpha', jobId);
    expect(serverJob.status).toBe('succeeded');

    await expect(
      studio.jobStatus(jobId),
      'the UI must recover from a transient status error and reach the terminal state',
    ).toHaveText(/succeeded/i, { timeout: 15_000 });
  });

  test('UI and API must not disagree about the same job', async ({ page, request }) => {
    const lab = new LabApi(request);
    const studio = new StudioPage(page);

    await studio.goto();
    await studio.submitPrompt('poll500 state agreement');

    const jobId = await studio.firstJobId();
    await waitForUiToAbsorbTransientError(studio);
    await lab.waitForTerminal('ava', 'alpha', jobId);
    
    const apiStatus = ((await (await lab.getJob('ava', 'alpha', jobId)).json()) as { job: Job }).job.status;
    const uiStatus = (await studio.jobStatus(jobId).innerText()).trim().toLowerCase();

    expect(uiStatus, `UI shows "${uiStatus}" while the API reports "${apiStatus}"`).toBe(apiStatus);
  });
});

test.describe('F5 workaround: manual refresh does recover the job', () => {
  test.beforeEach(async ({ request }) => {
    await new LabApi(request).reset();
  });

  test('pressing Refresh re-synchronises the stalled UI', async ({ page, request }) => {
    const lab = new LabApi(request);
    const studio = new StudioPage(page);

    await studio.goto();
    await studio.submitPrompt('poll500 manual refresh');

    const jobId = await studio.firstJobId();
    await waitForUiToAbsorbTransientError(studio);    
    await expect(studio.jobStatus(jobId)).toHaveText(/queued|processing/i);    
    await lab.waitForTerminal('ava', 'alpha', jobId);
    await studio.refreshButton.click();
    await expect(studio.jobStatus(jobId)).toHaveText(/succeeded/i);
  });
});
