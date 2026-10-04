import { NextResponse } from "next/server";

// ---------- tiny file-based store (swap for Postgres/Supabase later) ----------
import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";

// Serverless (Vercel) writable dir: only /tmp exists and it is per-instance & ephemeral.
// Local dev keeps ./data so keys survive restarts. Set DATA_DIR to point at a mounted disk.
export const DATA = process.env.DATA_DIR || (process.env.VERCEL ? "/tmp/ai-web-app" : path.join(process.cwd(), "data"));
const f = (n) => path.join(DATA, n);
async function read(n, fb) {
  try { return JSON.parse(await fs.readFile(f(n), "utf8")); } catch { return fb; }
}
async function write(n, v) {
  await fs.mkdir(DATA, { recursive: true });
  await fs.writeFile(f(n), JSON.stringify(v, null, 2));
}
export async function getAuthedUser(req) {
  const sid = (req.cookies.get("sid") || {}).value;
  if (!sid) return null;
  const sessions = await read("sessions.json", {});
  const email = sessions[sid];
  if (!email) return null;
  const users = await read("users.json", []);
  return users.find((u) => u.email === email) || null;
}
export function sign(payload, secret) {
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}
export const ok = (d, s = 200) => NextResponse.json(d, { status: s });
export const err = (e, s = 400) => NextResponse.json({ error: e }, { status: s });

// CORS: lets any browser/OpenAI client call /v1/* directly with the user's sk- key.
export const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Access-Control-Max-Age": "86400",
};
export const preflight = () => new NextResponse(null, { status: 204, headers: CORS });
export const openaiErr = (message, status, type = "invalid_request_error") =>
  NextResponse.json({ error: { message, type, code: null } }, { status, headers: CORS });

// Accept EITHER a login cookie OR an API key (Authorization: Bearer sk-...).
// Returns the user record, or null when unauthenticated.
export async function requireUser(req) {
  const auth = req.headers.get("authorization") || "";
  const key = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (key.startsWith("sk-")) {
    const users = await read("users.json", []);
    const byKey = users.find((u) => u.key === key);
    if (byKey) return byKey;
  }
  return getAuthedUser(req);
}
