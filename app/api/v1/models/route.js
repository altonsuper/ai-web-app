import { ok, preflight, requireUser } from "../../../../lib/store.js";

export async function OPTIONS() {
  return preflight();
}

// GET /v1/models -> OpenAI "list models" shape. Models are HF repos, so clients
// just pass the id back (e.g. "hf:Qwen/Qwen2.5-72B-Instruct") to pick a different brain.
export async function GET(req) {
  const user = await requireUser(req);
  if (!user) return ok({ object: "list", data: [] });
  const ids = [
    process.env.HF_CHAT_MODEL || "Qwen/Qwen2.5-72B-Instruct",
    process.env.HF_IMAGE_MODEL || "black-forest-labs/FLUX.1-schnell",
    process.env.HF_TTS_MODEL || "hexgrad/Kokoro-82M",
    process.env.HF_STT_MODEL || "openai/whisper-large-v3",
  ];
  return ok({
    object: "list",
    data: ids.map((id) => ({ id: "hf:" + id, object: "model", created: 0, owned_by: "huggingface" })),
  });
}
