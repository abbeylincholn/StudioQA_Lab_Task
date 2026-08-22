import { call, reset, session, save, sleep, type Job } from './probe.js';

await reset();
await session('ava', 'alpha');
await session('vic', 'alpha');
await session('bea', 'beta');
await call<{ jobs: Job[] }>('jobs alpha (empty)', 'GET', '/api/jobs?workspaceId=alpha', { user: 'ava', workspace: 'alpha' });
await call<{ jobs: Job[] }>('jobs beta (empty)', 'GET', '/api/jobs?workspaceId=beta', { user: 'bea', workspace: 'beta' });

const created = await call<{ job: Job }>('create job (ava/alpha)', 'POST', '/api/jobs', {
  user: 'ava',
  workspace: 'alpha',
  body: { prompt: 'a calm harbour at dawn', idempotencyKey: 'p01-key-1' },
});
const jobId = created.body.job.id;

await session('ava', 'alpha', 'credits after create');

let terminal: Job | null = null;
for (let i = 0; i < 40; i++) {
  const r = await call<{ job: Job }>(`poll #${i}`, 'GET', `/api/jobs/${jobId}`, { user: 'ava', workspace: 'alpha' });
  if (r.body.job.status === 'succeeded' || r.body.job.status === 'failed') {
    terminal = r.body.job;
    break;
  }
  await sleep(250);
}

console.log('\nterminal status =', terminal?.status, '| result =', JSON.stringify(terminal?.result));
await session('ava', 'alpha', 'credits after terminal');
await call<{ jobs: Job[] }>('jobs alpha (after)', 'GET', '/api/jobs?workspaceId=alpha', { user: 'ava', workspace: 'alpha' });

save('p01-baseline');
