import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const L = require("./logic.js");
const V = require("./voice.js");
const FX = require("./vfx.js");
const I = require("./icons.js");
const NOW = "2026-10-09T08:00:00Z";
const run = (s, t) => L.handle(s, t, NOW);

test("goals: start, step, reach, and no double counting after reached", () => {
  let s = L.emptyState(NOW);
  s = run(s, "goal learn guitar 3 steps").state;
  s = run(s, "step 1").state; s = run(s, "step 1 2").state;
  assert.equal(s.goals[0].progress, 3); assert.equal(s.goals[0].done, true);
  assert.match(run(s, "step 1").reply, /already reached/);
  assert.equal(s.goals[0].progress, 3);
});
test("goals: list shows open goals with progress", () => {
  let s = L.emptyState(NOW);
  s = run(s, "goal read a book 10 steps").state;
  s = run(s, "step 1 4").state;
  assert.match(run(s, "goals").reply, /read a book: 4 of 10/);
});
test("the morning briefing names the top goal and today's water", () => {
  let s = L.emptyState(NOW);
  s = run(s, "goal run 5k 5 steps").state; s = run(s, "add task pay bills").state; s = run(s, "drank 2 glasses").state;
  const r = run(s, "good morning").reply;
  assert.match(r, /1 open task/); assert.match(r, /500 ml of 2000/); assert.match(r, /run 5k \(0 of 5\)/);
});
test("command words are normalised, but the text of tasks is never changed", () => {
  let s = L.emptyState(NOW);
  s = run(s, "add task buy stamps").state;
  assert.equal(s.tasks[0].text, "buy stamps");
  s = run(s, "todos: call mum").state;
  assert.equal(s.tasks[1].text, "call mum");
  s = run(s, "completed 1").state;
  assert.equal(s.tasks[0].done, true);
});
test("drinks accept glass or cup words; water goal is reached and reported", () => {
  let s = L.emptyState(NOW);
  s = run(s, "drank 2 cups").state; assert.equal(s.water["2026-10-09"], 500);
  s = run(s, "drank 8 glasses").state; assert.match(run(s, "water").reply, /2500 ml of 2000/);
});
test("old saved data (version 1) still loads", () => {
  const old = { version: 1, updated: NOW, nextId: 3, tasks: [{ id: 1, text: "x", done: false }], shopping: [], notes: [], water: {}, moods: [] };
  const s = L.migrate(old);
  assert.deepEqual(s.goals, []); assert.equal(s.version, 2); assert.equal(s.tasks[0].text, "x");
});
test("summary includes goal progress", () => {
  let s = L.emptyState(NOW);
  s = run(s, "goal a 1 steps").state; s = run(s, "goal b 2 steps").state; s = run(s, "step 1").state;
  const sum = L.summary(s, NOW);
  assert.equal(sum.goalsOpen, 1); assert.equal(sum.goalPct, 50);
});
test("voice: text is cleaned for speech (no emoji, bullets or long lines)", () => {
  const out = V.cleanForSpeech("Shopping list:\n• milk\n• eggs 🥚 **now**");
  assert.ok(!/[•*🥚]/.test(out)); assert.match(out, /milk/); assert.ok(out.length <= 600);
  assert.equal(V.cleanForSpeech(""), "");
});
test("voice: the best matching voice is chosen, with a preferred name honoured", () => {
  const voices = [{ name: "Fr Voice", lang: "fr-FR" }, { name: "Plain", lang: "en-GB" }, { name: "Google UK natural", lang: "en-GB" }];
  assert.equal(V.pickVoice(voices, "en-GB").name, "Google UK natural");
  assert.equal(V.pickVoice(voices, "en-GB", "Plain").name, "Plain");
  assert.equal(V.pickVoice([], "en"), null);
});
test("voice: missing speech features fail softly, never throw", () => {
  assert.deepEqual(V.support(), { listen: false, speak: false });
  assert.equal(V.listen({ onError: (c) => assert.equal(c, "unsupported") }), null);
  assert.equal(V.speak("hello"), false);
});
test("effects: particle count is capped and particles wrap around the screen", () => {
  assert.equal(FX.density(360, 640) >= 10 && FX.density(360, 640) <= 40, true);
  assert.equal(FX.density(4000, 4000), 40);
  const parts = FX.make(20, 300, 500, () => 0.5);
  FX.step(parts, 16, 300, 500, 0);
  for (const p of parts) { assert.ok(p.x >= -10 && p.x <= 310); assert.ok(p.y >= -10 && p.y <= 510); }
  // a particle above the top comes back at the bottom
  const one = [{ x: 10, y: -7, vx: 0, vy: -1, s: 1, a: 1, ph: 0 }];
  FX.step(one, 16, 300, 500, 0); assert.ok(one[0].y > 400);
});
test("icons: every icon is valid SVG markup with a stroke and an accessible hidden flag", () => {
  for (const name of I.names) {
    const svg = I.svg(name, 20);
    assert.match(svg, /^<svg /); assert.match(svg, /aria-hidden="true"/); assert.match(svg, /stroke="currentColor"/);
  }
  assert.equal(I.svg("does-not-exist"), "");
});
