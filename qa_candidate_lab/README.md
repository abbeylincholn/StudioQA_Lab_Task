# StudioQA Lab

This is a small, fictional browser SaaS used only for the Cascade QA practical assessment. It is not Cascade code and does not reveal Cascade's production architecture.

## Run it

Requirements: Node.js 18 or later. There are no third-party runtime dependencies.

```bash
npm start
```

Then open `http://localhost:4173`.

To reset the in-memory data, use the **Reset lab** button or send:

```bash
curl -X POST http://localhost:4173/api/reset
```

## Test personas

| User | Role | Workspace | Starting credits |
|---|---|---|---:|
| Ava | Editor | Alpha Studio | 3 |
| Vic | Viewer | Alpha Studio | 3 shared workspace credits |
| Bea | Editor | Beta Studio | 2 |

The user and workspace selectors simulate an authenticated session. Do not treat this as a real authentication implementation.

## Product rules

- Editors may create generation jobs; viewers may only inspect jobs.
- Each accepted job reserves one workspace credit.
- A job progresses through `queued`, `processing`, then `succeeded` or `failed`.
- A failed job must refund its reserved credit exactly once.
- Retrying the same request with the same idempotency key m ust not create or charge a second job.
- Users must never read or mutate data belonging to another workspace.

## Assessment rules

Treat the application as a black box for the first 75 minutes. After that, source inspection is allowed, but clearly label findings that came from reading source rather than observed behaviour. Do not fix the lab application itself; your submission should contain your tests, evidence, analysis, and recommendations.

The lab contains deliberate product and engineering defects. It may also contain ordinary limitations that are not defects. Prioritisation matters more than the number of findings.

## Useful API routes

- `GET /api/session?userId=<id>&workspaceId=<id>`
- `GET /api/jobs?workspaceId=<id>`
- `POST /api/jobs`
- `GET /api/jobs/<jobId>`
- `POST /api/reset`

For API calls, pass `x-user-id` and `x-workspace-id`. The browser UI shows the current IDs and idempotency key to make this easy to inspect.
