import { test, expect } from '@playwright/test';
import { StudioPage } from 'pages/StudioPage';
import { LabApi } from 'utils/api';
import data from 'utils/TestData.json' assert { type: 'json' };

const { prompts, personas } = data;

test.describe('customer journey: editor generates a concept', () => {
  test('submission reaches a terminal state and shows the business result', async ({ page, request }) => {
    await new LabApi(request).reset();
    const studio = new StudioPage(page);
    await studio.goto();
    expect(await studio.credits()).toBe(personas.ava.startingCredits);
    await studio.submitPrompt(prompts.success);
    const jobId = await studio.firstJobId();
    await studio.expectJobTerminal(jobId, 'succeeded');
    await expect(studio.jobResult(jobId)).toHaveText(`Generated concept: ${prompts.success}`);
    await expect(studio.jobError(jobId)).toHaveCount(0);
    await expect(studio.creditsValue).toHaveText(String(personas.ava.startingCredits - 1));
    await expect(studio.statusLine).toHaveText('Generation completed');
  });

  test('a failed generation surfaces the provider error to the customer', async ({ page, request }) => {
    await new LabApi(request).reset();
    const studio = new StudioPage(page);
    await studio.goto();   
    await studio.submitPrompt(prompts.fail);
    const jobId = await studio.firstJobId();
    await studio.expectJobTerminal(jobId, 'failed');
    await expect(studio.jobError(jobId)).toHaveText('Generation provider rejected the prompt');
    await expect(studio.jobResult(jobId)).toHaveCount(0);
    await expect(studio.statusLine).toHaveText('Generation failed');
  });
});
