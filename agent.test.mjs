import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const A = require("./agent.js");

test("only Buddy's own commands get through", () => {
  assert.equal(A.isAllowed("add task call mum"), true);
  assert.equal(A.isAllowed("done 2"), true);
  assert.equal(A.isAllowed("step 1 5"), true);
  assert.equal(A.isAllowed("delete everything"), false);
  assert.equal(A.isAllowed("rm -rf /"), false);
  assert.equal(A.isAllowed(""), false);
  assert.equal(A.isAllowed("x".repeat(300)), false);
});
test("replies: valid JSON, mixed text, plain text, and bad command lists are all handled", () => {
  const ok = A.parseReply('{"say":"Hello there.","commands":["add task call mum","rm -rf /","drank 2 glasses"]}');
  assert.equal(ok.say, "Hello there."); assert.deepEqual(ok.commands, ["add task call mum", "drank 2 glasses"]);
  assert.deepEqual(A.parseReply('Sure! {"say":"Okay","commands":[]} thanks').commands, []);
  assert.equal(A.parseReply("just words").say, "just words");
  const many = A.parseReply('{"say":"x","commands":["tasks","tasks","tasks","tasks","tasks"]}');
  assert.equal(many.commands.length, A.MAX_COMMANDS, "at most three commands run per reply");
  assert.equal(A.parseReply('{"commands":["water"]}').say, "Done.", "a command without words still gets a short confirmation");
  assert.ok(A.parseReply("y".repeat(5000)).say.length <= 700, "speech is capped");
  assert.equal(A.parseReply('{"say": 42, "commands": "water"}').say, "42");
});
test("instructions tell the model to use tools for changes and never to invent data", () => {
  const sys = A.buildSystem("open tasks: 2", Date.parse("2026-10-09T10:00:00Z"));
  assert.match(sys, /call the matching tool/); assert.match(sys, /open tasks: 2/);
  assert.match(sys, /Never claim something was done/);
  assert.ok(!/undefined|NaN/.test(sys));
});
test("chat sends the request to the Worker with the secret in the header only", async () => {
  let seen;
  const fetchFn = async (url, opt) => { seen = { url, opt }; return { ok: true, status: 200, json: async () => ({ text: '{"say":"Hi","commands":["tasks"]}' }) }; };
  const out = await A.chat({ base: "https://w.example.workers.dev/", secret: "sync-secret-0123456789abcdef", messages: [{ role: "user", content: "hi" }], summary: "x", now: 0, fetchFn });
  assert.equal(seen.url, "https://w.example.workers.dev/agent/chat");
  assert.equal(seen.opt.headers.Authorization, "Bearer sync-secret-0123456789abcdef");
  assert.ok(!seen.url.includes("sync-secret"));
  assert.deepEqual(out.commands, ["tasks"]);
});
test("chat errors come back as plain messages", async () => {
  const fetchFn = async () => ({ ok: false, status: 429, json: async () => ({ error: "The daily agent limit is reached." }) });
  await assert.rejects(A.chat({ base: "https://w.example", secret: "sync-secret-0123456789abcdef", messages: [], fetchFn }), /daily agent limit/);
  await assert.rejects(A.chat({ base: "", secret: "", messages: [] }), /Set up cloud storage/);
  const down = async () => { throw new TypeError("offline"); };
  await assert.rejects(A.chat({ base: "https://w.example", secret: "sync-secret-0123456789abcdef", messages: [], fetchFn: down }), /Could not reach your Worker/);
});
test("speech is requested from the Worker and returned as audio", async () => {
  const fetchFn = async (url) => { assert.match(url, /\/agent\/speak$/); return { ok: true, status: 200, blob: async () => new Blob(["RIFF"], { type: "audio/wav" }) }; };
  const b = await A.speakBlob({ base: "https://w.example", secret: "sync-secret-0123456789abcdef", text: "hello", fetchFn });
  assert.equal(b.type, "audio/wav");
});

test("the common-sense rules are in the instructions", () => {
  const sys = A.buildSystem("open tasks: 0", Date.parse("2026-10-09T10:00:00Z"));
  assert.match(sys, /ask one short question instead of guessing/);
  assert.match(sys, /Do not log water, mood or habits unless the user says so/);
  assert.match(sys, /ask the user to confirm/);
  assert.match(sys, /do not use tools/);
});
