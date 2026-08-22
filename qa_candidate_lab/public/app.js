const $ = (selector) => document.querySelector(selector);

const state = {
  userId: "ava",
  workspaceId: "alpha",
  idempotencyKey: crypto.randomUUID(),
  poller: null
};

const headers = () => ({
  "content-type": "application/json",
  "x-user-id": state.userId,
  "x-workspace-id": state.workspaceId
});

const setStatus = (message, kind = "") => {
  const el = $("#status-line");
  el.textContent = message;
  el.className = kind;
};

const api = async (path, options = {}) => {
  const response = await fetch(path, { ...options, headers: { ...headers(), ...(options.headers || {}) } });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `Request failed: ${response.status}`);
  return data;
};

const updateKey = () => {
  $("#key").textContent = `Idempotency key: ${state.idempotencyKey}`;
};

const loadSession = async () => {
  const data = await api(`/api/session?userId=${state.userId}&workspaceId=${state.workspaceId}`);
  $("#role").textContent = data.user.role;
  $("#credits").textContent = data.workspace.credits;
};

const jobCard = (job) => {
  const result = job.result ? `<p class="result">${job.result}</p>` : "";
  const error = job.error ? `<p class="error">${job.error}</p>` : "";
  return `<article class="job" data-job-id="${job.id}">
    <div class="job-head"><strong>${job.id}</strong><span class="status ${job.status}">${job.status}</span></div>
    <p class="prompt">${job.prompt}</p>${result}${error}
    <small>Created by ${job.createdBy} at ${new Date(job.createdAt).toLocaleTimeString()}</small>
  </article>`;
};

const loadJobs = async () => {
  const data = await api(`/api/jobs?workspaceId=${state.workspaceId}`);
  $("#jobs").innerHTML = data.jobs.length ? data.jobs.map(jobCard).join("") : `<div class="empty">No jobs yet</div>`;
  return data.jobs;
};

const pollJob = async (jobId) => {
  clearInterval(state.poller);
  state.poller = setInterval(async () => {
    try {
      const data = await api(`/api/jobs/${jobId}`);
      await loadJobs();
      await loadSession();
      if (["succeeded", "failed"].includes(data.job.status)) {
        clearInterval(state.poller);
        setStatus(data.job.status === "succeeded" ? "Generation completed" : "Generation failed", data.job.status);
      }
    } catch (error) {
      clearInterval(state.poller);
      setStatus(error.message, "error");
    }
  }, 400);
};

const createJob = async () => {
  const button = $("#generate");
  button.disabled = true;
  setStatus("Submitting...");
  try {
    const data = await api("/api/jobs", {
      method: "POST",
      body: JSON.stringify({
        prompt: $("#prompt").value,
        workspaceId: state.workspaceId,
        idempotencyKey: state.idempotencyKey
      })
    });
    $("#credits").textContent = data.credits;
    await loadJobs();
    setStatus("Generation queued");
    pollJob(data.job.id);
    // The key changes only after a successful response, which makes retry semantics observable.
    state.idempotencyKey = crypto.randomUUID();
    updateKey();
  } catch (error) {
    setStatus(error.message, "error");
  } finally {
    button.disabled = false;
  }
};

const changeSession = async () => {
  state.userId = $("#user").value;
  state.workspaceId = $("#workspace").value;
  clearInterval(state.poller);
  setStatus("");
  await Promise.all([loadSession(), loadJobs()]);
};

$("#user").addEventListener("change", changeSession);
$("#workspace").addEventListener("change", changeSession);
$("#generate").addEventListener("click", createJob);
$("#refresh").addEventListener("click", async () => {
  try { await Promise.all([loadSession(), loadJobs()]); } catch (error) { setStatus(error.message, "error"); }
});
$("#reset").addEventListener("click", async () => {
  await api("/api/reset", { method: "POST" });
  state.idempotencyKey = crypto.randomUUID();
  updateKey();
  await changeSession();
  setStatus("Lab reset");
});

updateKey();
changeSession().catch((error) => setStatus(error.message, "error"));
