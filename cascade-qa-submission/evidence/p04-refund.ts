
import { call, reset, save, creditsOf, sleep, type Job } from './probe.js';

async function pollToTerminal(id: string, label: string): Promise<Job | null> {

  for (let i = 0; i < 60; i++) {
    const r = await call<{ job: Job }>(`${label} poll#${i}`, 'GET', `/api/jobs/${id}`, { user: 'ava', workspace: 'alpha' });
    if (r.body.job.status === 'succeeded' || r.body.job.status === 'failed') return r.body.job;
    await sleep(250);
  }
  return null;
}

interface Observation {
  prompt: string;
  status?: JobStatusLike;
  result?: string | null;
  error?: string | null;
  before: number;
  afterCreate: number;
  afterTerminal: number;
  afterSettle: number;
}
type JobStatusLike = Job['status'];

await reset();
console.log('\n--- Hunting for a FAILED job. Ava starts with 3 credits. ---');

const prompts = ['fail', 'please fail this job', 'ordinary concept art'];
const observed: Observation[] = [];

for (const prompt of prompts) {
  const before = await creditsOf('ava', 'alpha', `credits before "${prompt}"`);
  const created = await call<{ job: Job }>(`create "${prompt}"`, 'POST', '/api/jobs', {
    user: 'ava', workspace: 'alpha', body: { prompt, idempotencyKey: `refund-${prompt.replace(/\W/g, '')}` },
  });
  if (created.status !== 201) {
    console.log(`  rejected: ${JSON.stringify(created.body)}`);
    continue;
  }
  const afterCreate = await creditsOf('ava', 'alpha', `credits after create "${prompt}"`);
  const job = await pollToTerminal(created.body.job.id, prompt.slice(0, 8));
  const afterTerminal = await creditsOf('ava', 'alpha', `credits after terminal "${prompt}"`);

  await sleep(1500);
  const afterSettle = await creditsOf('ava', 'alpha', `credits +1.5s settle "${prompt}"`);
  observed.push({ prompt, status: job?.status, result: job?.result, error: job?.error, before, afterCreate, afterTerminal, afterSettle });
}

console.log('\n================ REFUND LEDGER ================');
for (const o of observed) {
  console.log(`prompt="${o.prompt}" status=${o.status} result=${JSON.stringify(o.result)} error=${JSON.stringify(o.error)}`);
  console.log(`   credits: before=${o.before} afterCreate=${o.afterCreate} afterTerminal=${o.afterTerminal} afterSettle=${o.afterSettle}`);
  if (o.status === 'failed') {
    console.log(`   >>> FAILED job refunded ${o.afterSettle - o.afterCreate} credit(s). Contract: exactly 1.`);
  }
}
console.log('===============================================');

console.log('\n--- Credit exhaustion: keep creating until refused ---');
for (let i = 0; i < 4; i++) {
  const c = await creditsOf('ava', 'alpha', `credits pre-exhaust#${i}`);
  const r = await call(`exhaust POST #${i} (credits=${c})`, 'POST', '/api/jobs', {
    user: 'ava', workspace: 'alpha', body: { prompt: `exhaust ${i}`, idempotencyKey: `ex-${i}` },
  });
  console.log(`   credits=${c} -> HTTP ${r.status} ${JSON.stringify(r.body).slice(0, 120)}`);
}
await creditsOf('ava', 'alpha', 'FINAL credits');

save('p04-refund');
