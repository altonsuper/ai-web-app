"use client";
import { useEffect, useState } from "react";

const box = { border: "1px solid #ddd", borderRadius: 8, padding: 12, marginBottom: 12 };
const inp = { width: "100%", padding: 8, marginTop: 6, boxSizing: "border-box" };
const btn = { padding: "8px 14px", marginTop: 8, cursor: "pointer" };

export default function Home() {
  const [out, setOut] = useState("");
  const [key, setKey] = useState("");
  const [who, setWho] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setKey(localStorage.getItem("sk") || "");
    fetch("/api/auth/login").then((r) => r.json()).then((j) => j.email && setWho(j.email)).catch(() => {});
  }, []);

  const post = async (url, body, auth) => {
    setBusy(true);
    setOut("...");
    try {
      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(auth ? { Authorization: "Bearer " + auth } : {}) },
        body: JSON.stringify(body),
      });
      const t = await r.text();
      let j;
      try { j = JSON.parse(t); } catch { j = { raw: t.slice(0, 400) }; }
      if (j.key) { setKey(j.key); localStorage.setItem("sk", j.key); }
      if (j.email) setWho(j.email);
      setOut(JSON.stringify(j, null, 2).replace(/"b64_json": "[^"]{40}[^"]*"/, '"b64_json": "<image bytes trimmed>"').slice(0, 2500));
      return j;
    } catch (e) {
      setOut(String(e));
    } finally {
      setBusy(false);
    }
  };

  const v = (id) => document.getElementById(id).value;

  return (
    <main style={{ fontFamily: "system-ui", maxWidth: 720, margin: "30px auto", padding: 16 }}>
      <h1>ai-web-app v1 — login, get key, use AI</h1>
      <p>
        Brains run on Hugging Face free serverless compute. This Vercel app is the SaaS door: signup, login, API key,
        OpenAI-style endpoints. {who ? <b>Signed in as {who}</b> : "Not signed in."}
      </p>

      <section style={box}>
        <h3>1. Signup / Login</h3>
        <input id="e" placeholder="email" style={inp} defaultValue="me@example.com" />
        <input id="p" type="password" placeholder="password (6+ chars)" style={inp} />
        <button style={btn} disabled={busy} onClick={() => post("/api/auth/signup", { email: v("e"), password: v("p") })}>Signup (get key)</button>{" "}
        <button style={btn} disabled={busy} onClick={() => post("/api/auth/login", { email: v("e"), password: v("p") })}>Login (cookie session)</button>
        {key ? <p style={{ wordBreak: "break-all" }}>Your key: <code>{key}</code></p> : null}
      </section>

      <section style={box}>
        <h3>2. Chat — POST /v1/chat/completions</h3>
        <input id="q" placeholder="ask anything" style={inp} defaultValue="What is 12*8?" />
        <button style={btn} disabled={busy} onClick={() => post("/v1/chat/completions", { messages: [{ role: "user", content: v("q") }] }, key)}>Ask</button>
      </section>

      <section style={box}>
        <h3>3. Image — POST /v1/images/generations</h3>
        <input id="ip" placeholder="image prompt" style={inp} defaultValue="a red panda coding at night, neon" />
        <button style={btn} disabled={busy} onClick={() => post("/v1/images/generations", { prompt: v("ip") }, key)}>Generate (b64 JSON)</button>
      </section>

      <pre style={{ background: "#f6f6f6", padding: 12, borderRadius: 8, overflow: "auto", maxHeight: 320 }}>{out}</pre>

      <section style={box}>
        <h3>API</h3>
        <ul>
          <li><code>POST /v1/chat/completions</code> — OpenAI chat shape (Authorization: Bearer sk-... or login cookie)</li>
          <li><code>POST /v1/completions</code> — legacy prompt → text</li>
          <li><code>POST /v1/images/generations</code> — prompt → {"{data:[{b64_json}]}"}</li>
          <li><code>GET /v1/models</code> — list available HF brains</li>
        </ul>
        <p>Pick a specific Hugging Face model by prefixing its repo id with <code>hf:</code>, e.g. <code>{"hf:Qwen/Qwen2.5-7B-Instruct"}</code>.</p>
      </section>
    </main>
  );
}
