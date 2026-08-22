/** Shared domain types for the StudioQA lab, derived from observed API responses. */

export type JobStatus = 'queued' | 'processing' | 'succeeded' | 'failed';
export const TERMINAL_STATUSES: readonly JobStatus[] = ['succeeded', 'failed'] as const;

export interface Job {
  id: string;
  workspaceId: string;
  createdBy: string;
  prompt: string;
  idempotencyKey: string | null;
  status: JobStatus;
  result: string | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Session {
  user: { id: string; name: string; role: Role; workspaceId: string };
  workspace: { id: string; name: string; credits: number };
  selected: { userId: string; workspaceId: string };
}

export type Role = 'editor' | 'viewer';
export type PersonaId = 'ava' | 'vic' | 'bea';
export type WorkspaceId = 'alpha' | 'beta';
