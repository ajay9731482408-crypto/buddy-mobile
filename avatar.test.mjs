import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const A = require("./avatar.js");

test("five quick taps make Buddy dizzy; slow taps do not", () => {
  let s = A.initial();
  for (let i = 0; i < 4; i++) s = A.tap(s, 1000 + i * 500);          // 4 taps over 2 seconds
  assert.notEqual(s.state, "dizzy");
  s = A.tap(s, 3100);                                                 // the fifth, still within 3 s of the first
  assert.equal(s.state, "dizzy");
  let slow = A.initial();
  for (let i = 0; i < 6; i++) slow = A.tap(slow, i * 4000);           // one tap every 4 s: never dizzy
  assert.notEqual(slow.state, "dizzy");
});
test("dizziness wears off after three seconds, and a squish settles at once", () => {
  let s = A.initial();
  for (let i = 0; i < 5; i++) s = A.tap(s, 1000 + i * 100);
  assert.equal(A.settle(s, 1400).state, "dizzy", "still dizzy shortly after");
  assert.equal(A.settle(s, 1000 + 4000).state, "idle");
  assert.equal(A.settle(A.tap(A.initial(), 0), 10).state, "idle");
});
test("replies set the right expression; unknown moods stay idle", () => {
  assert.equal(A.reply(A.initial(), "excited").state, "happy");
  assert.equal(A.reply(A.initial(), "worried").state, "worried");
  assert.equal(A.reply(A.initial(), "confused").state, "thinking");
  assert.equal(A.reply(A.initial(), "weird-word").state, "idle");
  assert.equal(A.set(A.initial(), "not-a-state").state, "idle");
});
test("the pupils look toward the pointer, and never leave the face", () => {
  const c = A.eyeOffset(100, 100, 100, 100);
  assert.deepEqual(c, { x: 0, y: 0 }, "centred pointer: no movement");
  const right = A.eyeOffset(2000, 100, 100, 100);
  assert.ok(right.x > 0 && right.x <= 4.5, "looks right, within the limit");
  const up = A.eyeOffset(100, -2000, 100, 100);
  assert.ok(up.y < 0 && Math.abs(up.y) <= 4.5, "looks up, within the limit");
});
test("every state draws a face, and the drawing never contains script", () => {
  for (const name of A.STATES) {
    const svg = A.svg(name, { x: 1, y: -1 });
    assert.match(svg, /^<svg /); assert.match(svg, /aria-hidden="true"/);
    assert.ok(!/<script/i.test(svg), name);
  }
  assert.match(A.svg("thinking"), /class="ring"/, "thinking shows a turning ring");
  assert.match(A.svg("dizzy"), /stroke-linecap="round"/, "dizzy shows X eyes");
});
test("the pupil points carry their home position for smooth movement", () => {
  const svg = A.svg("idle", { x: 0, y: 0 });
  assert.equal((svg.match(/data-bx=/g) || []).length, 4, "two eyes and two highlights");
});
