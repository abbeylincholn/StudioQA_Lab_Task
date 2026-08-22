import http from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("./public/", import.meta.url));
const port = Number(process.env.PORT || 4173);

const seed = () => ({
  users: {
    ava: { id: "ava", name: "Ava", role: "editor", workspaceId: "alpha" },
    vic: { id: "vic", name: "Vic", role: "viewer", workspaceId: "alpha" },
    bea: { id: "bea", name: "Bea", role: "editor", workspaceId: "beta" }
  },
  workspaces: {
    alpha: { id: "alpha", name: "Alpha Studio", credits: 3 },
    beta: { id: "beta", name: "Beta Studio", credits: 2 }
  },
  jobs: [],
  nextJob: 1001,
  pollFailures: new Set()
});

let db = seed();

const json = (res, status, payload) => {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store"
  });
  res.end(JSON.stringify(payload));
};

const readBody = async (req) => {
  let body = "";
  for await (const chunk of req) body += chunk;
  if (!body) return {};
  try {
    return JSON.parse(body);
  } catch {
    return null;
  }
};

const sessionFrom = (req, url, body = {}) => {
  const userId = req.headers["x-user-id"] || body.userId || url.searchParams.get("userId") || "ava";
  const workspaceId = req.headers["x-workspace-id"] || body.workspaceId || url.searchParams.get("workspaceId") || "alpha";
  return { user: db.users[userId], workspace: db.workspaces[workspaceId], userId, workspaceId };
};

const publicJob = (job) => ({ ...job, internalTimer: undefined });

const scheduleJob = (job) => {
  setTimeout(() => {
    const current = db.jobs.find((item) => item.id === job.id);
    if (current && current.status === "queued") {
      current.status = "processing";
      current.updatedAt = new Date().toISOString();
    }
  }, 550);

  setTimeout(() => {
    const current = db.jobs.find((item) => item.id === job.id);
    if (!current || current.status === "succeeded" || current.status === "failed") return;
    current.status = /fail/i.test(current.prompt) ? "failed" : "succeeded";
    current.updatedAt = new Date().toISOString();
    current.result = current.status === "succeeded" ? `Generated concept: ${current.prompt}` : null;
    current.error = current.status === "failed" ? "Generation provider rejected the prompt" : null;
  }, 1700);
};

const handleApi = async (req, res, url) => {
  if (req.method === "POST" && url.pathname === "/api/reset") {
    db = seed();
    return json(res, 200, { ok: true });
  }

  if (req.method === "GET" && url.pathname === "/api/session") {
    const { user, workspace, userId, workspaceId } = sessionFrom(req, url);
    if (!user || !workspace) return json(res, 404, { error: "Unknown user or workspace" });
    return json(res, 200, { user: { ...user }, workspace: { ...workspace }, selected: { userId, workspaceId } });
  }

  if (req.method === "GET" && url.pathname === "/api/jobs") {
    const { user, workspace, workspaceId } = sessionFrom(req, url);
    if (!user || !workspace) return json(res, 404, { error: "Unknown session" });
    const jobs = db.jobs.filter((job) => job.workspaceId === workspaceId).map(publicJob);
    return json(res, 200, { jobs });
  }

  if (req.method === "POST" && url.pathname === "/api/jobs") {
    const body = await readBody(req);
    if (body === null) return json(res, 400, { error: "Invalid JSON" });
    const { user, workspace, workspaceId, userId } = sessionFrom(req, url, body);
    if (!user || !workspace) return json(res, 404, { error: "Unknown session" });
    if (workspace.credits < 1) return json(res, 402, { error: "No credits remaining" });
    if (typeof body.prompt !== "string" || body.prompt.length === 0) {
      return json(res, 400, { error: "Prompt is required" });
    }

    const job = {
      id: `job_${db.nextJob++}`,
      workspaceId,
      createdBy: userId,
      prompt: body.prompt,
      idempotencyKey: body.idempotencyKey || null,
      status: "queued",
      result: null,
      error: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    workspace.credits -= 1;
    db.jobs.push(job);
    scheduleJob(job);
    return json(res, 201, { job: publicJob(job), credits: workspace.credits });
  }

  const match = url.pathname.match(/^\/api\/jobs\/(job_\d+)$/);
  if (req.method === "GET" && match) {
    const { user, workspace } = sessionFrom(req, url);
    if (!user || !workspace) return json(res, 404, { error: "Unknown session" });
    const job = db.jobs.find((item) => item.id === match[1]);
    if (!job) return json(res, 404, { error: "Job not found" });

    // A prompt containing "poll500" creates one transient polling failure.
    if (/poll500/i.test(job.prompt) && !db.pollFailures.has(job.id)) {
      db.pollFailures.add(job.id);
      return json(res, 500, { error: "Temporary job status failure" });
    }
    return json(res, 200, { job: publicJob(job) });
  }

  return json(res, 404, { error: "Not found" });
};

const serveStatic = async (res, pathname) => {
  const requested = pathname === "/" ? "index.html" : pathname.slice(1);
  const safePath = normalize(requested).replace(/^(\.\.(\/|\\|$))+/, "");
  const filePath = join(root, safePath);
  const types = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8"
  };
  try {
    const file = await readFile(filePath);
    res.writeHead(200, { "content-type": types[extname(filePath)] || "application/octet-stream" });
    res.end(file);
  } catch {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("Not found");
  }
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  if (url.pathname.startsWith("/api/")) return handleApi(req, res, url);
  return serveStatic(res, url.pathname);
});

server.listen(port, "127.0.0.1", () => {
  console.log(`StudioQA Lab running at http://localhost:${port}`);
});
