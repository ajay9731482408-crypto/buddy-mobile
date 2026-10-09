import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const L = require("./logic.js");
const NOW = "2026-10-09T10:00:00.000Z";
const run = (s, t, now = NOW) => L.handle(s, t, now);

test("tasks: add, list, finish", () => {
  let s = L.emptyState(NOW);
  s = run(s, "add task call mum").state;
  assert.match(run(s, "tasks").reply, /#1 call mum/);
  s = run(s, "done 1").state;
  assert.equal(run(s, "tasks").reply, "No open tasks. Nice work.");
  assert.match(run(s, "done 9").reply, /cannot find/);
});
test("shopping: add without duplicates, buy", () => {
  let s = L.emptyState(NOW);
  s = run(s, "add shopping milk, eggs, milk").state;
  assert.equal(s.shopping.length, 2);
  s = run(s, "bought milk").state;
  assert.match(run(s, "shopping").reply, /eggs/);
  assert.ok(!/milk/.test(run(s, "shopping").reply));
});
test("water adds glasses per day and reports the goal", () => {
  let s = L.emptyState(NOW);
  s = run(s, "drank 3 glasses").state;
  assert.equal(s.water["2026-10-09"], 750);
  assert.match(run(s, "water").reply, /750 ml of 2000/);
  s = run(s, "drank 6 glasses").state;
  assert.match(run(s, "water").reply, /2250 ml of 2000/);
});
test("mood: safe reply for low moods, unknown words asked again", () => {
  let s = L.emptyState(NOW);
  const r = run(s, "i feel awful");
  assert.equal(r.mood, "worried"); assert.match(r.reply, /contact someone you trust/);
  assert.equal(run(s, "i feel zzz").mood, "curious");
});
test("text never breaks the app: long, odd and empty input", () => {
  let s = L.emptyState(NOW);
  for (const t of ["", "   ", "<script>x</script>", "'; DROP TABLE tasks;--", "🙂".repeat(300), "add task " + "x".repeat(900), "done 99999999999999999999"]) {
    const r = run(s, t); assert.equal(typeof r.reply, "string"); s = r.state;
  }
  assert.ok(s.tasks.every((t) => t.text.length <= 500));
});
test("state is never mutated in place", () => {
  const s = L.emptyState(NOW); const before = JSON.stringify(s);
  run(s, "add task x"); assert.equal(JSON.stringify(s), before);
});
test("summary numbers match the lists", () => {
  let s = L.emptyState(NOW);
  s = run(s, "add task a").state; s = run(s, "add task b").state; s = run(s, "done 1").state; s = run(s, "add shopping tea").state;
  const sum = L.summary(s, NOW);
  assert.equal(sum.openTasks, 1); assert.equal(sum.doneTasks, 1); assert.equal(sum.completion, 50); assert.equal(sum.shopping, 1);
});
test("the newer copy wins when phone and cloud differ", () => {
  const phone = { updated: "2026-10-09T10:00:00Z", tasks: ["phone"] };
  const cloud = { updated: "2026-10-09T11:00:00Z", tasks: ["cloud"] };
  assert.equal(L.pickNewer(phone, cloud), cloud);
  assert.equal(L.pickNewer(cloud, phone), cloud);
  assert.equal(L.pickNewer(phone, null), phone);
  assert.equal(L.pickNewer(null, cloud), cloud);
});
