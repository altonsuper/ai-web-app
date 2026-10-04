import { DATA, ok, openaiErr, preflight, requireUser } from "../../../../../lib/store.js";

export async function OPTIONS() {
  return preflight();
}

// Usage log line per call -> data/usage.jsonl (best effort, never blocks the reply).
async function log(tag, msg, data) {
  try {
    const { promises: fs } = await import("fs");
    const path = (await import("path")).default;
    await fs.mkdir(DATA, { recursive: true });
    const line = JSON.stringify({ ts: new Date().toISOString(), tag, msg, ...data }) + "\n";
    await fs.appendFile(path.join(DATA, "usage.jsonl"), line);
  } catch {}
}

// ---------- OpenAI-style chat (drop-in for any OpenAI client) ----------
// POST /v1/chat/completions  {model, messages:[{role,content}], tools?, max_tokens?}
// Forwards to HF serverless (free compute) with the SERVER token — user never sees it.
export async function POST(req) {
  const user = await requireUser(req);
  if (!user) return openaiErr("Incorrect API key provided or not logged in. Send Authorization: Bearer sk-...", 401, "invalid_request_error");
  let body;
  try { body = await req.json(); } catch { return openaiErr("Request body must be JSON", 400); }
  const corr = "v1-" + Date.now();
  const model = body.model && body.model.startsWith("hf:") ? body.model.slice(3) : (process.env.HF_CHAT_MODEL || "Qwen/Qwen2.5-72B-Instruct");
  const hfBody = {
    model,
    messages: body.messages || [{ role: "user", content: String(body.input || body.prompt || "hi") }],
    max_tokens: body.max_tokens || 300,
  };
  if (body.temperature !== undefined) hfBody.temperature = body.temperature;
  if (body.tools) hfBody.tools = body.tools;
  if (body.tool_choice) hfBody.tool_choice = body.tool_choice;
  const t0 = Date.now();
  let r, j;
  try {
    r = await fetch("https://router.huggingface.co/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: "Bearer " + process.env.HF_TOKEN, "Content-Type": "application/json" },
      body: JSON.stringify(hfBody),
    });
    j = await r.json();
  } catch (e) {
    await log("v1.chat", (user.email || "?") + " network", { corr, ms: Date.now() - t0, error: String(e) });
    return openaiErr("Upstream (Hugging Face) unreachable: " + String(e), 502, "api_error");
  }
  await log("v1.chat", (user.email || "?") + " model=" + model, { corr, ms: Date.now() - t0, status: r.status });
  if (!r.ok) return openaiErr("Hugging Face error: " + JSON.stringify(j).slice(0, 300), 502, "api_error");
  return ok({
    id: corr,
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model: "hf:" + model,
    choices: j.choices,
    usage: j.usage,
  });
}
