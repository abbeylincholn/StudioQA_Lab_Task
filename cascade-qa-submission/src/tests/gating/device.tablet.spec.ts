import { test, expect } from '@playwright/test';
import { StudioPage } from 'pages/StudioPage';
import { LabApi } from 'utils/api';
import data from 'utils/TestData.json' assert { type: 'json' };

const { prompts } = data;


test.describe('tablet viewport', () => {
  test.use({ viewport: { width: 1080, height: 810 }, hasTouch: true });

  test('the whole generation journey is completable on a tablet', async ({ page, request }) => {
    await new LabApi(request).reset();
    const studio = new StudioPage(page);
    await studio.goto();   
    const { scrollWidth, clientWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(scrollWidth, 'page must not overflow horizontally on a tablet').toBeLessThanOrEqual(clientWidth);
    
    for (const control of [studio.userSelect, studio.workspaceSelect, studio.promptInput, studio.generateButton]) {
      await expect(control).toBeVisible();
      const box = await control.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(clientWidth + 1);
    }   
    await studio.submitPrompt(prompts.success);
    const jobId = await studio.firstJobId();
    await studio.expectJobTerminal(jobId, 'succeeded');
    await expect(studio.jobResult(jobId)).toHaveText(`Generated concept: ${prompts.success}`);
  });
});
