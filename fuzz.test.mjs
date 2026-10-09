import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const L = require("./logic.js");
test("random and hostile input never throws and always returns a reply", () => {
  let seed = 42; const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const chars = "abcdefghijklmnopqrstuvwxyz 0123456789#:,.!?'\"<>&;%$/\\\n\t🙂日本";
  let s = L.emptyState("2026-10-09T08:00:00Z");
  const fixed = ["", " ", "done", "done #", "step", "step 999999999", "goal", "goal 1", "drank 99999999999", "add task", "shopping ",
                 "note", "feel", "i feel", "good morning", "<script>x()</script>", "'; DROP TABLE tasks;--", "\u0000", "x".repeat(3000)];
  const inputs = fixed.concat(Array.from({ length: 2000 }, () => Array.from({ length: 1 + Math.floor(rnd() * 60) }, () => chars[Math.floor(rnd() * chars.length)]).join("")));
  for (const t of inputs) {
    const r = L.handle(s, t, "2026-10-09T08:00:00Z");
    assert.equal(typeof r.reply, "string");
    assert.ok(r.reply.length < 2000);
    s = r.state;
  }
  assert.ok(s.tasks.every((x) => x.text.length <= 500));
  assert.ok(s.goals.every((g) => g.progress <= g.target && g.target >= 1));
  assert.ok(Object.values(s.water).every((v) => Number.isFinite(v)));
});
