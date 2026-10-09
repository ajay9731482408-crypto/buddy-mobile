import { test } from "node:test";
import assert from "node:assert/strict";
import worker from "./worker.js";

const SECRET = "sync-secret-0123456789abcdef";
const APP = "https://me.github.io/buddy-mobile";
function kv() { const m = new Map(); return { get: async (k) => (m.has(k) ? m.get(k) : null), put: async (k, v) => m.set(k, v), _m: m }; }
const env = () => ({ BUDDY_KV: kv(), SYNC_SECRET: SECRET, ALLOWED_ORIGIN: APP });
const req = (method, body, { auth = SECRET, origin = APP, path = "/state" } = {}) => new Request("https://x.workers.dev" + path, {
  method, headers: { "content-type": "application/json", ...(auth ? { Authorization: "Bearer " + auth } : {}), ...(origin ? { Origin: origin } : {}) },
  body: body === undefined ? undefined : body });

test("preflight from the app origin is allowed; other origins are not", async () => {
  const ok = await worker.fetch(req("OPTIONS", undefined, { auth: null }), env());
  assert.equal(ok.status, 204); assert.equal(ok.headers.get("Access-Control-Allow-Origin"), APP);
  const other = await worker.fetch(req("OPTIONS", undefined, { auth: null, origin: "https://evil.example" }), env());
  assert.notEqual(other.headers.get("Access-Control-Allow-Origin"), "https://evil.example");
});
test("wrong or missing secret is refused", async () => {
  assert.equal((await worker.fetch(req("GET", undefined, { auth: "wrong-secret-0000000000" }), env())).status, 401);
  assert.equal((await worker.fetch(req("GET", undefined, { auth: null }), env())).status, 401);
});
test("save then load returns the same state; empty cloud returns 404", async () => {
  const e = env();
  assert.equal((await worker.fetch(req("GET"), e)).status, 404);
  const state = { version: 1, updated: "2026-10-09T10:00:00Z", tasks: [{ id: 1, text: "call mum" }] };
  assert.equal((await worker.fetch(req("PUT", JSON.stringify(state)), e)).status, 200);
  const back = await worker.fetch(req("GET"), e);
  assert.deepEqual(JSON.parse(await back.text()), state);
});
test("bad data is rejected and nothing is written", async () => {
  const e = env();
  assert.equal((await worker.fetch(req("PUT", "{not json"), e)).status, 400);
  assert.equal((await worker.fetch(req("PUT", "x".repeat(200001)), e)).status, 413);
  assert.equal(e.BUDDY_KV._m.size, 0);
});
test("a missing secret, a missing storage binding, or a short secret each get a clear answer", async () => {
  const noSecret = await worker.fetch(req("GET"), { BUDDY_KV: kv(), ALLOWED_ORIGIN: APP });
  assert.equal(noSecret.status, 401, "with no SYNC_SECRET set, every request is refused");
  const noBinding = await worker.fetch(req("GET"), { SYNC_SECRET: SECRET, ALLOWED_ORIGIN: APP });
  assert.equal(noBinding.status, 500);
  assert.match(await noBinding.text(), /BUDDY_KV/);
  const short = await worker.fetch(req("GET", undefined, { auth: "short" }), { BUDDY_KV: kv(), SYNC_SECRET: "short", ALLOWED_ORIGIN: APP });
  assert.equal(short.status, 401, "a short secret is never accepted");
});
test("unknown paths and methods are answered politely", async () => {
  assert.equal((await worker.fetch(req("GET", undefined, { path: "/nope" }), env())).status, 404);
  assert.equal((await worker.fetch(req("DELETE"), env())).status, 405);
});
