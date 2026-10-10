// Run: npm test   (Node 18+, no dependencies)
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const N = require("./notch.js");

test("starts idle", () => {
  const s = N.reduce(N.initial(), { type: "idle" }, 0);
  assert.equal(s.mode, "idle"); assert.equal(s.label, "Buddy");
});
test("work shows a label and clamps progress", () => {
  let s = N.reduce(N.initial(), { type: "work", label: "Syncing orders", progress: 1.7 }, 0);
  assert.equal(s.mode, "active"); assert.equal(s.label, "Syncing orders"); assert.equal(s.progress, 1);
});
test("an alert wins over work and returns to it afterwards", () => {
  let s = N.reduce(N.initial(), { type: "work", label: "Packing" }, 0);
  s = N.reduce(s, { type: "alert", title: "Call the dentist", actions: [{ label: "Done", id: "done" }] }, 1000);
  assert.equal(s.mode, "alert"); assert.equal(s.actions.length, 1);
  s = N.reduce(s, { type: "work", label: "Still packing" }, 1500);
  assert.equal(s.mode, "alert", "work must not hide a visible alert");
  s = N.reduce(s, {}, 1000 + N.ALERT_MS + 1);
  assert.equal(s.mode, "active"); assert.equal(s.label, "Still packing");
});
test("an alert expires on its own", () => {
  let s = N.reduce(N.initial(), { type: "alert", title: "Water" }, 0);
  s = N.reduce(s, {}, N.ALERT_MS + 5);
  assert.equal(s.mode, "idle");
});
test("dismiss closes the alert immediately", () => {
  let s = N.reduce(N.initial(), { type: "alert", title: "Water" }, 0);
  s = N.reduce(s, { type: "dismiss" }, 10);
  assert.equal(s.mode, "idle"); assert.equal(s.until, 0);
});
test("idle cannot hide an alert", () => {
  let s = N.reduce(N.initial(), { type: "alert", title: "Meeting" }, 0);
  s = N.reduce(s, { type: "idle" }, 10);
  assert.equal(s.mode, "alert");
});
test("result flashes then returns", () => {
  let s = N.reduce(N.initial(), { type: "work", label: "Saving" }, 0);
  s = N.reduce(s, { type: "result", label: "Saved", tone: "ok" }, 100);
  assert.equal(s.mode, "result"); assert.equal(s.tone, "ok");
  s = N.reduce(s, {}, 100 + N.RESULT_MS + 1);
  assert.equal(s.mode, "active"); assert.equal(s.label, "Saving");
});
test("error results are marked as errors", () => {
  const s = N.reduce(N.initial(), { type: "result", label: "Failed", tone: "error" }, 0);
  assert.equal(s.tone, "error");
});
test("open shows quick actions and closes back to idle", () => {
  let s = N.reduce(N.initial(), { type: "open" }, 0);
  assert.equal(s.mode, "open"); assert.ok(s.actions.length >= 2);
  s = N.reduce(s, { type: "close" }, 10);
  assert.equal(s.mode, "idle");
});
test("open cannot replace an alert", () => {
  let s = N.reduce(N.initial(), { type: "alert", title: "Pills" }, 0);
  s = N.reduce(s, { type: "open" }, 5);
  assert.equal(s.mode, "alert");
});
test("labels and action lists are length-limited", () => {
  const long = "x".repeat(500);
  const s = N.reduce(N.initial(), { type: "alert", title: long, actions: [{ label: long }, { label: "b" }, { label: "c" }] }, 0);
  assert.ok(s.title.length <= 80); assert.equal(s.actions.length, 2); assert.ok(s.actions[0].label.length <= 20);
});
test("the reducer never mutates its input", () => {
  const a = N.initial(); const b = N.reduce(a, { type: "work", label: "x" }, 0);
  assert.equal(a.mode, "idle"); assert.equal(b.mode, "active");
});
