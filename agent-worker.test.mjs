import { test } from "node:test";
import assert from "node:assert/strict";
import { route, wavFromPcm } from "./worker.js";

const SECRET = "sync-secret-0123456789abcdef";
const APP = "https://me.github.io/buddy-mobile";
const kvStore = () => { const m = new Map(); return { get: async (k) => (m.has(k) ? m.get(k) : null), put: async (k, v) => m.set(k, v), _m: m }; };
const env = (extra = {}) => Object.assign({ BUDDY_KV: kvStore(), SYNC_SECRET: SECRET, ALLOWED_ORIGIN: APP, ANTHROPIC_API_KEY: "sk-test-key", GEMINI_API_KEY: "g-test-key" }, extra);
const req = (path, body, auth = SECRET) => new Request("https://x.workers.dev" + path, {
  method: "POST", headers: { "content-type": "application/json", Origin: APP, ...(auth ? { Authorization: "Bearer " + auth } : {}) },
  body: JSON.stringify(body) });
const realFetch = globalThis.fetch;
function stub(handler) { globalThis.fetch = async (url, opts) => handler(String(url), opts || {}); }
test.afterEach(() => { globalThis.fetch = realFetch; });

test("agent routes need the sync secret", async () => {
  const r = await route(req("/agent/chat", { messages: [{ role: "user", content: "hi" }] }, null), env());
  assert.equal(r.status, 401);
  const s = await route(req("/agent/speak", { text: "hi" }, "wrong-secret-0000000000"), env());
  assert.equal(s.status, 401);
});
test("chat: a clear message when the Anthropic key is missing (nothing is spent)", async () => {
  const e = env({ ANTHROPIC_API_KEY: "" });
  const r = await route(req("/agent/chat", { messages: [{ role: "user", content: "hi" }] }), e);
  assert.equal(r.status, 503); assert.match((await r.json()).error, /ANTHROPIC_API_KEY/);
  assert.equal(e.BUDDY_KV._m.size, 0, "no usage was counted");
});
test("chat: sends the system text and the conversation, opening with the user, and returns the reply", async () => {
  let seen;
  stub((url, opts) => { seen = { url, body: JSON.parse(opts.body), headers: opts.headers }; return new Response(JSON.stringify({ content: [{ type: "text", text: "Hi" }], stop_reason: "end_turn" }), { status: 200 }); });
  const r = await route(req("/agent/chat", { system: "be nice", messages: [{ role: "assistant", content: "old" }, { role: "user", content: "hello" }] }), env());
  assert.equal(r.status, 200);
  const out = await r.json();
  assert.equal(out.content[0].text, "Hi"); assert.equal(out.stop_reason, "end_turn");
  assert.ok(seen.body.tools.length >= 9, "the tools are sent with every request");
  assert.equal(seen.url, "https://api.anthropic.com/v1/messages");
  assert.equal(seen.headers["x-api-key"], "sk-test-key");
  assert.equal(seen.body.system, "be nice");
  assert.equal(seen.body.messages[0].role, "user", "the conversation opens with the user");
  assert.equal(seen.body.messages.length, 1);
  assert.equal(seen.body.tools[0].strict, true);
});
test("chat: the daily limit stops further calls with a plain message", async () => {
  stub(() => new Response(JSON.stringify({ content: [{ type: "text", text: "ok" }] }), { status: 200 }));
  const e = env({ AGENT_DAILY_LIMIT: "2" });
  assert.equal((await route(req("/agent/chat", { messages: [{ role: "user", content: "1" }] }), e)).status, 200);
  assert.equal((await route(req("/agent/chat", { messages: [{ role: "user", content: "2" }] }), e)).status, 200);
  const third = await route(req("/agent/chat", { messages: [{ role: "user", content: "3" }] }), e);
  assert.equal(third.status, 429); assert.match((await third.json()).error, /daily agent limit/);
});
test("chat: a provider error is passed on as a plain message, not a crash", async () => {
  stub(() => new Response("{}", { status: 500 }));
  const r = await route(req("/agent/chat", { messages: [{ role: "user", content: "hi" }] }), env());
  assert.equal(r.status, 502); assert.match((await r.json()).error, /error 500/);
});
test("speak: returns a playable WAV file at the rate the service reports", async () => {
  const pcm = new Uint8Array(4800).fill(0);          // 0.1 s of silence at 24 kHz, 16-bit mono
  const b64 = btoa(String.fromCharCode(...pcm));
  let seen;
  stub((url, opts) => { seen = { url, body: JSON.parse(opts.body), key: opts.headers["x-goog-api-key"] };
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ inlineData: { mimeType: "audio/L16;codec=pcm;rate=24000", data: b64 } }] } }] }), { status: 200 }); });
  const r = await route(req("/agent/speak", { text: "Good morning, Ajay." }), env());
  assert.equal(r.status, 200); assert.equal(r.headers.get("content-type"), "audio/wav");
  const bytes = new Uint8Array(await r.arrayBuffer());
  assert.equal(String.fromCharCode(...bytes.slice(0, 4)), "RIFF"); assert.equal(String.fromCharCode(...bytes.slice(8, 12)), "WAVE");
  const dv = new DataView(bytes.buffer);
  assert.equal(dv.getUint32(24, true), 24000, "sample rate");
  assert.equal(dv.getUint32(40, true), pcm.length, "data length");
  assert.equal(seen.key, "g-test-key");
  assert.equal(seen.body.generationConfig.responseModalities[0], "AUDIO");
  assert.equal(seen.body.generationConfig.speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName, "Kore");
});
test("speak: a retired model name falls back to the older model once", async () => {
  const pcm = btoa(String.fromCharCode(...new Uint8Array(480)));
  const seen = [];
  stub((url) => { seen.push(url); if (url.includes("3.1-flash")) return new Response("{}", { status: 404 });
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ inlineData: { mimeType: "audio/L16;rate=24000", data: pcm } }] } }] }), { status: 200 }); });
  const r = await route(req("/agent/speak", { text: "hello" }), env());
  assert.equal(r.status, 200);
  assert.equal(seen.length, 2); assert.match(seen[1], /preview-tts/);
});
test("speak: empty text and a missing key are refused clearly", async () => {
  assert.equal((await route(req("/agent/speak", { text: "   " }), env())).status, 400);
  const r = await route(req("/agent/speak", { text: "hi" }), env({ GEMINI_API_KEY: "" }));
  assert.equal(r.status, 503); assert.match((await r.json()).error, /GEMINI_API_KEY/);
});
test("speak: long text is cut to a safe length before it is sent", async () => {
  let sent;
  stub((url, opts) => { sent = JSON.parse(opts.body).contents[0].parts[0].text; return new Response("{}", { status: 500 }); });
  await route(req("/agent/speak", { text: "word ".repeat(600) }), env());
  assert.ok(sent.length <= 1000);
});
test("wavFromPcm writes a correct header for any sample rate", () => {
  const w = wavFromPcm(new Uint8Array([1, 2, 3, 4]), 16000);
  const dv = new DataView(w.buffer);
  assert.equal(w.length, 48); assert.equal(dv.getUint32(24, true), 16000); assert.equal(dv.getUint32(28, true), 32000);
  assert.equal(dv.getUint16(34, true), 16); assert.equal(dv.getUint32(40, true), 4);
});
