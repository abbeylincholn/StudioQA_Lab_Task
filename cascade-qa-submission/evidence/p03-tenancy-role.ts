import { call, reset, session, save, type Job } from './probe.js';

await reset();

await call<{ job: Job }>('seed alpha job', 'POST', '/api/jobs', {
  user: 'ava', workspace: 'alpha', body: { prompt: 'ALPHA SECRET client brief', idempotencyKey: 'seed-a' },
});
const betaJob = await call<{ job: Job }>('seed beta job', 'POST', '/api/jobs', {
  user: 'bea', workspace: 'beta', body: { prompt: 'BETA SECRET client brief', idempotencyKey: 'seed-b' },
});
const betaId = betaJob.body.job.id;

console.log('\n--- R1: can Ava (member of alpha ONLY) reach Beta data? ---');

await call<{ jobs: Job[] }>('R1a ava lists BETA jobs (header spoof)', 'GET', '/api/jobs?workspaceId=beta', { user: 'ava', workspace: 'beta' });

await call<{ jobs: Job[] }>('R1b ava header=alpha query=beta', 'GET', '/api/jobs?workspaceId=beta', { user: 'ava', workspace: 'alpha' });

await call<{ job: Job }>('R1c ava GETs beta job by id (header=alpha)', 'GET', `/api/jobs/${betaId}`, { user: 'ava', workspace: 'alpha' });

await call<{ job: Job }>('R1d ava GETs beta job (header=beta)', 'GET', `/api/jobs/${betaId}`, { user: 'ava', workspace: 'beta' });

await call<{ job: Job }>('R1e ava CREATES job in beta', 'POST', '/api/jobs', {
  user: 'ava', workspace: 'beta', body: { prompt: 'cross-tenant write', idempotencyKey: 'x-tenant' },
});
await session('bea', 'beta', 'beta credits after Ava write');

await session('ava', 'beta', 'R1f ava session on beta');

console.log('\n--- R4: can Vic (viewer) create a job? ---');
await call<{ job: Job }>('R4a vic creates job', 'POST', '/api/jobs', {
  user: 'vic', workspace: 'alpha', body: { prompt: 'viewer should not create this', idempotencyKey: 'viewer-1' },
});
await session('ava', 'alpha', 'alpha credits after viewer attempt');

save('p03-tenancy-role');
