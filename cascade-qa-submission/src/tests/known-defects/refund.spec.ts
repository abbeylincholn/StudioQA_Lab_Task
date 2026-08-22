import { test, expect } from '@playwright/test';
import { LabApi, freshKey } from 'utils/api';
import data from 'utils/TestData.json' assert { type: 'json' };

const { personas } = data;

test.describe('F3: a failed job must refund its credit exactly once', () => {
  test.fail(true, 'KNOWN DEFECT F3: no refund path exists for failed jobs. See FINDINGS.md.');

  test.beforeEach(async ({ request }) => {
    await new LabApi(request).reset();
  });

  test('the reserved credit is returned when the provider rejects the job', async ({ request }) => {
    const lab = new LabApi(request);
    const before = await lab.credits('ava', 'alpha');
    expect(before).toBe(personas.ava.startingCredits);
    
    const job = await lab.createJobOk('ava', 'alpha', 'fail on purpose', freshKey('refund'));
    expect(await lab.credits('ava', 'alpha'), 'creation reserves one credit').toBe(before - 1);

    const terminal = await lab.waitForTerminal('ava', 'alpha', job.id);
    expect(terminal.status).toBe('failed');
    expect(terminal.result, 'a failed job must not produce a result').toBeNull();

    await expect
      .poll(() => lab.credits('ava', 'alpha'), {
        message: 'a failed job must refund its reserved credit',
        timeout: 10_000,
        intervals: [200, 400, 600],
      })
      .toBe(before);
  });

  test('the refund happens once and only once', async ({ request }) => {
    const lab = new LabApi(request);
    const before = await lab.credits('ava', 'alpha');
    const job = await lab.createJobOk('ava', 'alpha', 'fail once only', freshKey('refund-once'));
    await lab.waitForTerminal('ava', 'alpha', job.id);
    
    await expect
      .poll(() => lab.credits('ava', 'alpha'), { timeout: 10_000, intervals: [200, 400] })
      .toBe(before);

    await lab.getJob('ava', 'alpha', job.id);
    await lab.getJob('ava', 'alpha', job.id);

    expect(await lab.credits('ava', 'alpha'), 'a failed job must never refund more than once').toBe(before);
    expect(await lab.credits('ava', 'alpha')).toBeLessThanOrEqual(personas.ava.startingCredits);
  });
});
