// End to end without a network: the client (cloud.js) talks to the real Worker code (worker.js) through an in-memory adapter.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import worker from "../worker/worker.js";
const require = createRequire(import.meta.url);
const L = require("../logic.js");
const C = require("../cloud.js");

const SECRET = "sync-secret-0123456789abcdef";
const APP = "https://me.github.io/buddy-mobile";
const WORKER_URL = "https://buddy-sync.example.workers.dev";

function makeCloud() {
  const m = new Map();
  const env = { BUDDY_KV: { get: async (k) => (m.has(k) ? m.get(k) : null), put: async (k, v) => m.set(k, v) }, SYNC_SECRET: SECRET, ALLOWED_ORIGIN: APP };
  // adapter: the client's fetch(url, options) becomes a real Request for the Worker
  const fetchFn = async (url, opt = {}) => {
    const r = await worker.fetch(new Request(url, { method: opt.method, headers: { ...opt.headers, Origin: APP }, body: opt.body }), env);
    return { status: r.status, ok: r.ok, text: () => r.text() };
  };
  return { fetchFn };
}
const phoneCfg = { mode: "worker", workerUrl: WORKER_URL, token: SECRET };

test("two phones: data saved on one appears on the other, newest copy wins", async () => {
  const cloud = makeCloud();
  // phone A adds a task and saves
  let a = L.emptyState("2026-10-09T10:00:00Z");
  a = L.handle(a, "add task buy stamps", "2026-10-09T10:00:00Z").state;
  await C.save(phoneCfg, a, cloud.fetchFn);
  // phone B starts empty, loads the cloud copy and takes the newer one
  let b = L.emptyState("2026-10-09T09:00:00Z");
  const remote = await C.load(phoneCfg, cloud.fetchFn);
  b = L.pickNewer(b, remote);
  assert.equal(b.tasks[0].text, "buy stamps");
  // phone B changes something later; phone A then loads and gets the newer copy
  b = L.handle(b, "add shopping milk", "2026-10-09T12:00:00Z").state;
  await C.save(phoneCfg, b, cloud.fetchFn);
  const back = await C.load(phoneCfg, cloud.fetchFn);
  a = L.pickNewer(a, back);
  assert.equal(a.shopping[0].text, "milk");
});
test("a phone with newer local data is not overwritten by an older cloud copy", async () => {
  const cloud = makeCloud();
  const old = L.emptyState("2026-10-09T08:00:00Z");
  await C.save(phoneCfg, old, cloud.fetchFn);
  const fresh = L.handle(L.emptyState("2026-10-09T13:00:00Z"), "add task fresh", "2026-10-09T13:00:00Z").state;
  const remote = await C.load(phoneCfg, cloud.fetchFn);
  assert.equal(L.pickNewer(fresh, remote), fresh, "the newer phone copy is kept");
});
test("a connection test on an empty cloud does not create a copy", async () => {
  const cloud = makeCloud();
  assert.equal(await C.test(phoneCfg, cloud.fetchFn), true);
  assert.equal(await C.load(phoneCfg, cloud.fetchFn), null, "the test must not leave an empty copy behind");
});
test("a wrong secret stops the sync with a clear message", async () => {
  const cloud = makeCloud();
  await assert.rejects(C.save({ ...phoneCfg, token: "wrong-secret-0000000000" }, L.emptyState(), cloud.fetchFn), /sync secret is wrong/);
});
