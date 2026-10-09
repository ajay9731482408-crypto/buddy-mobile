import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const C = require("./cloud.js");
const cfg = { accountId: "acc 1", namespaceId: "ns/1", token: "SECRET-TOKEN" };
const reply = (status, body = "") => async () => ({ status, ok: status >= 200 && status < 300, text: async () => body });

test("the token goes in the header, never in the address", async () => {
  let seen;
  await C.save(cfg, { a: 1 }, async (url, opt) => { seen = { url, opt }; return { status: 200, ok: true, text: async () => "" }; });
  assert.equal(seen.opt.headers.Authorization, "Bearer SECRET-TOKEN");
  assert.ok(!seen.url.includes("SECRET-TOKEN"));
  assert.ok(seen.url.includes("acc%201") && seen.url.includes("ns%2F1"), "ids are encoded");
});
test("save and load round trip through the same key", async () => {
  const store = {};
  const f = async (url, opt) => {
    if (opt.method === "PUT") { store[url] = opt.body; return { status: 200, ok: true, text: async () => "" }; }
    if (url in store) return { status: 200, ok: true, text: async () => store[url] };
    return { status: 404, ok: false, text: async () => "" };
  };
  assert.equal(await C.load(cfg, f), null);
  await C.save(cfg, { tasks: [1] }, f);
  assert.deepEqual(await C.load(cfg, f), { tasks: [1] });
});
test("plain messages for the common problems", async () => {
  await assert.rejects(C.save(cfg, {}, reply(403)), /rejected the token/);
  await assert.rejects(C.save(cfg, {}, reply(404)), /Namespace ID was not found/);
  await assert.rejects(C.save(cfg, {}, reply(500)), /error 500/);
  await assert.rejects(C.save(cfg, {}, async () => { throw new TypeError("blocked"); }), /Could not reach Cloudflare/);
  await assert.rejects(C.save({ ...cfg, token: "" }, {}, reply(200)), /Fill in the Account ID/);
});
test("a damaged cloud copy is refused, not used", async () => {
  await assert.rejects(C.load(cfg, reply(200, "{broken")), /damaged/);
});
test("connection test writes and reads a probe value", async () => {
  const store = {};
  const f = async (url, opt) => {
    if (opt.method === "PUT") { store[url] = opt.body; return { status: 200, ok: true, text: async () => "" }; }
    return { status: 200, ok: true, text: async () => store[url] };
  };
  assert.equal(await C.test(cfg, f), true);
});

test("worker mode: sends the sync secret and reads/writes /state on the Worker", async () => {
  const seen = [];
  const f = async (url, opt) => { seen.push({ url, opt }); return { status: 200, ok: true, text: async () => "" }; };
  const wcfg = { mode: "worker", workerUrl: "https://buddy-sync.example.workers.dev/", token: "sync-secret-0123456789abcdef" };
  await C.save(wcfg, { a: 1 }, f);
  assert.equal(seen[0].url, "https://buddy-sync.example.workers.dev/state");
  assert.equal(seen[0].opt.headers.Authorization, "Bearer sync-secret-0123456789abcdef");
});
test("worker mode: a test only reads and never writes", async () => {
  const methods = [];
  const f = async (url, opt) => { methods.push(opt.method); return { status: 404, ok: false, text: async () => "" }; };
  const wcfg = { mode: "worker", workerUrl: "https://buddy-sync.example.workers.dev", token: "sync-secret-0123456789abcdef" };
  assert.equal(await C.test(wcfg, f), true);
  assert.deepEqual(methods, ["GET"]);
});
test("worker mode: plain messages for wrong secret and blocked origin", async () => {
  const wcfg = { mode: "worker", workerUrl: "https://buddy-sync.example.workers.dev", token: "sync-secret-0123456789abcdef" };
  await assert.rejects(C.save(wcfg, {}, async () => ({ status: 401, ok: false, text: async () => "" })), /sync secret is wrong/);
  await assert.rejects(C.save(wcfg, {}, async () => ({ status: 403, ok: false, text: async () => "" })), /ALLOWED_ORIGIN/);
  await assert.rejects(C.save({ ...wcfg, workerUrl: "http://insecure.example" }, {}, async () => ({ status: 200, ok: true, text: async () => "" })), /https/);
});
