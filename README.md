# ai-web-app — SaaS door for free Hugging Face brains

A tiny Next.js 14 app that gives you the three things every "AI SaaS" needs, with **zero GPU on your own machine**:

1. **Signup + login** (file-backed users, SHA256 password hash, httpOnly cookie session)
2. **API keys** (`sk-...`, issued at signup, usable as `Authorization: Bearer sk-...`)
3. **OpenAI-shaped endpoints** that are proxied to Hugging Face serverless inference with a **server-side** `HF_TOKEN`

The user's browser never sees `HF_TOKEN`. Brains run on Hugging Face compute; your PC stays cool.

## Endpoints

| Method | Path | Body | Notes |
| --- | --- | --- | --- |
| POST | `/api/auth/signup` | `{email, password}` | creates user, returns `sk-...` key |
| POST | `/api/auth/login` | `{email, password}` | sets `sid` cookie, returns the key |
| GET | `/api/auth/login` | – | `{email}` of the logged-in user |
| POST | `/v1/chat/completions` | `{model?, messages, max_tokens?, temperature?, tools?}` | OpenAI chat shape |
| POST | `/v1/completions` | `{model?, prompt, max_tokens?}` | legacy `{choices:[{text}]}` |
| POST | `/v1/images/generations` | `{model?, prompt, size?}` | `{data:[{b64_json}]}` |
| GET | `/v1/models` | – | lists the configured HF models |

`/v1/*` is rewritten (in `next.config.mjs`) to `app/api/v1/*`, so the same handlers work locally with `next dev` **and** on Vercel.

Auth on `/v1/*` accepts either the login cookie **or** `Authorization: Bearer sk-...`.

Pick a specific brain by prefixing its HF repo id with `hf:`, e.g. `{"model":"hf:deepseek-ai/DeepSeek-R1"}`.
(Only models actually served by an enabled Inference Provider work; unknown ones return the HF error verbatim.)

## Environment variables

| Name | Required | Default | Meaning |
| --- | --- | --- | --- |
| `HF_TOKEN` | yes | – | server-side HF token with *Inference Providers* permission |
| `SESSION_SECRET` | yes | – | reserved for signing cookies/tokens |
| `HF_CHAT_MODEL` | no | `Qwen/Qwen2.5-72B-Instruct` | default chat brain |
| `HF_IMAGE_MODEL` | no | `black-forest-labs/FLUX.1-schnell` | default image model |
| `HF_IMAGE_PROVIDER` | no | `nscale` | router provider for text-to-image (fal-ai fallback) |
| `HF_TTS_MODEL` / `HF_STT_MODEL` | no | `hexgrad/Kokoro-82M` / `openai/whisper-large-v3` | advertised in `/v1/models` |
| `DATA_DIR` | no | `./data` (`/tmp/ai-web-app` on Vercel) | where `users.json` / `sessions.json` / `usage.jsonl` live |

Copy `.env.example` → `.env` for local dev. Never commit `.env`.

## Run locally

```powershell
npm install
npm run dev      # http://localhost:3000
```

Smoke test:

```powershell
curl -s -X POST http://localhost:3000/api/auth/signup -H "Content-Type: application/json" -d '{\"email\":\"me@example.com\",\"password\":\"secret123\"}'
curl -s -X POST http://localhost:3000/v1/chat/completions -H "Authorization: Bearer sk-..." -H "Content-Type: application/json" -d '{\"messages\":[{\"role\":\"user\",\"content\":\"hi\"}]}'
```

## Deploy on Vercel

1. Import the GitHub repo at <https://vercel.com/new> (framework auto-detected: Next.js).
2. Project → Settings → Environment Variables → add `HF_TOKEN`, `SESSION_SECRET`, and (optionally) the model overrides above.
3. Deploy. Endpoints land on `https://<project>.vercel.app/v1/...`.

Drop-in with the OpenAI SDK:

```js
import OpenAI from "openai";
const client = new OpenAI({ baseURL: "https://<project>.vercel.app/v1", apiKey: "sk-..." });
```

## Known limitations (v1)

- **Storage is a JSON file.** On Vercel the app writes to `/tmp`, which is per-instance and ephemeral:
  users/keys survive while the instance is warm but not across cold starts or multiple regions.
  Point `DATA_DIR` at a mounted volume, or swap `lib/store.js` for Postgres/Supabase/Upstash — the route
  handlers only use `read()` / `write()` / `requireUser()`.
- `HF_TOKEN` is shared by all users. There is no per-user quota or rate limit yet (`data/usage.jsonl`
  already logs every call, which is the hook for one).
- Password hashing is a plain SHA256 of `v1:<password>` — fine for a demo, replace with bcrypt/argon2 for real users.
- Text-to-image now goes through the HF router's **provider** proxy: `hf-inference` returns 410 for
  `FLUX.1-schnell` (deprecated there), so we call `router.huggingface.co/<provider>/v1/images/generations`
  (default `nscale`) and fall back to `fal-ai/fal-ai/flux/schnell`.
