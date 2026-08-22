import { expect, type Locator, type Page } from '@playwright/test';
import type { JobStatus, PersonaId, WorkspaceId } from 'utils/types';

export class StudioPage {
  private readonly page: Page;
  readonly userSelect: Locator;
  readonly workspaceSelect: Locator;
  readonly promptInput: Locator;
  readonly generateButton: Locator;
  readonly refreshButton: Locator;
  readonly resetButton: Locator;
  readonly creditsValue: Locator;
  readonly roleBadge: Locator;
  readonly statusLine: Locator;
  readonly jobsPanel: Locator;

  constructor(page: Page) {
    this.page = page;
    this.userSelect = page.getByLabel('User');
    this.workspaceSelect = page.getByLabel('Workspace');
    this.promptInput = page.getByLabel('Prompt');
    this.generateButton = page.getByRole('button', { name: /generate/i });
    this.refreshButton = page.getByRole('button', { name: /refresh/i });
    this.resetButton = page.getByRole('button', { name: /reset lab/i });
    this.statusLine = page.getByRole('status');  
    this.creditsValue = page.locator('#credits');
    this.roleBadge = page.locator('#role');
    this.jobsPanel = page.locator('#jobs');
  }

  async goto(): Promise<void> {
    await this.page.goto('/');  
    await expect(this.creditsValue).toHaveText(/^\d+$/);
  }

  async actAs(user: PersonaId, workspace: WorkspaceId): Promise<void> {
    await this.userSelect.selectOption(user);
    await this.workspaceSelect.selectOption(workspace);
    await expect(this.creditsValue).toHaveText(/^\d+$/);
  }

  job(jobId: string): Locator {
    return this.page.locator(`[data-job-id="${jobId}"]`);
  }

  jobStatus(jobId: string): Locator {
    return this.job(jobId).locator('.status');
  }

  jobResult(jobId: string): Locator {
    return this.job(jobId).locator('.result');
  }

  jobError(jobId: string): Locator {
    return this.job(jobId).locator('.error');
  }

  async credits(): Promise<number> {
    const text = (await this.creditsValue.innerText()).trim();
    const value = Number(text);
    expect(Number.isFinite(value), `credits should render as a number, got "${text}"`).toBe(true);
    return value;
  }

  async submitPrompt(prompt: string): Promise<void> {
    await this.promptInput.fill(prompt);
    await this.generateButton.click();
  }

  async expectJobTerminal(jobId: string, expected: Extract<JobStatus, 'succeeded' | 'failed'>): Promise<void> {
    await expect(this.jobStatus(jobId)).toHaveText(new RegExp(`^${expected}$`, 'i'), { timeout: 15_000 });
  }

  async firstJobId(): Promise<string> {
    const first = this.page.locator('[data-job-id]').first();
    await expect(first).toBeVisible();
    const id = await first.getAttribute('data-job-id');
    expect(id, 'job card must expose a data-job-id').toBeTruthy();
    return id as string;
  }
}