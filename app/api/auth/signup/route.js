import { err, ok } from "../../../../lib/store.js";

export async function POST(req) {
  // Signup: {email, password} -> creates user + API key (sk-...) for AI calls.
  const { email, password } = await req.json();
  if (!email || !password || password.length < 6) return err("email + password 6+ chars required");
  const { promises: fs } = await import("fs");
  const path = (await import("path")).default;
  const crypto = (await import("crypto")).default;
  const DATA = path.join(process.cwd(), "data");
  let users = [];
  try { users = JSON.parse(await fs.readFile(path.join(DATA, "users.json"), "utf8")); } catch {}
  if (users.find((u) => u.email === email)) return err("email already registered — use login", 409);
  const key = "sk-" + crypto.randomBytes(20).toString("hex");
  users.push({ email, pass: crypto.createHash("sha256").update("v1:" + password).digest("hex"), key, created: Date.now() });
  await fs.mkdir(DATA, { recursive: true });
  await fs.writeFile(path.join(DATA, "users.json"), JSON.stringify(users, null, 2));
  return ok({ email, key, note: "save this key — send as Authorization: Bearer sk-... on /v1/* calls" });
}
