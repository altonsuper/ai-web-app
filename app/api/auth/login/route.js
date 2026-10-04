import { getAuthedUser, err, ok } from "../../../../lib/store.js";

export async function POST(req) {
  // Login: {email, password} -> sets sid cookie. Signup first via /api/auth/signup.
  const { email, password } = await req.json();
  const { promises: fs } = await import("fs");
  const path = (await import("path")).default;
  const DATA = path.join(process.cwd(), "data");
  let users = [];
  try { users = JSON.parse(await fs.readFile(path.join(DATA, "users.json"), "utf8")); } catch {}
  const crypto = (await import("crypto")).default;
  const hash = crypto.createHash("sha256").update("v1:" + password).digest("hex");
  const user = users.find((u) => u.email === email && u.pass === hash);
  if (!user) return err("bad email/password", 401);
  const sid = crypto.randomBytes(24).toString("hex");
  let sessions = {};
  try { sessions = JSON.parse(await fs.readFile(path.join(DATA, "sessions.json"), "utf8")); } catch {}
  sessions[sid] = email;
  await fs.mkdir(DATA, { recursive: true });
  await fs.writeFile(path.join(DATA, "sessions.json"), JSON.stringify(sessions));
  const res = ok({ email, key: user.key });
  res.cookies.set("sid", sid, { httpOnly: true, path: "/", maxAge: 86400 * 30 });
  return res;
}
export async function GET(req) {
  const user = await getAuthedUser(req);
  if (!user) return err("not logged in", 401);
  return ok({ email: user.email, key: user.key ? user.key.slice(0, 10) + "..." : null });
}
