// Amazon Polly voice route, tested with a stand-in for AWS. Real AWS is not called from the test.
import { test } from "node:test";
import assert from "node:assert/strict";
import { route } from "./worker.js";

const SECRET = "sync-secret-0123456789abcdef", APP = "https://me.github.io/buddy-mobile";
const AWS = { AWS_ACCESS_KEY_ID: "AKIDEXAMPLE", AWS_SECRET_ACCESS_KEY: "wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY" };
const env = (extra = {}) => Object.assign({ SYNC_SECRET: SECRET, ALLOWED_ORIGIN: APP, GEMINI_API_KEY: "g-key", BUDDY_KV: { get: async () => null, put: async () => {} } }, AWS, extra);
const req = (body) => new Request("https://w.workers.dev/agent/speak", { method: "POST",
  headers: { "content-type": "application/json", Origin: APP, Authorization: "Bearer " + SECRET }, body: JSON.stringify(body) });
const realFetch = globalThis.fetch;
test.afterEach(() => { globalThis.fetch = realFetch; });
function stubPolly(seen) {
  globalThis.fetch = async (url, opts = {}) => {
    seen.push({ url: String(url), opts });
    return new Response(new Uint8Array(3200), { status: 200, headers: { "content-type": "audio/pcm" } });
  };
}

test("Polly is used when AWS keys are set, with a signed request and a neural voice", async () => {
  const seen = []; stubPolly(seen);
  const r = await route(req({ text: "Good morning, Ajay." }), env());
  assert.equal(r.status, 200); assert.equal(r.headers.get("content-type"), "audio/wav");
  assert.equal(seen[0].url, "https://polly.us-east-1.amazonaws.com/v1/speech");
  const sent = JSON.parse(seen[0].opts.body);
  assert.equal(sent.Engine, "neural"); assert.equal(sent.VoiceId, "Joanna"); assert.equal(sent.OutputFormat, "pcm");
  assert.match(seen[0].opts.headers.Authorization, /^AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE\/\d{8}\/us-east-1\/polly\/aws4_request/);
  assert.ok(!JSON.stringify(seen[0].opts.headers).includes("wJalrXUtnFEMI"), "the secret key is never sent");
  const bytes = new Uint8Array(await r.arrayBuffer());
  assert.equal(new DataView(bytes.buffer).getUint32(24, true), 16000, "Polly audio is 16 kHz");
});
test("the phone can choose a listed voice; unknown voice names fall back to the default", async () => {
  const seen = []; stubPolly(seen);
  await route(req({ text: "hi", voice: "Matthew" }), env());
  await route(req({ text: "hi", voice: "Hacker" }), env());
  assert.equal(JSON.parse(seen[0].opts.body).VoiceId, "Matthew");
  assert.equal(JSON.parse(seen[1].opts.body).VoiceId, "Joanna");
});
test("the phone can ask for Gemini even when Polly is set up", async () => {
  const seen = []; stubPolly(seen);
  globalThis.fetch = async (url, opts) => { seen.push(String(url)); return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ inlineData: { mimeType: "audio/L16;rate=24000", data: btoa(String.fromCharCode(...new Uint8Array(480))) } }] } }] }), { status: 200 }); };
  const r = await route(req({ text: "hi", engine: "gemini" }), env());
  assert.equal(r.status, 200); assert.match(seen[0], /generativelanguage/);
});
test("asking for Polly without AWS keys gives a clear message", async () => {
  const r = await route(req({ text: "hi", engine: "polly" }), env({ AWS_ACCESS_KEY_ID: "", AWS_SECRET_ACCESS_KEY: "" }));
  assert.equal(r.status, 503); assert.match((await r.json()).error, /AWS_ACCESS_KEY_ID/);
});
test("an AWS failure is passed on as a plain message", async () => {
  globalThis.fetch = async () => new Response("denied", { status: 403 });
  const r = await route(req({ text: "hi" }), env());
  assert.equal(r.status, 502); assert.match((await r.json()).error, /could not speak/);
});
