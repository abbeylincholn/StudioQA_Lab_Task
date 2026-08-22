import { call, reset, session, save, type Job } from './probe.js';

await reset();
const before = (await session('ava', 'alpha', 'credits BEFORE')).body.workspace.credits;

const payload = { prompt: 'duplicate submission test', idempotencyKey: 'retry-key-fixed' };

const a = await call<{ job: Job }>('POST #1 (key=retry-key-fixed)', 'POST', '/api/jobs', { user: 'ava', workspace: 'alpha', body: payload });
const b = await call<{ job: Job }>('POST #2 (SAME key)', 'POST', '/api/jobs', { user: 'ava', workspace: 'alpha', body: payload });
const c = await call<{ job: Job }>('POST #3 (SAME key)', 'POST', '/api/jobs', { user: 'ava', workspace: 'alpha', body: payload });

const after = (await session('ava', 'alpha', 'credits AFTER 3 identical POSTs')).body.workspace.credits;
const list = await call<{ jobs: Job[] }>('jobs alpha', 'GET', '/api/jobs?workspaceId=alpha', { user: 'ava', workspace: 'alpha' });

console.log('\n================ VERDICT ================');
console.log('HTTP statuses           :', [a, b, c].map((r) => r.status));
console.log('job ids returned        :', [a, b, c].map((r) => r.body.job.id));
console.log('jobs in workspace       :', list.body.jobs.length, list.body.jobs.map((j) => j.id));
console.log('credits before / after  :', before, '/', after);
console.log('credits consumed        :', before - after, '(contract: at most 1)');
console.log('=========================================');

save('p02-idempotency');
