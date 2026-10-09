import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const P = require("../plus.js");
const DAY = 86400000;
const T0 = Date.parse("2026-10-09T10:00:00Z");
const go = (s, t, now = T0) => P.handleAll(s, t, now);

test("reminders: 'at 18:00' and 'in 30 minutes' are parsed; past times roll to tomorrow", () => {
  const w = P.parseWhen("at 18:00 to call mum", new Date(T0).setHours(9, 0, 0, 0));
  assert.ok(w && w.rest.startsWith("to call mum"));
  const soon = P.parseWhen("in 30 minutes to stretch", T0);
  assert.equal(soon.at, T0 + 30 * 60000);
  const past = new Date(T0); past.setHours(7, 0, 0, 0);
  const rolled = P.parseWhen("07:00 to x", past.getTime() + 60000);
  assert.ok(rolled.at > past.getTime() + 60000, "a time already passed today means tomorrow");
  assert.equal(P.parseWhen("25:00 to x", T0), null);
});
test("reminders are saved, listed, and reported when due, once", () => {
  let s = P.migrate({});
  s = go(s, "remind me in 5 minutes to stretch").state;
  assert.match(go(s, "reminders").reply, /stretch/);
  assert.equal(P.dueReminders(s, T0).length, 0);
  assert.equal(P.dueReminders(s, T0 + 6 * 60000).length, 1);
  s.notified.push(s.reminders[0].id);
  assert.equal(P.dueReminders(s, T0 + 6 * 60000).length, 0, "a reminder is announced only once");
});
test("habits: streaks count consecutive days and break after a gap", () => {
  let s = P.migrate({});
  s = go(s, "habit study 30 minutes").state;
  for (let i = 2; i >= 0; i--) s = go(s, "did study 30 minutes", T0 - i * DAY).state;
  assert.equal(P.streak(s.habits[0], T0), 3);
  s = go(s, "did study 30 minutes", T0 - 6 * DAY).state;
  assert.equal(P.streak(s.habits[0], T0), 3, "an old day does not extend today's streak");
});
test("routines run each step in order and keep every change", () => {
  let s = P.migrate({});
  s = go(s, "save routine morning: good morning; drank 1 glass; drank 1 glass").state;
  s = go(s, "run routine morning").state;
  assert.equal(s.water["2026-10-09"], 500);
  assert.match(go(s, "run routine nothing").reply, /No routine called/);
});
test("the activity log records real actions and feeds skills and insights", () => {
  let s = P.migrate({});
  s = go(s, "add task a").state; s = go(s, "done 1").state;
  s = go(s, "goal read 3 steps").state; s = go(s, "step 2 2").state;
  s = go(s, "drank 2 glasses").state;
  const kinds = s.activity.map((a) => a.kind);
  assert.equal(kinds.filter((k) => k === "task").length, 1);
  assert.equal(kinds.filter((k) => k === "goal").length, 2);
  assert.equal(kinds.filter((k) => k === "water").length, 1);
  const sk = P.skills(s);
  assert.equal(sk.find((x) => x.id === "goals").level, 1);
  assert.equal(P.insights(s, T0)[6].tasks, 1);
});
test("skill levels rise at 1, 4, 9 actions", () => {
  const s = P.migrate({});
  const levelFor = (n) => { s.activity = Array.from({ length: n }, () => ({ kind: "task", at: T0 })); return P.skills(s).find((x) => x.id === "tasks").level; };
  assert.equal(levelFor(0), 0); assert.equal(levelFor(1), 1); assert.equal(levelFor(4), 2); assert.equal(levelFor(9), 3);
});
test("weekly review reads plainly and reflects the week", () => {
  let s = P.migrate({});
  s = go(s, "add task a").state; s = go(s, "done 1").state; s = go(s, "i feel good").state;
  const r = go(s, "weekly review").reply;
  assert.match(r, /Tasks finished: 1/); assert.match(r, /Mood: mostly good/);
  assert.match(go(P.migrate({}), "weekly review").reply, /quiet week/);
});
test("what should I do now: reminder first, then goal, then task", () => {
  let s = P.migrate({});
  s = go(s, "add task tidy desk").state;
  assert.match(P.nextAction(s, T0), /tidy desk/);
  s = go(s, "goal learn guitar 4 steps").state; s = go(s, "step 1 1").state;
  assert.match(P.nextAction(s, T0), /learn guitar/);
  s = go(s, "remind me in 20 minutes to drink water").state;
  assert.match(P.nextAction(s, T0), /drink water/);
});
test("calendar file: valid structure, escaped text, one event per open reminder", () => {
  let s = P.migrate({});
  s = go(s, "remind me in 1 hour to call mum, then tea; soon").state;
  s = go(s, "remind me in 2 hours to other thing").state;
  s = go(s, "done reminder 2").state;
  const f = P.ics(s, T0);
  assert.match(f, /^BEGIN:VCALENDAR\r\n/); assert.match(f, /END:VCALENDAR$/);
  assert.equal((f.match(/BEGIN:VEVENT/g) || []).length, 1, "done reminders are not exported");
  assert.match(f, /SUMMARY:call mum\\, then tea\\; soon/, "commas and semicolons are escaped");
  assert.match(f, /DTSTART:\d{8}T\d{6}Z/);
});
test("share link encodes the message for WhatsApp", () => {
  const link = P.shareLink("Hi & bye\nlist: milk, eggs");
  assert.ok(link.startsWith("https://wa.me/?text="));
  assert.ok(!link.includes(" ") && !link.includes("\n"));
  assert.equal(decodeURIComponent(link.split("text=")[1]), "Hi & bye\nlist: milk, eggs");
});
test("two phones merge: new items from both survive, and the same item is not duplicated", () => {
  const base = P.migrate({ updated: "2026-10-09T09:00:00Z" });
  const phoneA = P.migrate(Object.assign({}, base, { updated: "2026-10-09T10:00:00Z" }));
  let a = phoneA; a = go(a, "add task from phone a", T0).state;
  let b = P.migrate(Object.assign({}, base, { updated: "2026-10-09T10:30:00Z" })); b = go(b, "note from phone b", T0 + 1800000).state;
  const merged = P.mergeStates(a, b);
  assert.ok(merged.tasks.some((t) => t.text === "from phone a"), "phone A's new task survives");
  assert.ok(merged.notes.some((n) => n.text === "from phone b"), "phone B's new note survives");
  assert.equal(merged.tasks.length, 1);
  const again = P.mergeStates(merged, merged);
  assert.equal(again.tasks.length, 1, "merging a copy with itself adds nothing");
});
test("merge keeps the highest water total and never reuses an id", () => {
  const x = P.migrate({ updated: "2026-10-09T10:00:00Z", water: { "2026-10-09": 1000 }, nextId: 5 });
  const y = P.migrate({ updated: "2026-10-09T11:00:00Z", water: { "2026-10-09": 500 }, nextId: 9 });
  const m = P.mergeStates(x, y);
  assert.equal(m.water["2026-10-09"], 1000); assert.ok(m.nextId >= 9);
});
test("every new command survives odd input without throwing", () => {
  let s = P.migrate({});
  for (const t of ["remind me", "remind me at", "remind me at 99:99 to x", "habit", "did", "save routine : ;", "run routine", "check in", "check in:", "reminders", "done reminder x", "routine ", "share", "calendar"]) {
    const r = go(s, t, T0); assert.equal(typeof r.reply, "string"); s = r.state;
  }
  assert.ok(s.reminders.every((r) => typeof r.at === "number"));
});
