import { ok, openaiErr, preflight, requireUser } from "../../../../lib/store.js";

export async function OPTIONS() {
  return preflight();
}

// POST /v1/completions  {prompt, max_tokens?} -> {choices:[{text}]}
// Legacy OpenAI "text completion" shape, implemented on top of HF chat models.
export async function POST(req) {
  const user = await requireUser(req);
  if (!user) return openaiErr("Incorrect API key provided or not logged in. Send Authorization: Bearer sk-...", 401, "invalid_request_error");
  let body;
  try { body = await req.json(); } catch { return openaiErr("Request body must be JSON", 400); }
  const corr = "v1-" + Date.now();
  const model = body.model && body.model.startsWith("hf:") ? body.model.slice(3) : (process.env.HF_CHAT_MODEL || "Qwen/Qwen2.5-72B-Instruct");
  const prompt = String(body.prompt || body.input || "hi");
  const t0 = Date.now();
  let r, j;
  try {
    r = await fetch("https://router.huggingface.co/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: "Bearer " + process.env.HF_TOKEN, "Content-Type": "application/json" },
      body: JSON.stringify({ model, messages: [{ role: "user", content: prompt }], max_tokens: body.max_tokens || 200 }),
    });
    j = await r.json();
  } catch (e) {
    return openaiErr("Upstream (Hugging Face) unreachable: " + String(e), 502, "api_error");
  }
  if (!r.ok) return openaiErr("Hugging Face error: " + JSON.stringify(j).slice(0, 300), 502, "api_error");
  const text = (j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) || "";
  return ok({
    id: corr,
    object: "text_completion",
    created: Math.floor(Date.now() / 1000),
    model: "hf:" + model,
    choices: [{ text, index: 0, finish_reason: "stop" }],
    usage: j.usage,
    _ms: Date.now() - t0,
  });
}
