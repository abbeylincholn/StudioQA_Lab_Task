import { call, reset, save, log, sleep, type Job, type JobStatus } from './probe.js';

await reset();
const created = await call<{ job: Job }>('create', 'POST', '/api/jobs', {
  user: 'ava', workspace: 'alpha', body: { prompt: 'transient error probe', idempotencyKey: 'tr-1' },
});
const id = created.body.job.id;

const tally: Record<number, number> = {};
const statuses: JobStatus[] = [];
for (let i = 0; i < 120; i++) {
  const r = await call<{ job: Job }>(`status#${i}`, 'GET', `/api/jobs/${id}`, { user: 'ava', workspace: 'alpha' });
  tally[r.status] = (tally[r.status] ?? 0) + 1;
  if (r.body?.job?.status) statuses.push(r.body.job.status);
  await sleep(100);
}

console.log('\n============ STATUS ENDPOINT RELIABILITY ============');
console.log('HTTP status tally over 120 polls:', tally);
const nonOk = log.filter((e) => e.label.startsWith('status#') && e.response.status !== 200);
console.log(`non-200 responses: ${nonOk.length}`);
for (const e of nonOk.slice(0, 5)) console.log(`   ${e.label} -> ${e.response.status} ${JSON.stringify(e.response.body)}`);
console.log('observed status sequence (deduped):', [...new Set(statuses)]);
console.log('final job status:', statuses.at(-1));
console.log('====================================================');

const finalJob = await call<{ job: Job }>('final read', 'GET', `/api/jobs/${id}`, { user: 'ava', workspace: 'alpha' });
console.log('final job:', JSON.stringify(finalJob.body.job, null, 2));

save('p05-transient');
