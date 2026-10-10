// The Worker's Supabase storage, tested against an in-memory stand-in for Supabase's REST API.
import { test } from "node:test";
import assert from "node:assert/strict";
import { route, storeFor, spend } from "./worker.js";

const SECRET = "sync-secret-0123456789abcdef", APP = "https://me.github.io/buddy-mobile";
const SB = "https://xyz.supabase.co", SVC = "service-role-key-0000000000000000";
const realFetch = globalThis.fetch;
function fakeSupabase() {
  const rows = new Map(); const seen = [];
  globalThis.fetch = async (url, opts = {}) => {
    seen.push({ url: String(url), headers: opts.headers || {}, method: opts.method || "GET" });
    const u = new URL(url);
    if (!u.pathname.endsWith("/rest/v1/buddy_kv")) return new Response("not found", { status: 404 });
    if ((opts.method || "GET") === "GET") {
      const key = (u.searchParams.get("key") || "").replace(/^eq\./, "");
      return new Response(JSON.stringify(rows.has(key) ? [{ value: rows.get(key) }] : []), { status: 200 });
    }
    const body = JSON.parse(opts.body);
    rows.set(body.key, body.value);
    return new Response(null, { status: 201 });
  };
  return { rows, seen };
}
const env = (extra = {}) => Object.assign({ SYNC_SECRET: SECRET, ALLOWED_ORIGIN: APP, SUPABASE_URL: SB, SUPABASE_SERVICE_KEY: SVC }, extra);
const req = (method, path, body) => new Request("https://w.workers.dev" + path, { method, headers: { "content-type": "application/json", Origin: APP, Authorization: "Bearer " + SECRET }, body: body === undefined ? undefined : body });
test.afterEach(() => { globalThis.fetch = realFetch; });

test("saves and loads the sync copy through Supabase", async () => {
  const sb = fakeSupabase();
  const state = JSON.stringify({ version: 2, updated: "2026-10-09T10:00:00Z", tasks: [{ id: 1, text: "stored in supabase" }] });
  assert.equal((await route(req("PUT", "/state", state), env())).status, 200);
  const back = await route(req("GET", "/state"), env());
  assert.equal(back.status, 200); assert.equal(await back.text(), state);
  assert.ok(sb.rows.has("state"), "the row is in the buddy_kv table");
});
test("the service key travels in headers only, never in an address", async () => {
  const sb = fakeSupabase();
  await route(req("PUT", "/state", '{"a":1}'), env());
  for (const call of sb.seen) {
    assert.ok(!call.url.includes(SVC), "no key in the address");
    assert.equal(call.headers.apikey, SVC);
  }
});
test("the daily agent limit is kept in Supabase too", async () => {
  fakeSupabase();
  const e = env({ AGENT_DAILY_LIMIT: "2" });
  assert.equal(await spend(e, 1), true);
  assert.equal(await spend(e, 1), true);
  assert.equal(await spend(e, 1), false, "third call of the day is refused");
});
test("no storage connected gives a clear message and never saves anything", async () => {
  const r = await route(req("PUT", "/state", '{"a":1}'), { SYNC_SECRET: SECRET, ALLOWED_ORIGIN: APP });
  assert.equal(r.status, 500); assert.match((await r.json()).error, /No storage is connected/);
  assert.equal(storeFor({}), null);
  assert.equal(await spend({}, 1), false, "without storage the agent does not run");
});
test("a Supabase failure returns a safe message and writes nothing", async () => {
  globalThis.fetch = async () => new Response("down", { status: 503 });
  const r = await route(req("PUT", "/state", '{"a":1}'), env());
  assert.equal(r.status, 500); assert.match((await r.json()).error, /Nothing was changed/);
});
test("Cloudflare KV is still used when Supabase is not set up", async () => {
  const m = new Map();
  const kv = { get: async (k) => (m.has(k) ? m.get(k) : null), put: async (k, v) => m.set(k, v) };
  const e = { SYNC_SECRET: SECRET, ALLOWED_ORIGIN: APP, BUDDY_KV: kv };
  assert.equal((await route(req("PUT", "/state", '{"kv":true}'), e)).status, 200);
  assert.equal(await (await route(req("GET", "/state"), e)).text(), '{"kv":true}');
});
