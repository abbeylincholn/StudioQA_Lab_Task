import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '.env') });

export default defineConfig({
  testDir: './src/tests',
  fullyParallel: false, 
  workers: 1,
  forbidOnly: !!process.env.CI, 
  retries: process.env.CI ? 1 : 0,
  timeout: 45_000,
  expect: { timeout: 10_000 },

  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['json', { outputFile: 'test-results/results.json' }],
  ],

  use: {
    baseURL: process.env.LAB_URL || 'http://localhost:4173',
    actionTimeout: 10_000,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  webServer: {
    command: 'node ../qa_candidate_lab/server.mjs',
    url: 'http://localhost:4173/api/session?userId=ava&workspaceId=alpha',
    reuseExistingServer: true,
    timeout: 20_000,
  },

  projects: [
    {
      name: 'setup',
      testDir: './src/tests/setup',
      testMatch: /.*\.setup\.ts/,
    },
    
    {
      name: 'gating-api',
      testDir: './src/tests/gating',
      testMatch: /.*\.api\.spec\.ts/,
      dependencies: ['setup'],
    },
    {
      name: 'gating-ui',
      testDir: './src/tests/gating',
      testMatch: /.*\.ui\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['setup'],
    },
    {
      name: 'gating-tablet',
      testDir: './src/tests/gating',
      testMatch: /.*\.tablet\.spec\.ts/,
      use: { ...devices['iPad (gen 7) landscape'] },
      dependencies: ['setup'],
    },    
    {
      name: 'known-defects',
      testDir: './src/tests/known-defects',
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['setup'],
    },
  ],
});
