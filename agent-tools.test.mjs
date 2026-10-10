import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { AGENT_TOOLS } from "./worker.js";
const require = createRequire(import.meta.url);
const A = require("./agent.js");
const P = require("./plus.js");
const NOW = Date.parse("2026-10-09T10:00:00Z");
const EXAMPLES = {
  add_task: { text: "call mum" }, complete_task: { id: 1 }, add_shopping: { items: ["milk", "eggs"] },
  add_goal: { title: "learn guitar", steps: 5 }, step_goal: { id: 1, amount: 2 }, set_reminder: { text: "stretch", minutes: 30 },
  log_water: { glasses: 2 }, log_mood: { mood: "good" }, get_summary: {},
};

test("the Worker's tools and the phone's tools are the same list", () => {
  assert.deepEqual(AGENT_TOOLS.map((t) => t.name).sort(), A.TOOL_NAMES.slice().sort());
  for (const t of AGENT_TOOLS) assert.equal(t.input_schema.type, "object");
});
test("every tool turns into a command Buddy's own engine understands", () => {
  let s = P.migrate({});
  s = P.handleAll(s, "add task first", NOW).state;               // gives complete_task something to finish
  for (const name of A.TOOL_NAMES) {
    const v = A.validate(name, EXAMPLES[name]);
    assert.equal(v.ok, true, name + " example should be valid");
    const cmd = A.toCommand(name, v.value);
    const r = P.handleAll(s, cmd, NOW);
    assert.doesNotMatch(r.reply, /did not understand/, name + " -> " + cmd);
  }
});
test("out-of-range, wrong and unknown inputs are refused", () => {
  assert.equal(A.validate("log_water", { glasses: 99 }).ok, false);
  assert.equal(A.validate("log_water", { glasses: 1.5 }).ok, false);
  assert.equal(A.validate("log_mood", { mood: "ecstatic" }).ok, false);
  assert.equal(A.validate("add_task", { text: "   " }).ok, false);
  assert.equal(A.validate("add_shopping", { items: [] }).ok, false);
  assert.equal(A.validate("delete_everything", {}).ok, false, "there is no delete tool");
  assert.equal(A.validate("set_reminder", { text: "x", minutes: 99999 }).ok, false);
});
test("the loop runs a tool, returns the result to the model paired by id, then speaks the answer", async () => {
  const calls = []; const bodies = [];
  const replies = [
    { ok: true, status: 200, json: async () => ({ content: [{ type: "tool_use", id: "tu_1", name: "add_task", input: { text: "call mum" } }], stop_reason: "tool_use" }) },
    { ok: true, status: 200, json: async () => ({ content: [{ type: "text", text: "Added. Call mum is on your list." }], stop_reason: "end_turn" }) },
  ];
  const fetchFn = async (url, opt) => { bodies.push(JSON.parse(opt.body)); return replies.shift(); };
  const out = await A.runAgent({ base: "https://w.example", secret: "sync-secret-0123456789abcdef", userText: "remind me to call mum",
    history: [], summary: "none", now: NOW, fetchFn, execute: async (cmd) => { calls.push(cmd); return "Added task #1: call mum"; } });
  assert.deepEqual(calls, ["add task call mum"]);
  assert.equal(out.say, "Added. Call mum is on your list.");
  const second = bodies[1].messages;
  const toolResult = second[second.length - 1].content[0];
  assert.equal(toolResult.type, "tool_result"); assert.equal(toolResult.tool_use_id, "tu_1");
  assert.equal(second[second.length - 2].role, "assistant", "the model's own tool request is kept");
});
test("an invalid tool request is not run, and the model is told why", async () => {
  const calls = [];
  const replies = [
    { ok: true, status: 200, json: async () => ({ content: [{ type: "tool_use", id: "tu_9", name: "log_water", input: { glasses: 500 } }], stop_reason: "tool_use" }) },
    { ok: true, status: 200, json: async () => ({ content: [{ type: "text", text: "That was too many glasses to log." }], stop_reason: "end_turn" }) },
  ];
  const bodies = [];
  const out = await A.runAgent({ base: "https://w.example", secret: "sync-secret-0123456789abcdef", userText: "I drank 500 glasses",
    fetchFn: async (u, opt) => { bodies.push(JSON.parse(opt.body)); return replies.shift(); }, execute: async (c) => { calls.push(c); return "x"; } });
  assert.deepEqual(calls, [], "nothing ran");
  assert.match(bodies[1].messages.at(-1).content[0].content, /Not done/);
  assert.equal(out.say, "That was too many glasses to log.");
});
test("the loop stops after a fixed number of turns, even if the model keeps asking for tools", async () => {
  let asks = 0;
  const fetchFn = async () => { asks++; return { ok: true, status: 200, json: async () => ({ content: [{ type: "tool_use", id: "tu_" + asks, name: "get_summary", input: {} }], stop_reason: "tool_use" }) }; };
  const out = await A.runAgent({ base: "https://w.example", secret: "sync-secret-0123456789abcdef", userText: "loop", fetchFn, execute: async () => "summary" });
  assert.equal(asks, A.MAX_TURNS);
  assert.equal(out.results.length, A.MAX_TURNS);
});
test("the instructions tell the model to use tools for changes and never to invent results", () => {
  const sys = A.buildSystem("open tasks: 2", NOW);
  assert.match(sys, /call the matching tool/); assert.match(sys, /Never claim something was done/);
  assert.ok(!/undefined|NaN/.test(sys));
});
