import { expect, type APIRequestContext, type APIResponse } from '@playwright/test';
import { TERMINAL_STATUSES, type Job, type Session, type JobStatus } from 'utils/types';

export class LabApi {
  private readonly request: APIRequestContext;

  constructor(request: APIRequestContext) {
    this.request = request;
  }

  async reset(): Promise<void> {
    const res = await this.request.post('/api/reset');
    expect(res.status(), 'lab reset must succeed or the test is not deterministic').toBe(200);
  }

  private headers(userId: string, workspaceId: string): Record<string, string> {
    return { 'x-user-id': userId, 'x-workspace-id': workspaceId, 'content-type': 'application/json' };
  }

  async session(userId: string, workspaceId: string): Promise<APIResponse> {
    return this.request.get(`/api/session?userId=${userId}&workspaceId=${workspaceId}`, {
      headers: this.headers(userId, workspaceId),
    });
  }

  async credits(userId: string, workspaceId: string): Promise<number> {
    const res = await this.session(userId, workspaceId);
    expect(res.status()).toBe(200);
    return ((await res.json()) as Session).workspace.credits;
  }

  async listJobs(userId: string, workspaceId: string, queryWorkspaceId = workspaceId): Promise<APIResponse> {
    return this.request.get(`/api/jobs?workspaceId=${queryWorkspaceId}`, {
      headers: this.headers(userId, workspaceId),
    });
  }

  async getJob(userId: string, workspaceId: string, jobId: string): Promise<APIResponse> {
    return this.request.get(`/api/jobs/${jobId}`, { headers: this.headers(userId, workspaceId) });
  }

  async createJob(
    userId: string,
    workspaceId: string,
    prompt: string,
    idempotencyKey: string,
  ): Promise<APIResponse> {
    return this.request.post('/api/jobs', {
      headers: this.headers(userId, workspaceId),
      data: { prompt, idempotencyKey },
    });
  }
 
  async createJobOk(userId: string, workspaceId: string, prompt: string, key: string): Promise<Job> {
    const res = await this.createJob(userId, workspaceId, prompt, key);
    expect(res.status(), `arranging a job for ${userId}/${workspaceId} should return 201`).toBe(201);
    return ((await res.json()) as { job: Job }).job;
  }


  async waitForTerminal(
    userId: string,
    workspaceId: string,
    jobId: string,
    timeout = 10_000,
  ): Promise<Job> {
    await expect
      .poll(
        async () => {
          const res = await this.getJob(userId, workspaceId, jobId);
          if (res.status() !== 200) return `http-${res.status()}`;
          return ((await res.json()) as { job: Job }).job.status;
        },
        {
          message: `job ${jobId} never reached a terminal state within ${timeout}ms`,
          timeout,
          intervals: [100, 200, 300, 500],
        },
      )
      .toMatch(/^(succeeded|failed)$/);

    const res = await this.getJob(userId, workspaceId, jobId);
    return ((await res.json()) as { job: Job }).job;
  }
}

export const isTerminal = (status: JobStatus): boolean => TERMINAL_STATUSES.includes(status);

export const freshKey = (label: string): string => `${label}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;