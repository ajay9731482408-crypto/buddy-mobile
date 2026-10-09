// Regression tests for bugs found in the full check. Each test names the bug it guards against.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import worker from "../worker/worker.js";
const require = createRequire(import.meta.url);
const L = require("../logic.js");
const P = require("../plus.js");
const C = require("../cloud.js");

const SECRET = "sync-secret-0123456789abcdef", APP = "https://me.github.io/buddy-mobile", URL_W = "https://buddy-sync.example.workers.dev";
function cloudWorker() {
  const m = new Map();
  const env = { BUDDY_KV: { get: async (k) => (m.has(k) ? m.get(k) : null), put: async (k, v) => m.set(k, v) }, SYNC_SECRET: SECRET, ALLOWED_ORIGIN: APP };
  return { fetchFn: async (url, opt = {}) => { const r = await worker.fetch(new Request(url, { method: opt.method, headers: { ...opt.headers, Origin: APP }, body: opt.body }), env); return { status: r.status, ok: r.ok, text: () => r.text() }; }, store: m };
}
const cfg = { mode: "worker", workerUrl: URL_W, token: SECRET };

test("BUG: a stale phone saving to the cloud must not erase items added on another phone", async () => {
  const cloud = cloudWorker();
  // phone A adds a task and syncs
  let a = P.migrate({ updated: "2026-10-09T10:00:00Z" });
  a = P.handleAll(a, "add task from phone a", Date.parse("2026-10-09T10:00:00Z")).state;
  await C.sync(cfg, a, P.mergeStates, cloud.fetchFn);
  // phone B was offline; it has an older copy with a note, and syncs now
  let b = P.migrate({ updated: "2026-10-09T09:30:00Z" });
  b = P.handleAll(b, "note from phone b", Date.parse("2026-10-09T09:30:00Z")).state;
  const merged = await C.sync(cfg, b, P.mergeStates, cloud.fetchFn);
  assert.ok(merged.tasks.some((t) => t.text === "from phone a"), "phone A's task is kept");
  assert.ok(merged.notes.some((n) => n.text === "from phone b"), "phone B's note is kept");
  const back = await C.load(cfg, cloud.fetchFn);
  assert.ok(back.tasks.some((t) => t.text === "from phone a"), "the cloud copy keeps phone A's task too");
});
test("BUG: days are counted in the phone's own time zone, not UTC", () => {
  const old = process.env.TZ;
  try {
    process.env.TZ = "Asia/Kolkata";                      // 20:00 UTC is already the next morning in India
    assert.equal(L.localDay(Date.parse("2026-10-09T20:00:00Z")), "2026-10-10");
    let s = P.migrate({});
    const r = P.handleAll(s, "drank 1 glass", Date.parse("2026-10-09T20:00:00Z"));
    assert.deepEqual(Object.keys(r.state.water), ["2026-10-10"]);
    process.env.TZ = "America/New_York";                 // 02:00 UTC is still the previous evening in New York
    assert.equal(L.localDay(Date.parse("2026-10-09T02:00:00Z")), "2026-10-08");
  } finally {
    if (old === undefined) delete process.env.TZ; else process.env.TZ = old;
  }
});
test("BUG: a habit streak stays correct when the phone's day is counted locally", () => {
  const old = process.env.TZ;
  try {
    process.env.TZ = "Asia/Kolkata";
    let s = P.migrate({});
    const base = Date.parse("2026-10-09T20:00:00Z");     // 10 Oct locally
    s = P.handleAll(s, "habit read", base).state;
    s = P.handleAll(s, "did read", base - 86400000).state;   // 9 Oct locally
    const r = P.handleAll(s, "did read", base).state;
    assert.equal(P.streak(r.habits[0], base), 2);
  } finally { if (old === undefined) delete process.env.TZ; else process.env.TZ = old; }
});
test("BUG: a reminder that was announced before a sync is still announced exactly once", () => {
  let s = P.migrate({});
  const now = Date.parse("2026-10-09T10:00:00Z");
  s = P.handleAll(s, "remind me in 5 minutes to stretch", now).state;
  const later = now + 6 * 60000;
  assert.equal(P.dueReminders(s, later).length, 1);
  s.notified.push(s.reminders[0].id);
  const merged = P.mergeStates(s, s);
  assert.equal(P.dueReminders(merged, later).length, 0, "a reminder announced on this phone stays announced after a sync");
});
test("BUG: announcements are per phone; a sync must not silence a reminder on another phone", () => {
  const now = Date.parse("2026-10-09T10:00:00Z");
  const phoneA = P.handleAll(P.migrate({}), "remind me in 5 minutes to stretch", now).state;
  const phoneB = Object.assign(P.migrate(phoneA), { notified: [] });
  const aAnnounced = Object.assign(P.migrate(phoneA), { notified: [phoneA.reminders[0].id] });
  const merged = P.mergeStates(phoneB, aAnnounced);     // phone B syncs and receives phone A's copy
  assert.deepEqual(merged.notified, [], "phone B keeps its own list, so it still announces the reminder");
});
test("BUG: merging keeps a task finished on either phone as finished", () => {
  const base = P.migrate({ updated: "2026-10-09T09:00:00Z" });
  let a = P.handleAll(base, "add task pay bills", Date.parse("2026-10-09T09:10:00Z")).state;
  let b = P.handleAll(a, "done 1", Date.parse("2026-10-09T09:20:00Z")).state;   // phone B finishes the task
  const merged = P.mergeStates(a, b);
  assert.equal(merged.tasks[0].done, true);
});
