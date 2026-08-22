import { test as setup, expect } from '@playwright/test';
import { LabApi } from 'utils/api';


setup('lab is reachable and resettable', async ({ request }) => {
  const lab = new LabApi(request);
  await lab.reset();

  const session = await lab.session('ava', 'alpha');
  expect(session.status(), 'seed persona ava/alpha must exist after reset').toBe(200);
});
