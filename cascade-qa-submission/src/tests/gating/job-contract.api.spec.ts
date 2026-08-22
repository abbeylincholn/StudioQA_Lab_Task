import { test, expect } from '@playwright/test';
import { LabApi, freshKey } from 'utils/api';
import type { Job, Session } from 'utils/types';
import data from 'utils/TestData.json' assert { type: 'json' };

const { personas } = data;

test.describe('API contract: POST /api/jobs and job lifecycle', () => {
  test.beforeEach(async ({ request }) => {
    await new LabApi(request).reset();
  });

  test('accepted job returns 201 with a complete, correctly-typed job resource', async ({ request }) => {
    const lab = new LabApi(request);
    const key = freshKey('contract');
    const res = await lab.createJob('ava', 'alpha', 'contract shape check', key);

    expect(res.status()).toBe(201);
    expect(res.headers()['content-type']).toContain('application/json');

    const body = (await res.json()) as { job: Job; credits: number };
    const job = body.job;
    
    expect(job).toMatchObject({
      id: expect.stringMatching(/^job_\d+$/),
      workspaceId: 'alpha',
      createdBy: 'ava',
      prompt: 'contract shape check',
      idempotencyKey: key,
      status: 'queued',
      result: null,
      error: null,
    });
    expect(new Date(job.createdAt).toString()).not.toBe('Invalid Date');
    expect(new Date(job.updatedAt).toString()).not.toBe('Invalid Date');    
    expect(job.status).toBe('queued');
    expect(body.credits).toBe(personas.ava.startingCredits - 1);
    expect(await lab.credits('ava', 'alpha')).toBe(personas.ava.startingCredits - 1);
  });

  test('job transitions through the documented states and ends with exactly one result', async ({ request }) => {
    const lab = new LabApi(request);
    const job = await lab.createJobOk('ava', 'alpha', 'lifecycle check', freshKey('lifecycle'));

    const terminal = await lab.waitForTerminal('ava', 'alpha', job.id);

    expect(terminal.status).toBe('succeeded');
    expect(terminal.result).toBe('Generated concept: lifecycle check');
    expect(terminal.error).toBeNull();    
    expect(new Date(terminal.updatedAt).getTime()).toBeGreaterThan(new Date(terminal.createdAt).getTime());
   
    const list = await lab.listJobs('ava', 'alpha');
    const jobs = ((await list.json()) as { jobs: Job[] }).jobs;
    expect(jobs.filter((j) => j.id === job.id)).toHaveLength(1);
  });

  test('invalid input is rejected without consuming a credit', async ({ request }) => {
    const lab = new LabApi(request);
    const before = await lab.credits('ava', 'alpha');
    const res = await lab.createJob('ava', 'alpha', '', freshKey('empty'));
    expect(res.status()).toBe(400);
    expect((await res.json()).error).toBe('Prompt is required'); 
    expect(await lab.credits('ava', 'alpha')).toBe(before);
  });

  test('a workspace with no credits refuses new work with 402 and never goes negative', async ({ request }) => {
    const lab = new LabApi(request);
    for (let i = 0; i < personas.ava.startingCredits; i++) {
      await lab.createJobOk('ava', 'alpha', `spend ${i}`, freshKey(`spend-${i}`));
    }
    expect(await lab.credits('ava', 'alpha')).toBe(0);

    const res = await lab.createJob('ava', 'alpha', 'one too many', freshKey('over'));
    expect(res.status()).toBe(402);
    expect((await res.json()).error).toBe('No credits remaining');    
    expect(await lab.credits('ava', 'alpha')).toBe(0);
  });

  test('GET /api/session reports the persona and balance the UI renders', async ({ request }) => {
    const lab = new LabApi(request);
    const res = await lab.session('bea', 'beta');
    expect(res.status()).toBe(200);
    const body = (await res.json()) as Session;
    expect(body).toMatchObject({
      user: { id: 'bea', name: 'Bea', role: 'editor', workspaceId: 'beta' },
      workspace: { id: 'beta', name: 'Beta Studio', credits: personas.bea.startingCredits },
    });
  });

  test('an unknown job id returns 404 rather than an empty 200', async ({ request }) => {
    const lab = new LabApi(request);
    const res = await lab.getJob('ava', 'alpha', 'job_9999');
    expect(res.status()).toBe(404);
    expect((await res.json()).error).toBe('Job not found');
  });
});
