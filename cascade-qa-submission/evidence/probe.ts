import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const BASE = 'http://localhost:4173';

const here = dirname(fileURLToPath(import.meta.url));

export type JobStatus = 'queued' | 'processing' | 'succeeded' | 'failed';

export interface Job {
  id: string;
  workspaceId: string;
  createdBy: string;
  prompt: string;
  idempotencyKey: string;
  status: JobStatus;
  result: string | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SessionBody {
  user: { id: string; name: string; role: 'editor' | 'viewer'; workspaceId: string };
  workspace: { id: string; name: string; credits: number };
  selected: { userId: string; workspaceId: string };
}

export interface ApiResponse<T = unknown> {
  status: number;
  body: T;
}

interface LogEntry {
  label: string;
  request: { method: string; path: string; headers: Record<string, string>; body: unknown };
  response: ApiResponse;
  ms: number;
}

export interface CallOptions {
  user?: string;
  workspace?: string;
  body?: unknown;
}

export const log: LogEntry[] = [];

export async function call<T = any>(
  label: string,
  method: 'GET' | 'POST',
  path: string,
  { user, workspace, body }: CallOptions = {},
): Promise<ApiResponse<T>> {
  const headers: Record<string, string> = {};
  if (user) headers['x-user-id'] = user;
  if (workspace) headers['x-workspace-id'] = workspace;
  if (body) headers['content-type'] = 'application/json';

  const started = Date.now();
  const res = await fetch(BASE + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = text;
  }

  const response: ApiResponse<T> = { status: res.status, body: parsed as T };
  log.push({ label, request: { method, path, headers, body: body ?? null }, response, ms: Date.now() - started });
  console.log(`[${label}] ${method} ${path} -> ${res.status} ${JSON.stringify(parsed).slice(0, 220)}`);
  return response;
}

export const reset = (): Promise<ApiResponse<{ ok: boolean }>> =>
  call<{ ok: boolean }>('reset', 'POST', '/api/reset');

export const session = (userId: string, workspaceId: string, label = `session ${userId}/${workspaceId}`) =>
  call<SessionBody>(label, 'GET', `/api/session?userId=${userId}&workspaceId=${workspaceId}`, {
    user: userId,
    workspace: workspaceId,
  });

export const creditsOf = async (userId: string, workspaceId: string, label?: string): Promise<number> =>
  (await session(userId, workspaceId, label)).body.workspace.credits;

export const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

export function save(name: string): void {
  mkdirSync(resolve(here, 'api'), { recursive: true });
  writeFileSync(resolve(here, 'api', `${name}.json`), JSON.stringify(log, null, 2));
  console.log(`\nsaved -> evidence/api/${name}.json (${log.length} calls)`);
}
