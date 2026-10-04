import { ok, openaiErr, preflight, requireUser } from "../../../../../lib/store.js";

export async function OPTIONS() {
  return preflight();
}

// POST /v1/images/generations  {prompt, model?, size?, n?} -> {data:[{b64_json}]} (OpenAI shape)
// HF no longer serves text-to-image on "hf-inference" (FLUX.1-schnell came back 410 there),
// so we go through the router's provider proxy. nscale exposes an OpenAI-images endpoint;
// fal.ai is the fallback. Server token only — the user's key never leaves this app.
export async function POST(req) {
  const user = await requireUser(req);
  if (!user) return openaiErr("Incorrect API key provided or not logged in. Send Authorization: Bearer sk-...", 401, "invalid_request_error");
  let body;
  try { body = await req.json(); } catch { return openaiErr("Request body must be JSON", 400); }
  const model = body.model && body.model.startsWith("hf:") ? body.model.slice(3) : (process.env.HF_IMAGE_MODEL || "black-forest-labs/FLUX.1-schnell");
  const provider = process.env.HF_IMAGE_PROVIDER || "nscale";
  const prompt = String(body.prompt || "a robot");
  const t0 = Date.now();
  const auth = { Authorization: "Bearer " + process.env.HF_TOKEN, "Content-Type": "application/json" };

  // 1) OpenAI-compatible images endpoint (nscale): already returns {data:[{b64_json}]}
  let r;
  try {
    r = await fetch("https://router.huggingface.co/" + provider + "/v1/images/generations", {
      method: "POST",
      headers: auth,
      body: JSON.stringify({ model, prompt, ...(body.size ? { size: body.size } : {}) }),
    });
  } catch (e) {
    return openaiErr("Upstream (Hugging Face) unreachable: " + String(e), 502, "api_error");
  }
  const j = await r.json().catch(() => null);
  if (r.ok && j && Array.isArray(j.data) && j.data[0] && j.data[0].b64_json) {
    return ok({ created: j.created || Math.floor(Date.now() / 1000), model: "hf:" + model, data: j.data, _ms: Date.now() - t0 });
  }

  // 2) fal.ai fallback: returns {images:[{url}]} -> download and hand back base64 like OpenAI
  try {
    const f = await fetch("https://router.huggingface.co/fal-ai/fal-ai/flux/schnell", {
      method: "POST",
      headers: auth,
      body: JSON.stringify({ prompt }),
    });
    const fj = await f.json().catch(() => null);
    const url = fj && fj.images && fj.images[0] && fj.images[0].url;
    if (f.ok && url) {
      const img = await fetch(url);
      const buf = Buffer.from(await img.arrayBuffer());
      return ok({
        created: Math.floor(Date.now() / 1000),
        model: "hf:fal-ai/fal-ai/flux/schnell",
        data: [{ b64_json: buf.toString("base64") }],
        _ms: Date.now() - t0,
      });
    }
    return openaiErr("Hugging Face image error: " + JSON.stringify(j || fj).slice(0, 300), 502, "api_error");
  } catch (e) {
    return openaiErr("Hugging Face image error: " + String(e), 502, "api_error");
  }
}
